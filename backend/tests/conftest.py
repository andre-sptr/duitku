import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://wallet-watch-143.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def clean_state(api):
    """Reset DB before test so we have a deterministic state."""
    r = api.post(f"{BASE_URL}/api/data/reset", timeout=30)
    assert r.status_code == 200
    return True
