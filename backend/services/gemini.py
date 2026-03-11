"""
AI service — dual-provider:
  • xAI Grok  → text generation (generate, generate_json, extract_text_from_image)
  • Gemini    → embeddings (embed_text) + audio transcription (transcribe_audio)

Public interface is unchanged so all callers require zero modifications.
"""
import asyncio
import json
import logging
import re
from typing import Any

from openai import AsyncOpenAI, APIError, RateLimitError
from google import genai as google_genai
from google.genai import types as google_types
from google.genai.errors import ClientError, ServerError
from fastapi import HTTPException

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Grok client (text generation) ────────────────────────────────────────────
_grok = AsyncOpenAI(
    api_key=settings.xai_api_key,
    base_url="https://api.x.ai/v1",
)

# ── Gemini client (embeddings + audio) ───────────────────────────────────────
_gemini = google_genai.Client(api_key=settings.gemini_api_key)


# ── Error handlers ────────────────────────────────────────────────────────────

def _handle_grok_error(exc: Exception) -> None:
    if isinstance(exc, RateLimitError):
        raise HTTPException(status_code=429, detail="Grok API rate limit reached.")
    if isinstance(exc, APIError):
        raise HTTPException(status_code=502, detail=f"Grok API error: {exc.message}")
    raise exc


def _handle_gemini_error(exc: Exception) -> None:
    if isinstance(exc, ClientError):
        status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
        msg = str(exc)
        if status == 429 or "quota" in msg.lower() or "rate" in msg.lower():
            raise HTTPException(status_code=429, detail="Gemini API rate limit reached.")
        raise HTTPException(status_code=502, detail=f"Gemini API error: {msg}")
    if isinstance(exc, ServerError):
        raise HTTPException(status_code=502, detail=f"Gemini server error: {exc}")
    raise exc


# ── Text generation — Grok ────────────────────────────────────────────────────

async def generate(prompt: str, system: str | None = None) -> str:
    """Generate text via Grok."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    try:
        resp = await _grok.chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            temperature=0.7,
        )
        return resp.choices[0].message.content or ""
    except Exception as exc:
        _handle_grok_error(exc)
        return ""


async def generate_json(prompt: str, system: str | None = None) -> Any:
    """Generate JSON via Grok."""
    json_system = (system or "") + (
        "\nIMPORTANT: Respond with valid JSON only. No markdown fences, no explanation."
    )
    messages = [
        {"role": "system", "content": json_system.strip()},
        {"role": "user", "content": prompt},
    ]
    try:
        resp = await _grok.chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
    except Exception as exc:
        _handle_grok_error(exc)
        return {}

    cleaned = re.sub(r"```(?:json)?\s*([\s\S]*?)```", r"\1", raw).strip()
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Grok returned non-JSON: %s", cleaned[:200])
        return {}


async def extract_text_from_image(image_b64: str, mime_type: str = "image/jpeg") -> str:
    """Extract text from an image via Grok vision."""
    try:
        resp = await _grok.chat.completions.create(
            model=settings.chat_model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_b64}"}},
                    {"type": "text", "text": (
                        "Extract ALL text from this image accurately. "
                        "If it is handwriting, transcribe exactly. "
                        "If it is a whiteboard or diagram, describe the structure then transcribe all text. "
                        "Return ONLY the extracted text, cleanly formatted."
                    )},
                ],
            }],
        )
        return resp.choices[0].message.content or ""
    except Exception as exc:
        _handle_grok_error(exc)
        return ""


# ── Embeddings — Gemini ───────────────────────────────────────────────────────

async def embed_text(text: str) -> list[float]:
    """Generate a 768-dim embedding via Gemini."""
    def _embed():
        result = _gemini.models.embed_content(
            model=settings.embedding_model,
            contents=text,
            config=google_types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=768,
            ),
        )
        return result.embeddings[0].values

    try:
        return await asyncio.to_thread(_embed)
    except Exception as exc:
        _handle_gemini_error(exc)
        return []


# ── Audio transcription — Gemini ──────────────────────────────────────────────

async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """Transcribe audio via Gemini multimodal."""
    def _transcribe():
        resp = _gemini.models.generate_content(
            model=settings.chat_model.replace("grok-4-latest", "gemini-2.0-flash"),
            contents=[
                google_types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                "Transcribe this audio accurately. Return only the transcription text, nothing else.",
            ],
        )
        return resp.text or ""

    try:
        return await asyncio.to_thread(_transcribe)
    except Exception as exc:
        _handle_gemini_error(exc)
        return ""
