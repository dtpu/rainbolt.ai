from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from pathlib import Path
from PIL import Image
import io
from typing import List, Dict, Optional
import json
import asyncio
import logging
from urllib.parse import unquote
from pineconedb import query_pinecone_with_image
from reasoning import think, estimate_coordinates
from mapillary import get_mapillary_images

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://rainboltai.gay", "https://www.rainbolt.ai"],  # Adjust as needed
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"]
)

#websocket tracking 

class Manager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id] = websocket
    
    async def send_message(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_json(message)

manager = Manager()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Set directory permissions to be readable/writable by all (755)
os.chmod(UPLOAD_DIR, 0o755)

logger.info(f"UPLOAD_DIR set to: {UPLOAD_DIR}")
logger.info(f"Current working directory: {os.getcwd()}")
logger.info(f"UPLOAD_DIR permissions: {oct(os.stat(UPLOAD_DIR).st_mode)[-3:]}")

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post("/upload-image/{session_id}")
async def upload_image(session_id: str, file: UploadFile = File(...)):
    """
    Upload and process an image file - returns session ID for WebSocket connection
    Session ID is passed as a path parameter
    """
    logger.info(f"=== UPLOAD IMAGE REQUEST ===")
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
        
        # Create file with open permissions from the start
        # Use os.open with explicit permissions to avoid umask issues
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


class MapillaryRequest(BaseModel):
    latitude: float
    longitude: float
    radius: float = 0.003
    limit: int = 5


@app.post("/api/mapillary-images")
async def get_mapillary_images_endpoint(request: MapillaryRequest):
    """
    Fetch Mapillary street view images for given coordinates
    """
    try:
        images = get_mapillary_images(
            lat=request.latitude,
            lon=request.longitude,
            radius=request.radius,
            limit=request.limit
        )
        return {
            "success": True,
            "images": images,
            "count": len(images)
        }
    except Exception as e:
        print(f"Error fetching Mapillary images: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching Mapillary images: {str(e)}")


@app.websocket("/ws/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)
    print(f"WebSocket connected: {session_id}")
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received data: {data}")
            message_data = json.loads(data)
            
            message_type = message_data.get("type")
            
            # Handle user chat messages
            if message_type == "chat_message":
                user_message = message_data.get("text", "")
                chat_history = message_data.get("history", [])
                chat_session_id = message_data.get("session_id", session_id)
                
                print(f"Received chat message: {user_message}")
                
                # URL-decode the session ID to handle special characters
                decoded_session_id = unquote(chat_session_id)
                logger.info(f"Original session_id: {chat_session_id}")
                logger.info(f"Decoded session_id: {decoded_session_id}")
                
                # Construct the expected file path directly
                expected_file_path = UPLOAD_DIR / f"{decoded_session_id}.jpg"
                logger.info(f"Looking for image file: {expected_file_path}")
                logger.info(f"File exists check: {expected_file_path.exists()}")
                
                if not expected_file_path.exists():
                    logger.error(f"Image file not found for session: {chat_session_id}")
                    logger.error(f"Expected path: {expected_file_path}")
                    logger.error(f"UPLOAD_DIR: {UPLOAD_DIR}")
                    logger.error(f"UPLOAD_DIR exists: {UPLOAD_DIR.exists()}")
                    logger.error(f"UPLOAD_DIR is readable: {os.access(UPLOAD_DIR, os.R_OK)}")
                    try:
                        logger.error(f"Available files in {UPLOAD_DIR}: {list(UPLOAD_DIR.iterdir())}")
                    except Exception as e:
                        logger.error(f"Cannot list directory contents: {e}")
                    await manager.send_message(session_id, {
                        "type": "error",
                        "message": "Image file not found"
                    })
                    continue
                
                file_path = expected_file_path
                
                try:
                    # Load the image
                    image = Image.open(file_path)
                    
                    # Query Pinecone for context
                    await manager.send_message(session_id, {
                        "type": "status",
                        "message": "Analyzing your question..."
                    })

                    image_matches = query_pinecone_with_image(image, top_k=25, namespace="images", threshold=0.7)
                    feature_matches = query_pinecone_with_image(image, top_k=10, namespace="features", threshold=0.22)

                    # Build conversation context
                    conversation_context = "\n\nPrevious Conversation:\n"
                    for msg in chat_history:
                        role = msg.get("role", "user")
                        text = msg.get("text", "")
                        conversation_context += f"{role.upper()}: {text}\n"
                    
                    # Stream response
                    from reasoning import chat_with_context
                    response_stream = chat_with_context(
                        user_message, 
                        conversation_context,
                        image_matches, 
                        feature_matches, 
                        image
                    )
                    
                    # Append chunks to full response
                    response = ""
                    for chunk in response_stream:
                        chunk_text = chunk.content
                        response += chunk_text

                    # Handle recalculation trigger
                    if "__output__coordinates__" in response:
                        response = response.replace("__output__coordinates__", "")
                        await manager.send_message(session_id, {
                            "type": "chat_response_coordinates", 
                            "text": "Rex`   calculating coordinates..."
                        })
                        
                        # Recalculate coordinates
                        new_coords = estimate_coordinates(response)
                        await manager.send_message(session_id, {
                            "type": "coordinates",
                            "text": new_coords
                        })

                    await manager.send_message(session_id, {
                        "type": "chat_response_chunk",
                        "text": response
                    })

                    await manager.send_message(session_id, {
                        "type": "complete",
                        "message": "Response complete"
                    })
                    
                except Exception as e:
                    print(f"Error processing chat: {e}")
                    import traceback
                    traceback.print_exc()
                    await manager.send_message(session_id, {
                        "type": "error",
                        "message": f"Error processing message: {str(e)}"
                    })
                continue
            
            # Check if this is an image processing request
            if message_type == "process_image":
                # URL-decode the session ID to handle special characters
                process_session_id = unquote(message_data.get('session_id'))
                logger.info(f"Original session_id: {message_data.get('session_id')}")
                logger.info(f"Decoded session_id: {process_session_id}")
                
                file_path = UPLOAD_DIR / f"{process_session_id}.jpg"
                logger.info(f"Processing image request for: {file_path}")
                logger.info(f"File exists: {file_path.exists()}")
                logger.info(f"UPLOAD_DIR contents: {list(UPLOAD_DIR.iterdir())}")
                
                if not file_path.exists():
                    error_msg = f"Image file not found: {file_path}"
                    logger.error(error_msg)
                    logger.error(f"Available files in {UPLOAD_DIR}: {list(UPLOAD_DIR.iterdir())}")
                    await manager.send_message(session_id, {
                        "type": "error",
                        "message": error_msg
                    })
                    continue
                
                # Send thinking status
                await manager.send_message(session_id, {
                    "type": "status",
                    "message": "Analyzing image..."
                })
                
                try:
                    # Load the image
                    image = Image.open(file_path)
                    image_matches = query_pinecone_with_image(image, top_k=25, namespace="images", threshold=0.7)
                    
                    await manager.send_message(session_id, {
                        "type": "status",
                        "message": f"Found {len(image_matches)} similar images in the database."
                    })

                    # Query Pinecone for features
                    await manager.send_message(session_id, {
                        "type": "status",
                        "message": "Detecting features..."
                    })
                    feature_matches = query_pinecone_with_image(image, top_k=25, namespace="features", threshold=0.22)

                    # Start reasoning process
                    await manager.send_message(session_id, {
                        "type": "status",
                        "message": "Analyzing location details..."
                    })
                    
                    # Stream thinking process
                    reasoning_text = ""
                    thinking_stream = think(image_matches, feature_matches, image)
                    
                    for chunk in thinking_stream:
                        chunk_text = chunk.content
                        reasoning_text += chunk_text
                        await manager.send_message(session_id, {
                            "type": "reasoning_chunk",
                            "text": chunk_text
                        })
                    
                    # Estimate coordinates
                    await manager.send_message(session_id, {
                        "type": "status",
                        "message": "Calculating final coordinates..."
                    })
                    
                    coordinates = estimate_coordinates(reasoning_text)
                    
                    await manager.send_message(session_id, {
                        "type": "coordinates",
                        "text": coordinates
                    })
                    
                    # Send completion message
                    await manager.send_message(session_id, {
                        "type": "complete",
                        "message": "Analysis complete"
                    })
                    
                except Exception as e:
                    await manager.send_message(session_id, {
                        "type": "error",
                        "message": f"Error processing image: {str(e)}"
                    })



    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {session_id}")
        manager.disconnect(session_id)
    except Exception as e:
        print(f"WebSocket error for {session_id}: {e}")
        import traceback
        traceback.print_exc()
        manager.disconnect(session_id)



