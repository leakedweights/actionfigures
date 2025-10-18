# ImgTo3D Action Figure Generator

## Local Setup

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
uv run -m backend.src.server
```