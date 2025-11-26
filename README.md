# ImgTo3D Action Figure Generator

## Docker Setup (Recommended)

Run the full stack (Frontend, Backend, Model Generator) with a single command:

```bash
docker compose up --build
```

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000
- **ComfyUI**: http://localhost:8188

### CUDA Version Configuration

By default, the model generator uses CUDA 12.8. To éarogjt. use CUDA 12.1 instead:

```bash
CUDA_VERSION=12.1 docker compose up --build
```

Or add to your `.env` file:
```
CUDA_VERSION=12.1
```

## Local Setup (Legacy)

### Frontend

Start development server

```bash
cd frontend
npm i
npm run dev
```

### Backend

Install (`uv`)[https://docs.astral.sh/uv/]:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Start FastAPI server:

```bash
cd backend
uv run -m src.server
```