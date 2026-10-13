from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db)
):
    existing_user = (
        db.query(User)
        .filter(User.email == data.email.lower())
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email is already registered."
        )

    user = User(
        name=data.name,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role="candidate"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "Account created successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }


@router.post("/login")
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.email == data.email.lower())
        .first()
    )

    if not user or not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    token = create_access_token(
        user.id,
        user.role
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    token_data = decode_access_token(token)

    if not token_data:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token."
        )

    user = (
        db.query(User)
        .filter(User.id == token_data["user_id"])
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found."
        )

    return user


def require_admin(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    return current_user