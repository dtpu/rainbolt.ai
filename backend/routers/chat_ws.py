import json
from urllib.parse import unquote

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from PIL import Image

from config import (
    FEATURE_MATCH_THRESHOLD,
    IMAGE_MATCH_THRESHOLD,
    MATCH_TOP_K,
    logger,
)
from pineconedb import query_pinecone_with_image
from reasoning import chat_with_context, estimate_coordinates, think
from routers.upload import UPLOAD_DIR
from security import origin_allowed, safe_session_id
from ws_manager import manager

router = APIRouter()


async def handle_chat_message(session_id: str, message_data: dict):
    """Answer a follow-up chat question against the session's uploaded image."""
    user_message = message_data.get("text", "")
    chat_history = message_data.get("history", [])
    chat_session_id = message_data.get("session_id", session_id)

    logger.info(f"Received chat message: {user_message}")

    # URL-decode the session ID to handle special characters, then strip to a
    # filesystem-safe token (prevents '../' path traversal into other sessions'
    # images or arbitrary files).
    decoded_session_id = safe_session_id(unquote(chat_session_id))
    logger.info(f"Decoded session_id: {decoded_session_id}")

    expected_file_path = UPLOAD_DIR / f"{decoded_session_id}.jpg"
    if not expected_file_path.exists():
        logger.error(f"Image file not found for session: {chat_session_id}")
        await manager.send_message(session_id, {
            "type": "error",
            "message": "Image file not found"
        })
        return

    file_path = expected_file_path

    try:
        image = Image.open(file_path)

        # Query Pinecone for context
        await manager.send_message(session_id, {
            "type": "status",
            "message": "Analyzing your question..."
        })

        image_matches = query_pinecone_with_image(image, top_k=MATCH_TOP_K, namespace="images", threshold=IMAGE_MATCH_THRESHOLD)
        feature_matches = query_pinecone_with_image(image, top_k=10, namespace="features", threshold=FEATURE_MATCH_THRESHOLD)

        # Build conversation context
        conversation_context = "\n\nPrevious Conversation:\n"
        for msg in chat_history:
            role = msg.get("role", "user")
            text = msg.get("text", "")
            conversation_context += f"{role.upper()}: {text}\n"

        # Stream response
        response_stream = chat_with_context(
            user_message,
            conversation_context,
            image_matches,
            feature_matches,
            image
        )

        response = ""
        for chunk in response_stream:
            response += chunk.content

        # Handle recalculation trigger
        if "__output__coordinates__" in response:
            response = response.replace("__output__coordinates__", "")
            await manager.send_message(session_id, {
                "type": "chat_response_coordinates",
                "text": "Calculating coordinates..."
            })

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
        logger.exception("Error processing chat")
        await manager.send_message(session_id, {
            "type": "error",
            "message": f"Error processing message: {str(e)}"
        })


async def handle_process_image(session_id: str, message_data: dict):
    """Run the full geolocation analysis pipeline on the session's image."""
    # URL-decode the session ID, then strip to a filesystem-safe token (same
    # path-traversal guard as the chat handler). Falls back to the connection's
    # already-sanitized id so a missing payload field can't raise.
    process_session_id = safe_session_id(unquote(message_data.get("session_id", session_id)))
    logger.info(f"Decoded session_id: {process_session_id}")

    file_path = UPLOAD_DIR / f"{process_session_id}.jpg"
    if not file_path.exists():
        error_msg = f"Image file not found: {file_path}"
        logger.error(error_msg)
        await manager.send_message(session_id, {
            "type": "error",
            "message": error_msg
        })
        return

    # Send thinking status
    await manager.send_message(session_id, {
        "type": "status",
        "message": "Analyzing image..."
    })

    try:
        image = Image.open(file_path)
        image_matches = query_pinecone_with_image(image, top_k=MATCH_TOP_K, namespace="images", threshold=IMAGE_MATCH_THRESHOLD)

        await manager.send_message(session_id, {
            "type": "status",
            "message": f"Found {len(image_matches)} similar images in the database."
        })

        # Query Pinecone for features
        await manager.send_message(session_id, {
            "type": "status",
            "message": "Detecting features..."
        })
        feature_matches = query_pinecone_with_image(image, top_k=MATCH_TOP_K, namespace="features", threshold=FEATURE_MATCH_THRESHOLD)

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


@router.websocket("/ws/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    # WebSockets bypass CORS entirely, so check the Origin header ourselves
    # before accepting, to keep random clients off the paid inference path.
    origin = websocket.headers.get("origin")
    if not origin_allowed(origin):
        logger.warning(f"Rejected WebSocket from disallowed origin: {origin!r}")
        await websocket.close(code=1008)  # policy violation
        return

    session_id = safe_session_id(session_id)
    await manager.connect(session_id, websocket)
    logger.info(f"WebSocket connected: {session_id}")
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            message_type = message_data.get("type")

            if message_type == "chat_message":
                await handle_chat_message(session_id, message_data)
                continue

            if message_type == "process_image":
                await handle_process_image(session_id, message_data)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {session_id}")
        manager.disconnect(session_id)
    except Exception:
        logger.exception(f"WebSocket error for {session_id}")
        manager.disconnect(session_id)
