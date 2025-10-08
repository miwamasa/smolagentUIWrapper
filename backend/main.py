from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import json
import asyncio
from pathlib import Path
from agent_wrapper import AgentWrapper
from output_parser import OutputParser

app = FastAPI()

# Static files serving
frontend_path = Path(__file__).parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")

# Initialize agent wrapper and output parser
agent_wrapper = AgentWrapper()
output_parser = OutputParser()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))

manager = ConnectionManager()


@app.get("/")
async def get():
    """Serve the frontend HTML"""
    html_file = frontend_path / "index.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text())
    return HTMLResponse(content="<h1>Frontend not found</h1>")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for chat communication"""
    await manager.connect(websocket)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)

            user_message = message_data.get("message", "")

            # Echo user message back to confirm receipt
            await manager.send_message({
                "type": "user_message",
                "content": user_message
            }, websocket)

            # Process with agent
            try:
                # Run agent and get response
                agent_response = await agent_wrapper.run(user_message)

                # Parse the response to determine output type
                parsed_outputs = output_parser.parse(agent_response)

                # Send debug information (parser results)
                await manager.send_message({
                    "type": "debug",
                    "content": {
                        "agent_response": agent_response,
                        "parsed_outputs": parsed_outputs,
                        "output_count": len(parsed_outputs)
                    }
                }, websocket)

                # Send each output to appropriate pane
                for output in parsed_outputs:
                    await manager.send_message(output, websocket)

            except Exception as e:
                # Send error message
                await manager.send_message({
                    "type": "error",
                    "content": f"Error processing request: {str(e)}"
                }, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
