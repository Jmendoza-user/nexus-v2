"""
NEXUS V2.0 — OCR worker (FastAPI, best-effort).

Expone POST /ocr que recibe una imagen o PDF y devuelve el texto extraído.
Usa pytesseract (binario `tesseract`) si está disponible; si no, responde 501
con un mensaje claro para que el backend Node degrade con elegancia (pídele al
usuario que pegue el texto manualmente).

El core del motor financiero NO depende de este worker: es un acelerador opcional.

Arranque (solo cuando se necesite, NUNCA obligatorio en runtime):
    cd /root/nexus-v2/workers-py/ocr
    uvicorn main:app --host 127.0.0.1 --port 8120

Requisitos del sistema (deuda de infra documentada):
    apt-get install -y tesseract-ocr tesseract-ocr-spa poppler-utils
    pip install fastapi uvicorn pytesseract pillow pdf2image

Si falta el binario tesseract o las libs Python, /ocr responde 501 y /health
reporta available=false. NO se cae el proceso.
"""
from __future__ import annotations

import io
import shutil
import logging

try:
    from fastapi import FastAPI, UploadFile, File, HTTPException
    from fastapi.responses import JSONResponse
except Exception as exc:  # pragma: no cover - sin fastapi no se ejecuta
    raise SystemExit(
        "fastapi no instalado. pip install fastapi uvicorn pytesseract pillow pdf2image"
    ) from exc

logger = logging.getLogger("ocr-worker")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="NEXUS OCR Worker", version="0.1.0")


def _ocr_available() -> tuple[bool, str | None]:
    """¿Están pytesseract + binario tesseract presentes?"""
    if shutil.which("tesseract") is None:
        return False, "binario 'tesseract' no instalado (apt install tesseract-ocr)"
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401
    except Exception:
        return False, "libs Python no instaladas (pip install pytesseract pillow)"
    return True, None


@app.get("/health")
def health() -> dict:
    available, reason = _ocr_available()
    return {"ok": True, "service": "ocr-worker", "available": available, "reason": reason}


def _extract_image(data: bytes, lang: str) -> str:
    import pytesseract
    from PIL import Image

    img = Image.open(io.BytesIO(data))
    return pytesseract.image_to_string(img, lang=lang)


def _extract_pdf(data: bytes, lang: str) -> str:
    import pytesseract

    try:
        from pdf2image import convert_from_bytes
    except Exception:
        raise HTTPException(
            status_code=501,
            detail="Extracción de PDF requiere pdf2image + poppler-utils.",
        )
    pages = convert_from_bytes(data)
    return "\n".join(pytesseract.image_to_string(p, lang=lang) for p in pages)


@app.post("/ocr")
async def ocr(file: UploadFile = File(...), lang: str = "spa+eng") -> JSONResponse:
    available, reason = _ocr_available()
    if not available:
        # 501: el backend Node lo traduce a "sube el texto manualmente por ahora".
        return JSONResponse(
            status_code=501,
            content={"error": "OCR no disponible", "reason": reason},
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacío.")

    content_type = (file.content_type or "").lower()
    name = (file.filename or "").lower()
    try:
        if "pdf" in content_type or name.endswith(".pdf"):
            text = _extract_pdf(data, lang)
        else:
            text = _extract_image(data, lang)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.exception("fallo OCR")
        raise HTTPException(status_code=500, detail=f"Error de OCR: {exc}") from exc

    text = text.strip()
    return JSONResponse(
        status_code=200,
        content={"text": text, "chars": len(text), "lang": lang},
    )
