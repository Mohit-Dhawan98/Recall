from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import secrets

from app.database import get_db
from app.models import User
from app.schemas import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Default user ID for simple single-user setup
DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


async def get_current_user(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current user from API key or use default user."""
    api_key = x_api_key

    # Also check Authorization header (Bearer token)
    if not api_key and authorization:
        if authorization.startswith("Bearer "):
            api_key = authorization[7:]

    if api_key and api_key != "default-api-key":
        # Look up user by API key
        stmt = select(User).where(User.api_key == api_key)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            return user

    # Fall back to default user (for simple single-user setups)
    stmt = select(User).where(User.api_key == "default-api-key")
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Create default user if doesn't exist
        user = User(
            api_key="default-api-key",
            settings={}
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        api_key=current_user.api_key,
        created_at=current_user.created_at,
        settings=current_user.settings or {}
    )


@router.post("/api-key")
async def generate_api_key(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a new API key for the current user."""
    new_key = f"recall_{secrets.token_urlsafe(32)}"
    current_user.api_key = new_key
    await db.commit()

    return {"api_key": new_key}


@router.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}
