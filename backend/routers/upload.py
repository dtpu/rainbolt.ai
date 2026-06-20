import io
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image

from config import logger
from security import require_internal_key, safe_session_id

# Upload directory setup lives on the app request path (this module is only
# imported when the FastAPI app loads), so offline scripts like ingest.py never
# trigger the mkdir/chmod side-effect.
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
os.chmod(UPLOAD_DIR, 0o755)
logger.info(f"UPLOAD_DIR ready at {UPLOAD_DIR} (cwd {os.getcwd()})")

router = APIRouter()


@router.post("/upload-image/{session_id}")
async def upload_image(session_id: str, file: UploadFile = File(...), _: None = Depends(require_internal_key)):
    """
    Upload and process an image file - returns session ID for WebSocket connection
    Session ID is passed as a path parameter
    """
    session_id = safe_session_id(session_id)
    logger.info("=== UPLOAD IMAGE REQUEST ===")
    logger.info(f"Received session_id from path: {session_id}")

    # Check if file is an image
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Check file size (limit to 10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=400, detail="File too large")

    try:
        image = Image.open(io.BytesIO(contents))
        width, height = image.size

        # Save the file with session ID as name
        new_filename = f"{session_id}.jpg"
        file_path = UPLOAD_DIR / new_filename

        logger.info(f"Saving file to: {file_path}")

        # Create file with open permissions from the start.
        # Use os.open with explicit permissions to avoid umask issues.
        fd = os.open(file_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o666)
        try:
            os.write(fd, contents)
        finally:
            os.close(fd)

        # Ensure permissions are set correctly
        os.chmod(file_path, 0o666)

        logger.info(f"File saved successfully. Exists: {file_path.exists()}")

        return {
            "message": "Image uploaded successfully",
            "session_id": session_id,
            "filename": new_filename,
            "original_filename": file.filename,
            "size": len(contents),
            "dimensions": {"width": width, "height": height},
            "format": image.format,
            "file_path": str(file_path)
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
