import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, relationship, sessionmaker

# Configuration
SECRET_KEY = str(
    os.getenv("SECRET_KEY", "your-secret-key-change-in-production-please-change-this")
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
DATABASE_URL = "sqlite:///./imgto3d.db"
UPLOAD_DIR = Path("uploads/models")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Database setup
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# Security
security = HTTPBearer()


# Database Models
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    models = relationship(
        "Model3D", back_populates="owner", cascade="all, delete-orphan"
    )


class Model3D(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reference_image_path = Column(String, nullable=True)
    instructions = Column(Text, nullable=True)
    generated_2d_path = Column(String, nullable=True)
    generated_3d_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="models")


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


class Model3DResponse(BaseModel):
    id: int
    user_id: int
    reference_image_path: Optional[str]
    instructions: Optional[str]
    generated_2d_path: Optional[str]
    generated_3d_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# FastAPI app
app = FastAPI(title="imgto3d API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Auth utilities
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    user_id_str: str = payload.get("sub")

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
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@app.post("/api/auth/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()

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
def create_model(
    model_data: Model3DCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_model = Model3D(
        user_id=current_user.id,
        reference_image_path=model_data.reference_image_path,
        instructions=model_data.instructions,
        generated_2d_path=model_data.generated_2d_path,
        generated_3d_path=model_data.generated_3d_path,
    )

    db.add(new_model)
    db.commit()
    db.refresh(new_model)

    return new_model


@app.get("/api/models", response_model=List[Model3DResponse])
def get_models(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    models = (
        db.query(Model3D)
        .filter(Model3D.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .all()
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
def delete_model(
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

    # Delete associated files if they exist
    for path in [
        model.reference_image_path,
        model.generated_2d_path,
        model.generated_3d_path,
    ]:
        if path and os.path.exists(path):
            os.remove(path)

    db.delete(model)
    db.commit()

    return None


@app.put("/api/models/{model_id}", response_model=Model3DResponse)
def update_model(
    model_id: int,
    model_data: Model3DCreate,
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

    # Update fields
    if model_data.reference_image_path is not None:
        model.reference_image_path = model_data.reference_image_path
    if model_data.instructions is not None:
        model.instructions = model_data.instructions
    if model_data.generated_2d_path is not None:
        model.generated_2d_path = model_data.generated_2d_path
    if model_data.generated_3d_path is not None:
        model.generated_3d_path = model_data.generated_3d_path

    db.commit()
    db.refresh(model)

    return model


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
