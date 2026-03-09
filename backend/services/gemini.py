import asyncio
import json
import logging
import re
from typing import Any

from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError
from fastapi import HTTPException

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_client = genai.Client(api_key=settings.gemini_api_key)


def _handle_gemini_error(exc: Exception) -> None:
    """Convert google-genai SDK errors to meaningful HTTPExceptions."""
    if isinstance(exc, ClientError):
        status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
        msg = str(exc)
        if status == 429 or "quota" in msg.lower() or "rate" in msg.lower() or "resource_exhausted" in msg.lower():
            raise HTTPException(
                status_code=429,
                detail="Gemini API rate limit reached. Please wait a moment and try again.",
            )
        raise HTTPException(status_code=502, detail=f"Gemini API error: {msg}")
    if isinstance(exc, ServerError):
        raise HTTPException(status_code=502, detail=f"Gemini server error: {exc}")
    raise exc


async def embed_text(text: str) -> list[float]:
    """Generate a 768-dim embedding for the given text (non-blocking)."""
    def _embed():
        result = _client.models.embed_content(
            model=settings.embedding_model,
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=768,
            ),
        )
        return result.embeddings[0].values

    try:
        return await asyncio.to_thread(_embed)
    except Exception as exc:
        _handle_gemini_error(exc)
        return []  # unreachable, keeps type checker happy


async def generate(prompt: str, system: str | None = None) -> str:
    """Generate text from Gemini (non-blocking)."""
    def _generate():
        contents = []
        if system:
            contents.append(types.Content(
                role="user",
                parts=[types.Part(text=f"{system}\n\n{prompt}")]
            ))
        else:
            contents.append(types.Content(
                role="user",
                parts=[types.Part(text=prompt)]
            ))
        response = _client.models.generate_content(
            model=settings.chat_model,
            contents=contents,
        )
        return response.text or ""

    try:
        return await asyncio.to_thread(_generate)
    except Exception as exc:
        _handle_gemini_error(exc)
        return ""  # unreachable


async def generate_json(prompt: str, system: str | None = None) -> Any:
    """Generate JSON from Gemini, parse it, and return a dict/list."""
    raw = await generate(prompt, system)
    cleaned = re.sub(r"```(?:json)?\s*([\s\S]*?)```", r"\1", raw).strip()
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Gemini returned non-JSON response: %s", cleaned[:200])
        return {}


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """Transcribe audio using Gemini multimodal (non-blocking)."""
    def _transcribe():
        response = _client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                "Transcribe this audio accurately. Return only the transcription text, nothing else.",
            ],
        )
        return response.text or ""

    try:
        return await asyncio.to_thread(_transcribe)
    except Exception as exc:
        _handle_gemini_error(exc)
        return ""  # unreachable
