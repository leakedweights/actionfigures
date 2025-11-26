# ImgTo3D Action Figure Generator

A full-stack application that generates 3D action figure models from 2D images or text prompts using AI.

## 🚀 Quick Start (Docker)

The easiest way to run the application is using Docker.

1.  **Clone the repository**
2.  **Environment Setup**
    Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
    Edit `.env` and add your API keys:
    - `GEMINI_API_KEY`: For 2D image generation (Google Gemini)
    - `API_SECRET_KEY`: For JWT signing (can be any random string for local dev)
    - `MODEL_GENERATOR_TOKEN`: Optional, for ComfyUI security

3.  **Run with Docker Compose**
    ```bash
    docker compose up --build
    ```
    This starts all services:
    - **Frontend**: http://localhost:3000
    - **Backend**: http://localhost:8000
    - **ComfyUI**: http://localhost:8188

    **Note on CUDA**: By default, it uses CUDA 12.8. To use CUDA 12.1:
    ```bash
    CUDA_VERSION=12.1 docker compose up --build
    ```

## 🛠️ Tech Stack

### Frontend
- **React 19**: UI Library
- **Vite**: Build tool
- **Tailwind CSS 4**: Styling
- **Three.js**: 3D Rendering

### Backend
- **FastAPI**: Python web framework
- **SQLAlchemy**: ORM with SQLite database
- **Google GenAI**: For text-to-image generation
- **Fal Client**: For external model inference (if used)

### Model Generator
- **ComfyUI**: Node-based stable diffusion/3D generation pipeline

## 📂 Project Structure

- `frontend/`: React application source code
- `backend/`: FastAPI application, database models, and API logic
- `model_generator/`: ComfyUI configuration and custom nodes
- `docker-compose.yml`: Orchestration for all services

## ✨ Functionalities

- **Authentication**: User registration and login.
- **2D Generation**: Generate reference images from text prompts using Gemini.
- **3D Generation**: Convert 2D images into 3D GLB models.
- **Model Library**: Save, view, and manage your generated models.
- **Public Gallery**: View models shared by other users.

## 🔌 API Usage

Here are some common API examples.

### 1. Login (Get Access Token)
```bash
curl -X POST "http://localhost:8000/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "password123"}'
```

### 2. Generate 3D Model
```bash
curl -X POST "http://localhost:8000/api/generate" \
     -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
     -F "file=@/path/to/image.png"
```

### 3. List My Models
```bash
curl -X GET "http://localhost:8000/api/models" \
     -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

### 4. Generate 2D Image
```bash
curl -X POST "http://localhost:8000/api/generate-2d" \
     -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
     -F "instructions=A futuristic robot action figure"
```