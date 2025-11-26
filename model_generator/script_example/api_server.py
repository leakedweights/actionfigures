import base64
import json
import logging
import os
import random
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

import requests
import websocket
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# --- Configuration & Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_OUTPUT_DIR = os.environ.get("LOCAL_OUTPUT_DIR", "/output")
SERVER_ADDRESS = os.environ.get("COMFYUI_SERVER_ADDRESS", "127.0.0.1:8188")
CLIENT_ID = str(uuid.uuid4())
MAX_WORKERS = int(os.environ.get("MAX_WORKERS", "4"))
VALID_TOKENS = set(os.environ.get("VALID_TOKENS", "").split(","))

# --- In-Memory Status Tracking ---
# In production, use Redis or a database
request_status: Dict[str, Dict[str, Any]] = {}

# --- FastAPI App Initialization ---
app = FastAPI(title="3D Model Generation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=LOCAL_OUTPUT_DIR), name="static")

executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
security = HTTPBearer()


# --- Pydantic Models ---
class ImageRequest(BaseModel):
    id: str
    image: str


class GenerationResponse(BaseModel):
    status: str
    message: str
    model_url: Optional[str] = None
    request_id: Optional[str] = None


# --- Authentication ---
def validate_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    if not VALID_TOKENS or token not in VALID_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


# --- ComfyUI Functions ---
def queue_prompt(prompt: Dict[str, Any], prompt_id: str):
    p = {"prompt": prompt, "client_id": CLIENT_ID, "prompt_id": prompt_id}
    data = json.dumps(p).encode("utf-8")
    req = urllib.request.Request(f"http://{SERVER_ADDRESS}/prompt", data=data)
    try:
        urllib.request.urlopen(req).read()
    except urllib.error.URLError as e:
        logger.error(f"Error connecting to ComfyUI server: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ComfyUI server is not available",
        )


def upload_file(filepath: str, subfolder: str = "", overwrite: bool = False):
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Input file not found: {filepath}")
    url = f"http://{SERVER_ADDRESS}/upload/image"
    try:
        with open(filepath, "rb") as f:
            files = {"image": (os.path.basename(filepath), f)}
            data = {"subfolder": subfolder, "overwrite": str(overwrite).lower()}
            response = requests.post(url, files=files, data=data)
            response.raise_for_status()
            return response.json()["name"]
    except requests.exceptions.RequestException as e:
        logger.error(f"Error uploading file {filepath}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload image to ComfyUI",
        )


def run_workflow(request_id: str, image_path: str) -> str:
    """Executes workflow and returns path to 3D model."""
    workflow_path = os.path.join(SCRIPT_DIR, "workflow.json")
    if not os.path.exists(workflow_path):
        logger.error(f"Workflow file not found at '{workflow_path}'")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Workflow configuration not found on server",
        )

    with open(workflow_path, "r", encoding="utf-8") as f:
        workflow = json.loads(f.read())

    # Set random seed
    seed = random.randint(1, 1000000000)
    if (
        "7" in workflow
        and "inputs" in workflow["7"]
        and "seed" in workflow["7"]["inputs"]
    ):
        workflow["7"]["inputs"]["seed"] = seed
        logger.info(f"Using seed: {seed}")

    # Upload image
    logger.info(f"Uploading {image_path}...")
    comfyui_path_image = upload_file(image_path, "", True)
    logger.info(f"Image uploaded to ComfyUI as: {comfyui_path_image}")

    if (
        "2" in workflow
        and "inputs" in workflow["2"]
        and "image" in workflow["2"]["inputs"]
    ):
        workflow["2"]["inputs"]["image"] = comfyui_path_image
    else:
        logger.error("Image input node ('2') not found in workflow.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Workflow configuration is invalid",
        )

    # Queue prompt
    prompt_id = str(uuid.uuid4())
    logger.info(f"Queuing prompt with ID: {prompt_id}")
    queue_prompt(workflow, prompt_id)

    # Wait for completion via WebSocket
    ws = websocket.WebSocket()
    ws.connect(f"ws://{SERVER_ADDRESS}/ws?clientId={CLIENT_ID}")
    try:
        logger.info("Waiting for workflow to complete...")
        while True:
            out = ws.recv()
            if isinstance(out, str):
                message = json.loads(out)
                if message["type"] == "executing":
                    data = message["data"]
                    if data["node"] is None and data["prompt_id"] == prompt_id:
                        logger.info("Workflow execution finished.")
                        break
    finally:
        ws.close()

    # Wait for file to be saved
    time.sleep(3)

    # Find output file
    filename_prefix = "ComfyUI"
    for node_id, node_data in workflow.items():
        if node_data.get("class_type") == "SaveGLB":
            filename_prefix = node_data["inputs"]["filename_prefix"]
            break

    if "/" in filename_prefix:
        subfolder, base_prefix = filename_prefix.rsplit("/", 1)
    else:
        subfolder, base_prefix = "", filename_prefix

    full_local_output_path = os.path.join(LOCAL_OUTPUT_DIR, subfolder)
    if not os.path.exists(full_local_output_path):
        logger.error(f"Local output directory not found: {full_local_output_path}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Output directory not found",
        )

    logger.info(
        f"Searching for newest model file in '{full_local_output_path}' with prefix '{base_prefix}'..."
    )
    latest_file = None
    latest_time = 0
    for filename in os.listdir(full_local_output_path):
        if filename.startswith(base_prefix) and filename.endswith(".glb"):
            file_path = os.path.join(full_local_output_path, filename)
            file_time = os.path.getmtime(file_path)
            if file_time > latest_time:
                latest_time = file_time
                latest_file = filename

    if not latest_file:
        logger.error(f"Could not find .glb files with prefix '{base_prefix}'")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate 3D model",
        )

    model_relative_path = os.path.join(subfolder, latest_file)
    logger.info(f"3D model '{latest_file}' found at '{model_relative_path}'.")
    return model_relative_path


def process_request(request_id: str, image_data: str):
    """Process a 3D model generation request in background."""
    try:
        # Update status to processing
        request_status[request_id] = {
            "status": "processing",
            "message": "Your request is being processed",
            "model_url": None,
        }

        # Decode base64 image
        image_bytes = base64.b64decode(image_data)

        # Save to temporary file
        temp_dir = os.path.join("/tmp", request_id)
        os.makedirs(temp_dir, exist_ok=True)
        temp_image_path = os.path.join(temp_dir, "input.png")
        with open(temp_image_path, "wb") as f:
            f.write(image_bytes)

        # Run workflow
        model_relative_path = run_workflow(request_id, temp_image_path)

        # Update status to completed
        model_url = f"/static/{model_relative_path}"
        request_status[request_id] = {
            "status": "completed",
            "message": "Your 3D model is ready",
            "model_url": model_url,
        }

        logger.info(
            f"Request {request_id} completed successfully. Model URL: {model_url}"
        )

        # Clean up temp files
        shutil.rmtree(temp_dir)

    except Exception as e:
        logger.error(f"Error processing request {request_id}: {e}")
        request_status[request_id] = {
            "status": "error",
            "message": f"Failed to generate model: {str(e)}",
            "model_url": None,
        }


# --- API Endpoints ---
@app.post("/generate", response_model=GenerationResponse)
async def generate_model(
    request: ImageRequest,
    background_tasks: BackgroundTasks,
    token: str = Depends(validate_token),
):
    """Generate a 3D model from an image."""
    request_id = request.id
    if not request_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Request ID is required"
        )

    # Initialize status
    request_status[request_id] = {
        "status": "queued",
        "message": "Your request has been queued",
        "model_url": None,
    }

    # Add background task
    background_tasks.add_task(process_request, request_id, request.image)

    return GenerationResponse(
        status="queued",
        message="Your request has been queued for processing",
        request_id=request_id,
    )


@app.get("/status/{request_id}", response_model=GenerationResponse)
async def get_status(request_id: str, token: str = Depends(validate_token)):
    """Check the status of a generation request."""
    if request_id not in request_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request ID {request_id} not found",
        )

    status_data = request_status[request_id]
    return GenerationResponse(
        status=status_data["status"],
        message=status_data["message"],
        model_url=status_data.get("model_url"),
        request_id=request_id,
    )


@app.get("/")
async def root():
    return {"message": "3D Model Generation API is running"}
