"""
AI service — dual-provider:
  • Groq  → text generation (generate, generate_json, extract_text_from_image)
            + audio transcription via Whisper (transcribe_audio)
  • Gemini → embeddings only (embed_text)

Public interface is unchanged so all callers require zero modifications.
"""
import asyncio
import json
import logging
import re
import tempfile
import os
from typing import Any

from openai import AsyncOpenAI, APIError, RateLimitError
from google import genai as google_genai
from google.genai import types as google_types
from google.genai.errors import ClientError, ServerError
from fastapi import HTTPException

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Groq client (text generation + audio) ────────────────────────────────────
_groq = AsyncOpenAI(
    api_key=settings.groq_api_key,
    base_url="https://api.groq.com/openai/v1",
)

# ── Gemini client (embeddings only) ──────────────────────────────────────────
_gemini = google_genai.Client(api_key=settings.gemini_api_key)


# ── Error handlers ────────────────────────────────────────────────────────────

def _handle_groq_error(exc: Exception) -> None:
    if isinstance(exc, RateLimitError):
        raise HTTPException(status_code=429, detail="Groq API rate limit reached. Please wait a moment.")
    if isinstance(exc, APIError):
        raise HTTPException(status_code=502, detail=f"Groq API error: {exc.message}")
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


# ── Text generation — Groq ────────────────────────────────────────────────────

async def generate(prompt: str, system: str | None = None) -> str:
    """Generate text via Groq."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    try:
        resp = await _groq.chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            temperature=0.7,
        )
        return resp.choices[0].message.content or ""
    except Exception as exc:
        _handle_groq_error(exc)
        return ""


async def generate_json(prompt: str, system: str | None = None) -> Any:
    """Generate JSON via Groq."""
    json_system = (system or "") + (
        "\nIMPORTANT: Respond with valid JSON only. No markdown fences, no explanation."
    )
    messages = [
        {"role": "system", "content": json_system.strip()},
        {"role": "user", "content": prompt},
    ]
    try:
        resp = await _groq.chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
    except Exception as exc:
        _handle_groq_error(exc)
        return {}

    cleaned = re.sub(r"```(?:json)?\s*([\s\S]*?)```", r"\1", raw).strip()
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Groq returned non-JSON: %s", cleaned[:200])
        return {}


async def extract_text_from_image(image_b64: str, mime_type: str = "image/jpeg") -> str:
    """Extract text from an image — falls back to Gemini vision since Groq has no vision."""
    try:
        import base64
        image_data = base64.b64decode(image_b64)

        def _extract():
            resp = _gemini.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    google_types.Part.from_bytes(data=image_data, mime_type=mime_type),
                    "Extract ALL text from this image accurately. "
                    "If it is handwriting, transcribe exactly. "
                    "If it is a whiteboard or diagram, describe the structure then transcribe all text. "
                    "Return ONLY the extracted text, cleanly formatted.",
                ],
            )
            return resp.text or ""

        return await asyncio.to_thread(_extract)
    except Exception as exc:
        _handle_gemini_error(exc)
        return ""


# ── Audio transcription — Groq Whisper ───────────────────────────────────────

async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """Transcribe audio via Groq's Whisper (whisper-large-v3-turbo)."""
    suffix = ".webm" if "webm" in mime_type else ".mp3" if "mp3" in mime_type else ".m4a"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        with open(tmp_path, "rb") as audio_file:
            result = await _groq.audio.transcriptions.create(
                model="whisper-large-v3-turbo",
                file=audio_file,
                response_format="text",
            )
        return str(result).strip()
    except Exception as exc:
        logger.error("Groq Whisper transcription failed: %s", exc)
        _handle_groq_error(exc)
        return ""
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


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
