import base64
import os
import shutil
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

import jwt
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from google.genai.errors import ClientError
from pydantic import BaseModel, EmailStr
from sqlalchemy import (
    create_engine,
)
from sqlalchemy.orm import Session, sessionmaker

from .modeling import (
    Base,
    Model3D,
    User,
    create_access_token,
    create_model,
    create_user,
    delete_model,
    generate_2d,
    generate_3d,
    get_models,
    get_user_by_email,
    update_model,
    verify_password,
)

# Configuration
SECRET_KEY = str(
    os.getenv("SECRET_KEY", "your-secret-key-change-in-production-please-change-this")
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
DATABASE_URL = "sqlite:///./imgto3d.db"
UPLOAD_DIR = Path("uploads/models")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_2D_DIR = Path("uploads/2d")
UPLOAD_2D_DIR.mkdir(parents=True, exist_ok=True)

# Database setup
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)


# Pydantic Schemas
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class Model3DCreate(BaseModel):
    reference_image_path: Optional[str] = None
    instructions: Optional[str] = None
    generated_2d_path: Optional[str] = None
    generated_3d_path: Optional[str] = None
    is_public: Optional[bool] = False


class Model3DResponse(BaseModel):
    id: int
    user_id: int
    reference_image_path: Optional[str]
    instructions: Optional[str]
    generated_2d_path: Optional[str]
    generated_3d_path: Optional[str]
    is_public: bool
    created_at: datetime
    owner: Optional[UserResponse] = None

    class Config:
        from_attributes = True


# FastAPI app
app = FastAPI(title="imgto3d API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for public hosting
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/output", StaticFiles(directory="output"), name="output")


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
        )
    except (
        jwt.InvalidTokenError
    ):  # Changed from jwt.JWTError to jwt.InvalidTokenError for more specific handling
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


# Security
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    user_id_str: Optional[str] = payload.get("sub")

    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    return user


# API Endpoints


@app.get("/")
def root():
    return {"message": "imgto3d API is running"}


@app.post(
    "/api/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check if username exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # Check if email exists
    if get_user_by_email(db, user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user
    return create_user(db, user_data.username, user_data.email, user_data.password)


@app.post("/api/auth/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    # Find user by email
    user = get_user_by_email(db, user_data.email)

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post(
    "/api/models", response_model=Model3DResponse, status_code=status.HTTP_201_CREATED
)
def create_model_endpoint(
    model_data: Model3DCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_model(
        db,
        model_data.dict(exclude_unset=True),
        current_user.id,
    )


@app.get("/api/models", response_model=List[Model3DResponse])
def get_models_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    models = get_models(db, current_user.id, skip, limit)

    # Normalize legacy URLs
    for model in models:
        if model.generated_3d_path:
            # Fix old localhost:8001 URLs
            if "localhost:8001" in model.generated_3d_path:
                model.generated_3d_path = model.generated_3d_path.split("/static/")[-1]
                model.generated_3d_path = f"/output/{model.generated_3d_path}"
            # Fix /static/ URLs
            elif model.generated_3d_path.startswith("/static/"):
                model.generated_3d_path = model.generated_3d_path.replace(
                    "/static/", "/output/", 1
                )

    return models


@app.get("/api/models/{model_id}", response_model=Model3DResponse)
def get_model(
    model_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    model = (
        db.query(Model3D)
        .filter(Model3D.id == model_id, Model3D.user_id == current_user.id)
        .first()
    )

    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Model not found"
        )

    return model


@app.delete("/api/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_model_endpoint(
    model_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not delete_model(db, model_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Model not found"
        )
    return None


@app.put("/api/models/{model_id}", response_model=Model3DResponse)
def update_model_endpoint(
    model_id: int,
    model_data: Model3DCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = update_model(
        db, model_id, model_data.dict(exclude_unset=True), current_user.id
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Model not found"
        )
    return updated


@app.get("/api/public/models", response_model=List[Model3DResponse])
def get_public_models(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Model3D).join(User).filter(Model3D.is_public.is_(True))

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Model3D.instructions.ilike(search_term))
            | (Model3D.reference_image_path.ilike(search_term))
            | (User.username.ilike(search_term))
        )

    models = query.order_by(Model3D.created_at.desc()).offset(skip).limit(limit).all()
    return models


@app.post(
    "/api/generate", response_model=Model3DResponse, status_code=status.HTTP_201_CREATED
)
async def generate_model_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Save uploaded file
    filename = file.filename or "upload.png"
    file_ext = os.path.splitext(filename)[1]
    if not file_ext:
        file_ext = ".png"  # Default to png if no extension

    file_name = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / file_name

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Generate 3D model
    try:
        model_url = await generate_3d(str(file_path))
    except Exception as e:
        # Cleanup uploaded file on failure
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

    # Create DB record
    return create_model(
        db,
        {
            "reference_image_path": str(file_path),
            "generated_3d_path": model_url,
        },
        current_user.id,
    )


@app.post("/api/generate-2d")
async def generate_2d_endpoint(
    instructions: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
):
    base_image_b64 = None
    if file:
        file_content = await file.read()
        base_image_b64 = base64.b64encode(file_content).decode("utf-8")

    try:
        # Generate 2D image
        file_path = await generate_2d(
            prompt=instructions,
            base_image_b64=base_image_b64,
            output_dir=str(UPLOAD_2D_DIR),
        )

        # Return URL relative to server
        # Assuming we mount uploads dir or similar.
        # Let's mount uploads dir to serve static files.
        relative_path = os.path.relpath(file_path, ".")
        return {"image_url": f"/{relative_path}"}

    except ClientError as e:
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=e.code, detail=e.message)
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(f"Error generating 2D image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
