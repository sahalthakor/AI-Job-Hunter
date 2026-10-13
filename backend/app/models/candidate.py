from sqlalchemy import Column, Integer, String, JSON

from app.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # The owner of this resume/profile
    user_id = Column(
        Integer,
        nullable=False,
        index=True
    )

    # Filename shown to the user
    resume_filename = Column(
        String(255),
        nullable=True
    )

    # Actual random filename stored on the server
    resume_storage_name = Column(
        String(255),
        nullable=True
    )

    name = Column(
        String(200),
        nullable=False
    )

    email = Column(
        String(200),
        nullable=True
    )

    phone = Column(
        String(50),
        nullable=True
    )

    headline = Column(
        String(300),
        nullable=True
    )

    skills = Column(
        JSON,
        nullable=False,
        default=list
    )

    education = Column(
        JSON,
        nullable=False,
        default=list
    )

    experience = Column(
        JSON,
        nullable=False,
        default=list
    )

    projects = Column(
        JSON,
        nullable=False,
        default=list
    )

    certifications = Column(
        JSON,
        nullable=False,
        default=list
    )

    preferred_roles = Column(
        JSON,
        nullable=False,
        default=list
    )

    preferred_locations = Column(
        JSON,
        nullable=False,
        default=list
    )