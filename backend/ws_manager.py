from typing import Dict

from fastapi import WebSocket


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


# Single shared connection manager. Importing this name (rather than
# re-instantiating Manager per module) keeps every router pointing at the same
# active_connections map, so live sockets stay reachable.
manager = Manager()
