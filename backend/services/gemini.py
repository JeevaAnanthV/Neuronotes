"""
AI service — backed by xAI Grok via the OpenAI-compatible API.
Public interface is identical to the previous Gemini implementation so all
callers (routers/ai.py, routers/notes.py, etc.) require zero changes.
"""
import asyncio
import json
import logging
import re
from typing import Any

from openai import AsyncOpenAI, APIError, RateLimitError
from fastapi import HTTPException

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_client = AsyncOpenAI(
    api_key=settings.xai_api_key,
    base_url="https://api.x.ai/v1",
)


def _handle_error(exc: Exception) -> None:
    if isinstance(exc, RateLimitError):
        raise HTTPException(
            status_code=429,
            detail="Grok API rate limit reached. Please wait a moment and try again.",
        )
    if isinstance(exc, APIError):
        raise HTTPException(status_code=502, detail=f"Grok API error: {exc.message}")
    raise exc


async def generate(prompt: str, system: str | None = None) -> str:
    """Generate text from Grok (non-blocking)."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    try:
        response = await _client.chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            temperature=0.7,
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        _handle_error(exc)
        return ""


async def generate_json(prompt: str, system: str | None = None) -> Any:
    """Generate JSON from Grok, parse it, and return a dict/list."""
    json_system = (system or "") + (
        "\nIMPORTANT: Respond with valid JSON only. No markdown code blocks, no explanation."
    )
    messages = [
        {"role": "system", "content": json_system.strip()},
        {"role": "user", "content": prompt},
    ]
    try:
        response = await _client.chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
    except Exception as exc:
        _handle_error(exc)
        return {}

    # Strip markdown fences if model ignores response_format
    cleaned = re.sub(r"```(?:json)?\s*([\s\S]*?)```", r"\1", raw).strip()
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Grok returned non-JSON: %s", cleaned[:200])
        return {}


async def embed_text(text: str) -> list[float]:
    """
    Generate a text embedding.
    xAI does not yet expose an embeddings endpoint, so we fall back to a
    lightweight local model via sentence-transformers (768-dim).
    If sentence-transformers is not installed, returns a zero vector so the
    app keeps running — semantic search / graph edges just won't be populated.
    """
    try:
        from sentence_transformers import SentenceTransformer

        # Cache model in module scope so it only loads once
        if not hasattr(embed_text, "_model"):
            embed_text._model = SentenceTransformer("all-mpnet-base-v2")  # type: ignore[attr-defined]

        model = embed_text._model  # type: ignore[attr-defined]
        embedding = await asyncio.to_thread(lambda: model.encode(text, normalize_embeddings=True))
        return embedding.tolist()
    except ImportError:
        logger.warning(
            "sentence-transformers not installed — embeddings disabled. "
            "Run: pip install sentence-transformers"
        )
        return [0.0] * 768
    except Exception as exc:
        logger.error("Embedding error: %s", exc)
        return [0.0] * 768


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """
    Transcribe audio.
    xAI Grok does not yet support audio input, so we attempt to use
    OpenAI Whisper API if OPENAI_API_KEY is set, otherwise return a
    placeholder.
    """
    import os
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if openai_key:
        try:
            from openai import AsyncOpenAI as OAI
            import tempfile
            oai = OAI(api_key=openai_key)
            suffix = ".webm" if "webm" in mime_type else ".mp3"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
                f.write(audio_bytes)
                tmp = f.name
            with open(tmp, "rb") as audio_file:
                result = await oai.audio.transcriptions.create(
                    model="whisper-1", file=audio_file
                )
            os.unlink(tmp)
            return result.text
        except Exception as e:
            logger.error("Whisper transcription failed: %s", e)

    return "[Audio transcription unavailable — Grok does not support audio yet.]"


async def extract_text_from_image(image_b64: str, mime_type: str = "image/jpeg") -> str:
    """Extract text from an image using Grok vision."""
    try:
        response = await _client.chat.completions.create(
            model=settings.chat_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{image_b64}"},
                        },
                        {
                            "type": "text",
                            "text": (
                                "Extract ALL text from this image accurately. "
                                "If it is handwriting, transcribe exactly. "
                                "If it is a whiteboard or diagram, describe the structure then transcribe all text. "
                                "Return ONLY the extracted text, cleanly formatted."
                            ),
                        },
                    ],
                }
            ],
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        _handle_error(exc)
        return ""
