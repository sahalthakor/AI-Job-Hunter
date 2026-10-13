from pathlib import Path

from pypdf import PdfReader
from docx import Document


def extract_pdf_text(file_path: Path) -> str:

    reader = PdfReader(str(file_path))

    pages = []

    for page in reader.pages:
        text = page.extract_text()

        if text:
            pages.append(text)

    return "\n".join(pages)


def extract_docx_text(file_path: Path) -> str:

    document = Document(str(file_path))

    paragraphs = []

    for paragraph in document.paragraphs:

        if paragraph.text.strip():
            paragraphs.append(paragraph.text)

    return "\n".join(paragraphs)


def extract_resume_text(file_path: Path) -> str:

    extension = file_path.suffix.lower()

    if extension == ".pdf":
        return extract_pdf_text(file_path)

    if extension == ".docx":
        return extract_docx_text(file_path)

    if extension == ".doc":
        raise ValueError(
            "Old .doc files are not supported yet. "
            "Please convert the file to .docx or PDF."
        )

    raise ValueError("Unsupported file type.")