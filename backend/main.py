from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import json
import asyncio
from pathlib import Path
from agent_wrapper import AgentWrapper
from output_parser import OutputParser
from map_manager import MapManager

app = FastAPI()

# Static files serving
frontend_path = Path(__file__).parent.parent / "frontend"
backend_path = Path(__file__).parent
app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")
app.mount("/backend", StaticFiles(directory=str(backend_path)), name="backend")

# Initialize components
agent_wrapper = AgentWrapper()
output_parser = OutputParser()

# Initialize map manager and load map definition
data_dir = backend_path / "data"
map_manager = MapManager(data_dir)
try:
    map_manager.load_legacy_data(
        floor_image="OSM_floor.png",
        rectangles_json="OSM_floor-plan-rectangles.json",
        floor_id="1F",
        floor_name="1階"
    )
    print("Map definition loaded successfully")
except Exception as e:
    print(f"Error loading map definition: {e}")
    map_manager = None

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

    # Send map definition immediately after connection
    if map_manager and map_manager.map_definition:
        try:
            map_def_msg = map_manager.get_map_definition_message()
            await manager.send_message(map_def_msg, websocket)
            print("Map definition sent to client")
        except Exception as e:
            print(f"Error sending map definition: {e}")

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

                # Generate and send Phase 2.0 unified response
                unified_response = output_parser.generate_unified_response(agent_response, parsed_outputs)

                # Display Phase 2.0 unified response in console for verification
                print("\n" + "="*70)
                print("📋 Phase 2.0 統一レスポンス (Unified Response)")
                print("="*70)
                print(json.dumps(unified_response, ensure_ascii=False, indent=2))
                print("="*70 + "\n")

                await manager.send_message({
                    "type": "unified_response",
                    "content": unified_response
                }, websocket)

                # Send each output to appropriate pane (backward compatibility)
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
