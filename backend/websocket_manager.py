import asyncio
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
from .config import settings

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Maps user_id (str) to a set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.redis: aioredis.Redis = None
        self.pubsub = None
        self.listen_task = None

    async def connect_redis(self):
        try:
            self.redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            self.pubsub = self.redis.pubsub()
            # We subscribe to a global notifications channel pattern
            await self.pubsub.psubscribe("notifications:*")
            self.listen_task = asyncio.create_task(self._listen_to_redis())
            logger.info("WebSocketManager connected to Redis Pub/Sub successfully.")
        except Exception as e:
            logger.error(f"Failed to connect to Redis Pub/Sub: {e}")

    async def _listen_to_redis(self):
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"]
                    data = message["data"]
                    # Channel format: notifications:{user_id}
                    parts = channel.split(":")
                    if len(parts) >= 2:
                        user_id = parts[1]
                        if user_id == "broadcast":
                            await self.broadcast(data)
                        else:
                            await self.send_personal_message(data, user_id)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in Redis listener: {e}")

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.debug(f"User {user_id} connected. Active connections: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.debug(f"User {user_id} disconnected.")

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            dead_sockets = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.warning(f"Error sending to a socket for {user_id}, marking for removal: {e}")
                    dead_sockets.add(connection)
            
            for dead in dead_sockets:
                self.disconnect(dead, user_id)

    async def broadcast(self, message: str):
        for user_id, connections in list(self.active_connections.items()):
            await self.send_personal_message(message, user_id)

    async def publish_notification(self, user_id: str, payload: dict):
        """
        Used by the notification engine to push to Redis.
        Redis then routes it to all Uvicorn workers, hitting `_listen_to_redis`.
        """
        if self.redis:
            channel = f"notifications:{user_id}"
            await self.redis.publish(channel, json.dumps(payload))
        else:
            # Fallback if Redis is down, just send locally
            await self.send_personal_message(json.dumps(payload), user_id)


manager = ConnectionManager()
