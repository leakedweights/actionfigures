import asyncio
import base64
import mimetypes
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

import httpx
import jwt
from dotenv import load_dotenv
from google import genai
from google.genai import types
from passlib.context import CryptContext
from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
)

load_dotenv()


class Base(DeclarativeBase):
    pass


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


# Database Models
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(unique=True, index=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    models = relationship(
        "Model3D", back_populates="owner", cascade="all, delete-orphan"
    )


class Model3D(Base):
    __tablename__ = "models"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reference_image_path: Mapped[Optional[str]] = mapped_column(nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    generated_2d_path: Mapped[Optional[str]] = mapped_column(nullable=True)
    generated_3d_path: Mapped[Optional[str]] = mapped_column(nullable=True)
    is_public: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    owner = relationship("User", back_populates="models")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        os.getenv(
            "SECRET_KEY", "your-secret-key-change-in-production-please-change-this"
        ),
        algorithm="HS256",
    )
    return encoded_jwt


def create_user(db: Session, username: str, email: str, password: str) -> User:
    hashed_password = get_password_hash(password)
    db_user = User(username=username, email=email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def create_model(db: Session, model_data: dict, user_id: int) -> Model3D:
    db_model = Model3D(**model_data, user_id=user_id)
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model


def get_models(
    db: Session, user_id: int, skip: int = 0, limit: int = 100
) -> List[Model3D]:
    return (
        db.query(Model3D)
        .filter(Model3D.user_id == user_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_model(
    db: Session, model_id: int, model_data: dict, user_id: int
) -> Optional[Model3D]:
    model = (
        db.query(Model3D)
        .filter(Model3D.id == model_id, Model3D.user_id == user_id)
        .first()
    )
    if model:
        for key, value in model_data.items():
            setattr(model, key, value)
        db.commit()
        db.refresh(model)
    return model


def delete_model(db: Session, model_id: int, user_id: int) -> bool:
    model = (
        db.query(Model3D)
        .filter(Model3D.id == model_id, Model3D.user_id == user_id)
        .first()
    )
    if model:
        db.delete(model)
        db.commit()
        return True
    return False


def save_binary_file(file_name, data):
    f = open(file_name, "wb")
    f.write(data)
    f.close()
    print(f"File saved to to: {file_name}")


SYSTEM_PROMPT = """
You are an expert 3D character designer.
Generate a realistic, stylized action figure on a plain white background.
Do not include any packaging, boxes, or text. The background must be white/transparent, without any shadows, so that the image can easily be converted to a 3D model.
Ensure the figure is the main focus, clearly visible, and fully contained within the frame.
High quality, detailed, 3D render style.
"""


async def generate_2d(
    prompt: str, base_image_b64: Optional[str] = None, output_dir: str = "uploads/2d"
):
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    model = "models/gemini-2.5-flash-image"

    final_prompt = f"{SYSTEM_PROMPT}\n\nUser Request: {prompt}"
    parts = [types.Part.from_text(text=final_prompt)]

    if base_image_b64:
        image_bytes = base64.b64decode(base_image_b64)
        parts.append(
            types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/png",
            )
        )

    contents = [
        types.Content(
            role="user",
            parts=parts,
        ),
    ]

    generate_content_config = types.GenerateContentConfig(
        response_modalities=[
            "IMAGE",
        ],
    )

    os.makedirs(output_dir, exist_ok=True)

    generated_files = []

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=generate_content_config,
    )

    if (
        response.candidates
        and response.candidates[0].content
        and response.candidates[0].content.parts
    ):
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.data:
                file_name = f"{uuid.uuid4()}"
                if part.inline_data.mime_type:
                    file_extension = (
                        mimetypes.guess_extension(part.inline_data.mime_type) or ".png"
                    )
                else:
                    file_extension = ".png"
                full_file_name = f"{file_name}{file_extension}"
                file_path = os.path.join(output_dir, full_file_name)

                save_binary_file(file_path, part.inline_data.data)
                generated_files.append(file_path)

    if not generated_files:
        raise Exception("No image generated")

    return generated_files[0]


MODEL_GENERATOR_URL = os.getenv("MODEL_GENERATOR_URL", "http://127.0.0.1:8001")
MODEL_GENERATOR_TOKEN = os.getenv("MODEL_GENERATOR_TOKEN", "my-secret-token-123")


async def generate_3d(image_path: str):
    """
    Generate a 3D model from an image using the local model generator service.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    with open(image_path, "rb") as f:
        image_bytes = f.read()
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    request_id = str(uuid.uuid4())

    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {MODEL_GENERATOR_TOKEN}"}
        payload = {"id": request_id, "image": image_b64}

        try:
            response = await client.post(
                f"{MODEL_GENERATOR_URL}/generate",
                json=payload,
                headers=headers,
                timeout=30.0,
            )
            response.raise_for_status()
        except httpx.HTTPError as e:
            print(f"Error submitting request: {e}")
            raise

        print(f"Request submitted. ID: {request_id}")

        max_retries = 60
        for _ in range(max_retries):
            await asyncio.sleep(2)

            try:
                status_response = await client.get(
                    f"{MODEL_GENERATOR_URL}/status/{request_id}",
                    headers=headers,
                    timeout=10.0,
                )
                status_response.raise_for_status()
                status_data = status_response.json()

                status = status_data.get("status")
                print(f"Status: {status}")

                if status == "completed":
                    model_url = status_data.get("model_url")
                    if model_url and model_url.startswith("/static/"):
                        model_url = model_url.replace("/static/", "/output/", 1)
                    return model_url

                if status == "error":
                    raise Exception(f"Generation failed: {status_data.get('message')}")

            except httpx.HTTPError as e:
                print(f"Error checking status: {e}")
                continue

        raise TimeoutError("Generation timed out")
