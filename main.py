
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import json
import asyncio
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.getenv("API_KEY")
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash-lite-latest')

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.user_profiles: dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.user_profiles:
            del self.user_profiles[client_id]

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_text(json.dumps(message))

    async def send_personal(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(json.dumps(message))

manager = ConnectionManager()

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            # User Joined / Update Profile
            if msg.get("type") == "join":
                manager.user_profiles[client_id] = msg.get("profile")
                await manager.broadcast({
                    "type": "presence_update",
                    "users": list(manager.user_profiles.values())
                })

            # Targeted Signaling (Video Calls)
            elif msg.get("type") == "signal":
                target_id = msg.get("targetId")
                if target_id in manager.active_connections:
                    await manager.send_personal({
                        "type": "signal",
                        "from": client_id,
                        "data": msg.get("data")
                    }, target_id)

            # Global Chat Message
            elif msg.get("type") == "chat_broadcast":
                await manager.broadcast({
                    "type": "new_message",
                    "message": msg.get("message")
                })

            # AI Request
            elif msg.get("type") == "ai_request":
                prompt = msg.get("text")
                await manager.send_personal({"type": "typing", "status": True}, client_id)
                try:
                    response = model.generate_content(prompt)
                    await manager.send_personal({
                        "type": "ai_response",
                        "text": response.text,
                        "senderId": "ai-gemini"
                    }, client_id)
                except Exception as e:
                    await manager.send_personal({"type": "ai_response", "text": "AI connection error..."}, client_id)

    except WebSocketDisconnect:
        manager.disconnect(client_id)
        await manager.broadcast({
            "type": "presence_update",
            "users": list(manager.user_profiles.values())
        })

@app.get("/")
async def root():
    return {"status": "Aurora Engine Online", "active_users": len(manager.active_connections)}
