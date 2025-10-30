"""
Agent wrapper for smolagent integration.
Provides a simple interface to run smolagent and capture outputs.
"""

import asyncio
from typing import Dict, List, Any
import io
import sys
from pathlib import Path
from dotenv import load_dotenv 
from smolagents import CodeAgent, LiteLLMModel, tool, GradioUI
import os
import pandas as pd
import seaborn as sns
from sqlalchemy import (
    Column,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    insert,
    inspect,
    text,
)

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine, Column, Integer, String, Float,Text,DateTime
from sqlalchemy import create_engine

engine = None

Base = declarative_base()
class Measurement(Base):
    __tablename__ = 'measurement'
    id = Column(Integer, primary_key=True, autoincrement=True)
    Brightness = Column(Float)
    Humidity = Column(Float)
    SetpointHistory = Column(Float)
    Temperature = Column(Float)
    roomname = Column(String(14))
    date = Column(DateTime)


def load_OSM_data(file_path: str) -> pd.DataFrame:
    """Loads OSM data from a given file path and returns it in a dictionary format.
    """    
    # Use the provided path instead of hard-coding
    dfall_reloaded = pd.read_csv(file_path, index_col='date', parse_dates=True)
    return dfall_reloaded


def create_OSM_engine(dfall_reloaded: pd.DataFrame) -> (Any, str):
    global engine,Base
    # Use a file-backed SQLite DB so the table persists across connections and process runs.
    # Also allow cross-thread access for the engine since agent runs in executors/threads.
    # Use absolute path relative to this file
    base_dir = Path(__file__).parent
    db_dir = base_dir / "data"
    db_dir.mkdir(parents=True, exist_ok=True)
    db_path = db_dir / "smolagent.db"
    engine = create_engine(f"sqlite:///{db_path}", echo=False, connect_args={"check_same_thread": False})

    # Write dataframe to SQL (replace to ensure schema/table exists), then reflect/inspect
    try:
        # Ensure 'date' index becomes a column if needed
        df_to_save = dfall_reloaded.copy()
        if df_to_save.index.name is not None:
            df_to_save = df_to_save.reset_index()

        # Use replace so we get a clean table with data
        df_to_save.to_sql(name='measurement', con=engine, if_exists='replace', index=False)

        # Create SQLAlchemy tables (if models define other tables). This won't drop existing tables.
        Base.metadata.create_all(engine)

        inspector = inspect(engine)
        columns_info = [(col["name"], col["type"]) for col in inspector.get_columns("measurement")]

        table_description = "Columns:\n" + "\n".join([f"  - {name}: {col_type}" for name, col_type in columns_info])
        print(table_description)
        return engine, table_description

    except Exception as e:
        # If anything goes wrong creating the DB/table, ensure engine is set to None to indicate failure.
        print(f"Error creating SQLite engine or writing table: {e}")
        engine = None
        return None, f"Error creating DB: {e}"


@tool
def sql_engine( query: str) -> str:
    """
    Allows you to perform SQL queries on the table. Returns a string representation of the result.
    The table is named 'measurement'. Its description is as follows:
        Columns:
          - id: INTEGER
          - Brightness: FLOAT
          - Humidity: FLOAT
          - SetpointHistory: FLOAT
          - Temperature: FLOAT
          - roomname: VARCHAR(14)
          - date: DATETIME

    Args:
        query: The query to perform. This should be correct SQL.
    """
    if engine is None:
        return "Error: database engine is not initialized. Make sure create_OSM_engine was called successfully and the DB file exists."

    output = ""
    try:
        with engine.connect() as con:
            rows = con.execute(text(query))
            # For SELECT statements, rows will be iterable
            for row in rows:
                output += "\n" + str(row)
        return output if output else "(no rows)"
    except Exception as e:
        # Return a helpful error string (including original exception message)
        return f"SQL execution error: {e}"


@tool
def save_data(dataset:dict, file_name:str) -> None:
    """Takes the dataset in a dictionary format and saves it as a csv file.

    Args:
        dataset: dataset in a dictionary format
        file_name: name of the file of the saved dataset
    """
    df = pd.DataFrame(dataset)
    df.to_csv(f'{file_name}.csv', index = False)


@tool
def draw_arrow(room_name: str, direction: str) -> str:
    """Draws an arrow in the specified room on the floor plan map.

    Args:
        room_name: Name of the room where the arrow should be displayed (e.g., 'Bathroom', 'Kitchen', 'Room1', 'Room2', 'Toilet', 'Level1', 'Level2')
        direction: Direction of the arrow - must be one of: 'up', 'down', 'left', 'right'

    Returns:
        A confirmation message that the arrow will be displayed
    """
    # Validate direction
    valid_directions = ['up', 'down', 'left', 'right']
    if direction.lower() not in valid_directions:
        return f"Error: Invalid direction '{direction}'. Must be one of: {', '.join(valid_directions)}"

    # Valid room names
    valid_rooms = ['Room1', 'Room2', 'Bathroom', 'Kitchen', 'Toilet', 'Level1', 'Level2']

    # Return arrow command - this will be parsed by output_parser
    return f"ARROW_COMMAND: room={room_name}, direction={direction.lower()}"


@tool
def clear_arrows() -> str:
    """Clears all arrows from the floor plan map.

    Returns:
        A confirmation message that arrows will be cleared
    """
    return "CLEAR_ARROWS_COMMAND"


@tool
def show_map(
    floor_id: str,
    highlight_rooms: str = "",
    room_colors: str = "",
    show_names: bool = True,
    bitmap_overlays: str = "",
    text_overlays: str = ""
) -> str:
    """Display a floor plan with optional highlighted rooms and overlays (bitmaps/text).

    This tool displays a building floor with customizable highlights and overlay elements.
    Use this to show room locations, add directional indicators, or display text labels.

    Args:
        floor_id: ID of the floor to display (e.g., "1F", "2F", "B1")

        highlight_rooms: Comma-separated list of room names to highlight (e.g., "Room1,Bathroom,Kitchen")

        room_colors: Comma-separated list of colors in hex format for each room (e.g., "#FF0000,#00FF00,#0000FF")
                     If fewer colors than rooms, remaining rooms use default #FFD700

        show_names: Whether to show room names on highlighted rooms (default True)

        bitmap_overlays: Bitmap overlays as semicolon-separated entries. Each entry format:
                         "bitmap_id:room_name" (to place at room center) or
                         "bitmap_id:x,y" (to place at coordinates)
                         Example: "arrow_up:Room1;person:50.5,30.2"
                         Available bitmaps: arrow_up, arrow_down, arrow_left, arrow_right, person, warning

        text_overlays: Text overlays as semicolon-separated entries. Each entry format:
                       "text:room_name" or "text:x,y"
                       Example: "Exit:Room1;Warning:45.0,60.0"

    Returns:
        A command string that will be parsed to display the map

    Examples:
        # Show floor 1F with Room1 highlighted in red
        show_map(floor_id="1F", highlight_rooms="Room1", room_colors="#FF0000")

        # Show multiple rooms with different colors and an arrow
        show_map(floor_id="1F", highlight_rooms="Room1,Bathroom", room_colors="#FF0000,#00FF00",
                 bitmap_overlays="arrow_up:Room1")

        # Show room with person icon and name label
        show_map(floor_id="1F", highlight_rooms="Room1", room_colors="#FFD700",
                 bitmap_overlays="person:Room1", text_overlays="John:Room1")
    """
    import json
    from datetime import datetime

    # Build rectangles list
    rectangles = []
    if highlight_rooms:
        room_list = [r.strip() for r in highlight_rooms.split(',') if r.strip()]
        color_list = [c.strip() for c in room_colors.split(',') if c.strip()] if room_colors else []

        for i, room_name in enumerate(room_list):
            color = color_list[i] if i < len(color_list) else "#FFD700"
            rectangles.append({
                "name": room_name,
                "color": color,
                "strokeOpacity": 1.0,
                "fillOpacity": 0.3,
                "showName": show_names
            })

    # Build overlays list
    overlays = []

    # Parse bitmap overlays
    if bitmap_overlays:
        for entry in bitmap_overlays.split(';'):
            entry = entry.strip()
            if not entry:
                continue
            parts = entry.split(':')
            if len(parts) != 2:
                continue

            bitmap_id = parts[0].strip()
            location = parts[1].strip()

            # Check if location is coordinates (contains comma) or room name
            if ',' in location:
                coords = location.split(',')
                if len(coords) == 2:
                    try:
                        x = float(coords[0])
                        y = float(coords[1])
                        overlays.append({
                            "type": "bitmap",
                            "bitmapId": bitmap_id,
                            "position": {"type": "coordinate", "x": x, "y": y}
                        })
                    except ValueError:
                        pass
            else:
                # Room name
                overlays.append({
                    "type": "bitmap",
                    "bitmapId": bitmap_id,
                    "position": {"type": "rectangle", "name": location}
                })

    # Parse text overlays
    if text_overlays:
        for entry in text_overlays.split(';'):
            entry = entry.strip()
            if not entry:
                continue
            parts = entry.split(':')
            if len(parts) != 2:
                continue

            text = parts[0].strip()
            location = parts[1].strip()

            # Check if location is coordinates or room name
            if ',' in location:
                coords = location.split(',')
                if len(coords) == 2:
                    try:
                        x = float(coords[0])
                        y = float(coords[1])
                        overlays.append({
                            "type": "text",
                            "text": text,
                            "fontSize": 14,
                            "color": "#000000",
                            "position": {"type": "coordinate", "x": x, "y": y}
                        })
                    except ValueError:
                        pass
            else:
                # Room name
                overlays.append({
                    "type": "text",
                    "text": text,
                    "fontSize": 14,
                    "color": "#000000",
                    "position": {"type": "rectangle", "name": location}
                })

    # Build complete map command
    map_command = {
        "floorId": floor_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "rectangles": rectangles,
        "overlays": overlays
    }

    return f"MAP_COMMAND: {json.dumps(map_command)}"


@tool
def clear_map() -> str:
    """Clears all highlights and overlays from the floor plan map, returning to default view.

    Returns:
        A command string that will clear the map display
    """
    return "CLEAR_MAP_COMMAND"


class AgentWrapper:
    """Wrapper class for smolagent integration"""

    def __init__(self):
        """Initialize the agent wrapper"""
        self.agent = None
        self._setup_agent()


    def _setup_agent(self):
        """Set up the smolagent instance"""
        try:
            # Load environment variables from .env file
            load_dotenv()
            # Use absolute path relative to this file
            base_dir = Path(__file__).parent
            df = load_OSM_data(datafile := str(base_dir / 'data' / 'dfall.csv'))

            global engine
            engine, table_description = create_OSM_engine(df)

            # Check if API key exists
            api_key = os.environ.get("GOOGLE_API_KEY")
            if not api_key:
                raise ValueError("GOOGLE_API_KEY not found in environment variables. Please create a .env file with GOOGLE_API_KEY=your_key")

            # Initialize model using Google Gemini 2.5 Flash via LiteLLM
            model = LiteLLMModel(
                model_id="gemini/gemini-2.5-flash",
                api_key=api_key
            )

            # Create agent with custom tools
            self.agent = CodeAgent(
                tools=[sql_engine, save_data, draw_arrow, clear_arrows, show_map, clear_map],
                model=model,
                additional_authorized_imports=['numpy', 'pandas', 'matplotlib.pyplot', 'seaborn', 'sklearn'],
            )

            print("Agent initialized successfully with Google Gemini 2.5 Flash")

        except ImportError as e:
            print(f"Warning: Could not import required libraries: {e}")
            print("Agent will run in mock mode")
            self.agent = None
        except ValueError as e:
            print(f"Configuration error: {e}")
            print("Agent will run in mock mode")
            self.agent = None
        except Exception as e:
            print(f"Error setting up agent: {e}")
            print("Agent will run in mock mode")
            self.agent = None

    async def run(self, user_input: str) -> Dict[str, Any]:
        """
        Run the agent with user input and return structured results

        Args:
            user_input: User's message/query

        Returns:
            Dict containing agent response with text, images, and map data
        """
        if self.agent is None:
            # Mock mode for testing without smolagents
            return {
                "text": f"Echo (mock mode): {user_input}",
                "images": [],
                "map_data": None,
                "raw_output": user_input
            }

        try:
            # Run agent in executor to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._run_agent_sync,
                user_input
            )
            return result

        except Exception as e:
            return {
                "text": f"Error running agent: {str(e)}",
                "images": [],
                "map_data": None,
                "raw_output": str(e),
                "error": True
            }

    def _run_agent_sync(self, user_input: str) -> Dict[str, Any]:
        """
        Synchronously run the agent (called from executor)

        Args:
            user_input: User's message/query

        Returns:
            Dict containing agent response
        """
        # Capture stdout/stderr
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        try:
            sys.stdout = stdout_capture
            sys.stderr = stderr_capture

            # Run agent with streaming to capture ActionStep events
            from smolagents.memory import ActionStep, FinalAnswerStep

            result = None
            action_steps = []

            # Run with stream=True to get ActionStep events
            for event in self.agent.run(user_input, stream=True):
                if isinstance(event, ActionStep):
                    action_steps.append(event)
                elif isinstance(event, FinalAnswerStep):
                    result = event.output

            # Get captured output
            stdout_text = stdout_capture.getvalue()
            stderr_text = stderr_capture.getvalue()

            # Combine outputs
            output_text = stdout_text
            if stderr_text:
                output_text += f"\n[stderr]: {stderr_text}"

            # Extract generated code from ActionStep objects
            code_steps = []
            logs = []

            # Process captured ActionSteps
            for i, step_log in enumerate(action_steps):
                # Extract tool calls from ActionStep
                if hasattr(step_log, 'tool_calls') and step_log.tool_calls:
                    for tool_call in step_log.tool_calls:
                        # Check if it's python_interpreter (code execution)
                        if tool_call.name == "python_interpreter":
                            # Extract code from arguments
                            args = tool_call.arguments
                            if isinstance(args, dict):
                                code = args.get("code", str(args))
                            else:
                                code = str(args).strip()

                            if code:
                                code_steps.append({
                                    'code': code,
                                    'step': f'Step {step_log.step_number}' if hasattr(step_log, 'step_number') else f'Step {i+1}'
                                })

                # Store step log info (serializable version)
                logs.append({
                    'step_number': getattr(step_log, 'step_number', i+1),
                    'tool_calls': [tc.name for tc in step_log.tool_calls] if hasattr(step_log, 'tool_calls') and step_log.tool_calls else []
                })

            return {
                "text": str(result) if result else output_text,
                "images": [],  # Will be populated by output parser
                "map_data": None,  # Will be populated by output parser
                "raw_output": output_text,
                "result": str(result) if result else None,  # Convert result to string for JSON serialization
                "code_steps": code_steps,
                "logs": logs
            }

        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

    def set_tools(self, tools: List):
        """
        Set custom tools for the agent

        Args:
            tools: List of smolagent tools
        """
        if self.agent:
            self.agent.tools = tools