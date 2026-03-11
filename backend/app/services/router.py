from typing import List, Dict, Any, Optional
from ..config import settings


async def generate(
    messages: List[Dict[str, str]],
    temperature: float = 0.3,
    max_tokens: int = 4096,
    preferred_model: Optional[str] = None
) -> tuple[str, str]:
    """Returns (response_text, model_used)"""

    errors = []

    if settings.gemini_api_key and preferred_model != "azure":
        try:
            text = await _call_gemini(messages, temperature, max_tokens)
            return text, "gemini"
        except Exception as e:
            errors.append(f"Gemini: {e}")
            if not settings.azure_openai_api_key:
                raise RuntimeError(f"Gemini failed: {e}")

    if settings.azure_openai_api_key:
        try:
            text = await _call_azure(messages, temperature, max_tokens)
            return text, "azure"
        except Exception as e:
            errors.append(f"Azure: {e}")

    if errors:
        raise RuntimeError(f"All models failed: {'; '.join(errors)}")
    raise RuntimeError("No LLM configured. Set GEMINI_API_KEY or AZURE_OPENAI_API_KEY.")


async def _call_gemini(messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)

    # Convert messages list to single prompt
    parts = []
    for msg in messages:
        role = msg["role"].upper()
        content = msg["content"]
        parts.append(f"{role}: {content}")
    prompt = "\n\n".join(parts)

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
    )
    return response.text


async def _call_azure(messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
    from openai import AsyncAzureOpenAI

    client = AsyncAzureOpenAI(
        api_key=settings.azure_openai_api_key,
        azure_endpoint=settings.azure_openai_endpoint,
        api_version="2024-02-01"
    )

    response = await client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


async def get_model_status() -> Dict[str, Any]:
    status = {}

    if settings.gemini_api_key:
        status["gemini"] = {"available": True, "model": settings.gemini_model}
    else:
        status["gemini"] = {"available": False, "error": "No API key configured"}

    if settings.azure_openai_api_key:
        status["azure"] = {"available": True, "deployment": settings.azure_openai_deployment}
    else:
        status["azure"] = {"available": False, "error": "No API key configured"}

    return status
