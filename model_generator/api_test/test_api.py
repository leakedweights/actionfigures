import os
import base64
import json
import pytest
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient

# We need to import the app object from our api_server module
# We also set the PYTHONPATH to ensure the import works correctly
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from script_examples.api_server import app


# --- Pytest Fixture for the Test Client ---
# This fixture will be used by all test functions.
# It sets up the environment variables and creates a TestClient instance.
@pytest.fixture(scope="module")
def client():
    # Set environment variables for the test environment
    os.environ["VALID_TOKENS"] = "test-token-123"
    os.environ["COMFYUI_SERVER_ADDRESS"] = "test-server:8188"
    os.environ["LOCAL_OUTPUT_DIR"] = "/tmp/test_output"

    # Create the test output directory if it doesn't exist
    os.makedirs(os.environ["LOCAL_OUTPUT_DIR"], exist_ok=True)

    # Create a TestClient instance
    with TestClient(app) as c:
        yield c


# --- Helper Function ---
def get_test_image_b64():
    """Creates a simple 1x1 PNG image and returns it as a base64 string."""
    # A 1x1 pixel red PNG, base64 encoded
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg=="


# --- Test Cases ---


def test_root_endpoint(client):
    """Test the root endpoint for a basic health check."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "3D Model Generation API is running"}


def test_generate_endpoint_success(client):
    """Test the /generate endpoint with a valid token and image."""
    # We mock the background task to prevent it from actually running
    with patch("script_examples.api_server.process_request") as mock_background_task:
        image_b64 = get_test_image_b64()
        request_payload = {"id": "test-request-123", "image": image_b64}
        headers = {"Authorization": "Bearer test-token-123"}

        response = client.post("/generate", json=request_payload, headers=headers)

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processing"
        assert data["request_id"] == "test-request-123"

        # Check that the background task was added correctly
        mock_background_task.assert_called_once_with("test-request-123", image_b64)


def test_generate_endpoint_invalid_token(client):
    """Test /generate with an invalid token."""
    request_payload = {"id": "test-request-456", "image": get_test_image_b64()}
    headers = {"Authorization": "Bearer invalid-token"}

    response = client.post("/generate", json=request_payload, headers=headers)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid authentication token"


def test_generate_endpoint_missing_token(client):
    """Test /generate without an Authorization header."""
    request_payload = {"id": "test-request-789", "image": get_test_image_b64()}

    response = client.post("/generate", json=request_payload)

    assert (
        response.status_code == 403
    )  # FastAPI returns 403 when the header is missing for Bearer auth


def test_status_endpoint_processing(client):
    """Test /status when the model is not yet ready."""
    # Mock the filesystem to simulate no output directory
    with patch("os.path.exists") as mock_exists:
        mock_exists.return_value = False

        headers = {"Authorization": "Bearer test-token-123"}
        response = client.get("/status/some-request-id", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processing"
        assert data["request_id"] == "some-request-id"


def test_status_endpoint_completed(client):
    """Test /status when the model is ready."""
    # Mock the filesystem to simulate a completed model file
    with (
        patch("os.path.exists") as mock_exists,
        patch("os.listdir") as mock_listdir,
        patch("os.path.getmtime") as mock_getmtime,
    ):
        # Setup mocks
        mock_exists.return_value = True
        mock_listdir.return_value = ["model_001.glb", "another_file.txt"]
        mock_getmtime.return_value = 1678886400  # A dummy timestamp

        headers = {"Authorization": "Bearer test-token-123"}
        response = client.get("/status/some-request-id", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["model_url"] == "/static/model_001.glb"
        assert data["request_id"] == "some-request-id"
