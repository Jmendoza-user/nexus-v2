# OCR worker — NEXUS V2.0 (best-effort)

FastAPI mínimo que extrae texto de imágenes/PDF con Tesseract. El motor
financiero **no depende** de este worker: si no está disponible, el backend
degrada pidiendo al usuario que pegue el texto manualmente.

## Endpoints
- `GET /health` → `{ ok, available, reason }`. `available=false` si falta tesseract/libs.
- `POST /ocr` (multipart, campo `file`, query `lang=spa+eng`) → `{ text, chars, lang }`.
  - `501` si OCR no está disponible (binario o libs ausentes).

## Estado actual
`available=false` en este VPS: el binario `tesseract` y las libs Python no están
instalados. El backend ya lo maneja (mensaje claro al usuario).

## Activación (deuda de infra)
```bash
apt-get install -y tesseract-ocr tesseract-ocr-spa poppler-utils   # binario + español
cd /root/nexus-v2/workers-py/ocr
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8120
```
Luego setear en el backend `OCR_WORKER_URL=http://127.0.0.1:8120/ocr`.
NO se levanta en runtime obligatorio: el backend prueba el worker y degrada si
no responde.
