from fastapi import WebSocket
from typing import List, Dict
import json
import uuid

class ConnectionManager:
    def __init__(self):
        # Map user_id to a list of active websocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self._listen_task = None

    @property
    def listen_task(self):
        return self._listen_task

    async def connect_redis(self):
        # Redis connection hook (mocked to prevent startup failure)
        pass

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_text(message)

    async def broadcast(self, message: str):
        for connections in self.active_connections.values():
            for connection in connections:
                await connection.send_text(message)

manager = ConnectionManager()
