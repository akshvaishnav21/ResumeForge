import json
import re
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from . import router
from ..models.resume import MasterResumeData

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")

def _sub(template: str, variables: Dict[str, str]) -> str:
    for key, value in variables.items():
        template = template.replace(f"{{{{{key}}}}}", str(value))
    return template

def _build_bullet_count_manifest(master_resume: MasterResumeData) -> str:
    """Build a manifest showing exact bullet counts per experience/area for the prompt."""
    lines = ["BULLET COUNT MANIFEST (you MUST match these counts exactly):"]
    for exp in master_resume.experience:
        label = f"{exp.company} | {exp.role}"
        if exp.bullets:
            lines.append(f"  {label} → top-level bullets: {len(exp.bullets)}")
        for area in (exp.areas or []):
            lines.append(f"  {label} → Area \"{area.area}\" → {len(area.bullets)} bullets")
    for proj in master_resume.projects:
        if proj.bullets:
            lines.append(f"  Project \"{proj.name}\" → {len(proj.bullets)} bullets")
    return "\n".join(lines)


async def tailor(
    job_description: str,
    requirements: Dict[str, Any],
    master_resume: MasterResumeData,
    intensity: str = "moderate",
    preferred_model: Optional[str] = None,
    enable_validation: bool = True,
    company: str = "",
    role: str = "",
    gemini_api_key: Optional[str] = None,
) -> Tuple[str, Optional[int], Optional[str], str]:
    """Returns (tailored_markdown, ats_score, ats_feedback, model_used)"""

    master_json = master_resume.model_dump_json(indent=2)
    requirements_json = json.dumps(requirements, indent=2)
    bullet_manifest = _build_bullet_count_manifest(master_resume)

    # Step 2: Mapping
    mapping_template = _load_prompt("mapping.txt")
    mapping_prompt = _sub(mapping_template, {
        "REQUIREMENTS_JSON": requirements_json,
        "MASTER_RESUME_JSON": master_json,
    })
    mapping_text, model_used = await router.generate(
        [{"role": "user", "content": mapping_prompt}],
        temperature=0.1,
        max_tokens=2048,
        preferred_model=preferred_model,
        gemini_api_key=gemini_api_key,
    )

    # Step 3: Tailoring
    intensity_map = {"light": "tailor_light.txt", "moderate": "tailor_moderate.txt", "heavy": "tailor_heavy.txt"}
    tailor_file = intensity_map.get(intensity, "tailor_moderate.txt")
    tailor_template = _load_prompt(tailor_file)
    company_name = company or requirements.get("company", "Not provided")
    role_name = role or requirements.get("job_title", "Not provided")
    tailor_prompt = _sub(tailor_template, {
        "MASTER_RESUME_JSON": master_json,
        "REQUIREMENTS_JSON": requirements_json,
        "MAPPING_ANALYSIS": mapping_text,
        "JD_TEXT": job_description,
        "COMPANY_NAME": company_name,
        "ROLE_NAME": role_name,
        "BULLET_MANIFEST": bullet_manifest,
    })
    tailored_markdown, model_used = await router.generate(
        [{"role": "user", "content": tailor_prompt}],
        temperature=0.3,
        max_tokens=8192,
        preferred_model=preferred_model,
        gemini_api_key=gemini_api_key,
    )

    # Step 4: Validation (optional)
    ats_score = None
    ats_feedback = None
    if enable_validation:
        try:
            validation_template = _load_prompt("validation.txt")
            validation_prompt = _sub(validation_template, {
                "MASTER_RESUME_JSON": master_json,
                "TAILORED_MARKDOWN": tailored_markdown,
                "REQUIREMENTS_JSON": requirements_json,
                "JD_TEXT": job_description,
            })
            validation_text, _ = await router.generate(
                [{"role": "user", "content": validation_prompt}],
                temperature=0.0,
                max_tokens=1024,
                preferred_model=preferred_model,
                gemini_api_key=gemini_api_key,
            )

            json_match = re.search(r'\{[\s\S]*\}', validation_text)
            if json_match:
                val_result = json.loads(json_match.group())
                ats_score = val_result.get("ats_score")
                ats_feedback = val_result.get("feedback", "")
        except Exception:
            pass  # Validation is optional

    return tailored_markdown, ats_score, ats_feedback, model_used
