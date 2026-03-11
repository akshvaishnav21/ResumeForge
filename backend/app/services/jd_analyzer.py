import json
import re
from pathlib import Path
from typing import Dict, Any
from . import router

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")

async def analyze_jd(job_description: str, preferred_model: str = None) -> Dict[str, Any]:
    prompt_template = _load_prompt("extraction.txt")
    prompt = prompt_template.replace("{{JD_TEXT}}", job_description)

    messages = [{"role": "user", "content": prompt}]
    text, model_used = await router.generate(messages, temperature=0.1, max_tokens=2048, preferred_model=preferred_model)

    # Extract JSON from response
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        try:
            return json.loads(json_match.group()), model_used
        except json.JSONDecodeError:
            pass

    return {"raw": text, "parse_error": True}, model_used
