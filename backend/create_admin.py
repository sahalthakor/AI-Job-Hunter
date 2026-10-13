from dotenv import load_dotenv

load_dotenv(override=True)

from app.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password


db = SessionLocal()

try:
    email = input("Enter admin email: ").strip().lower()
    password = input("Enter admin password: ").strip()

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        existing_user.role = "admin"
        existing_user.password_hash = hash_password(password)
        db.commit()

        print("Existing account promoted to ADMIN.")
    else:
        name = input("Enter admin name: ").strip()

        admin = User(
            name=name,
            email=email,
            password_hash=hash_password(password),
            role="admin"
        )

        db.add(admin)
        db.commit()

        print("Admin account created successfully.")

finally:
    db.close()