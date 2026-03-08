import os
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    MONGODB_URI = os.getenv("DATABASE_URL", "mongodb://localhost:27017/circlk")
    MONGODB_DB_NAME = os.getenv(
        "MONGODB_DB_NAME", (urlparse(MONGODB_URI).path or "/circlk").lstrip("/") or "circlk"
    )
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ]
    PLATFORM_FEE_PERCENT = float(os.getenv("PLATFORM_FEE_PERCENT", "5.0"))
