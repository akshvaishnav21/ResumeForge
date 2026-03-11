import pytest
from unittest.mock import patch
from app.services import router

@pytest.mark.asyncio
async def test_get_model_status_no_keys():
    with patch.object(router.settings, 'gemini_api_key', None), \
         patch.object(router.settings, 'azure_openai_api_key', None):
        status = await router.get_model_status()
    assert "gemini" in status
    assert "azure" in status
    assert status["gemini"]["available"] == False
    assert status["azure"]["available"] == False
