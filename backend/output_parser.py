"""
Output parser for determining output types from agent responses.
Classifies outputs into: text, image, or 2D map data.
"""

import re
import base64
from typing import Dict, List, Any
from pathlib import Path
import json

class OutputParser:
    """Parser for agent output classification"""

    def __init__(self):
        """Initialize output parser"""
        # Keywords that indicate map-related data
        self.map_keywords = [
            "coordinate", "coordinates", "latitude", "longitude",
            "lat", "lon", "map", "location", "position",
            "geo", "spatial", "point", "points"
        ]

        # Image file extensions
        self.image_extensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg"]

        # Room names from floor plan
        self.room_names = ["Room1", "Room2", "Bathroom", "Kitchen", "Toilet", "Level1", "Level2"]

    def parse(self, agent_response: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Parse agent response and classify outputs

        Args:
            agent_response: Response from agent_wrapper

        Returns:
            List of output objects with type and content
        """
        outputs = []

        # Extract code blocks first (from code_steps or raw_output)
        code_blocks = self._extract_code_blocks(agent_response)
        outputs.extend(code_blocks)

        # Extract text output
        text_content = agent_response.get("text", "")

        # Also try to extract code from text content
        if text_content:
            # Look for code in text content too
            text_code_blocks = self._extract_code_from_text(text_content)
            outputs.extend(text_code_blocks)

        if text_content and not agent_response.get("error"):
            outputs.append({
                "type": "text",
                "content": text_content
            })
        elif agent_response.get("error"):
            outputs.append({
                "type": "error",
                "content": text_content
            })

        # Check for image outputs
        raw_output = agent_response.get("raw_output", "")
        images = self._extract_images(raw_output, agent_response)
        outputs.extend(images)

        # Check for map data (DISABLED - now using floor plan with room highlights)
        # map_data = self._extract_map_data(raw_output, agent_response)
        # if map_data:
        #     outputs.append(map_data)

        # Check for room names to highlight
        highlighted_rooms = self._extract_room_highlights(text_content)
        if highlighted_rooms:
            outputs.append({
                "type": "highlight_room",
                "content": {
                    "rooms": highlighted_rooms
                }
            })

        # Check for arrow commands
        arrows = self._extract_arrows(raw_output, text_content)
        outputs.extend(arrows)

        return outputs

    def _extract_images(self, raw_output: str, response: Dict) -> List[Dict[str, Any]]:
        """
        Extract image data from output

        Args:
            raw_output: Raw text output
            response: Agent response dict

        Returns:
            List of image output objects
        """
        images = []

        # Check for image paths in output
        image_path_pattern = r'([^\s]+\.(?:png|jpg|jpeg|gif|bmp|svg))'
        matches = re.findall(image_path_pattern, raw_output, re.IGNORECASE)

        for match in matches:
            path = Path(match)
            if path.exists():
                # Read and encode image
                try:
                    with open(path, "rb") as f:
                        img_data = base64.b64encode(f.read()).decode()

                    images.append({
                        "type": "image",
                        "content": img_data,
                        "format": path.suffix[1:],  # Remove leading dot
                        "path": str(path)
                    })
                except Exception as e:
                    print(f"Error reading image {path}: {e}")

        # Check for base64 encoded images in output
        base64_pattern = r'data:image/([^;]+);base64,([A-Za-z0-9+/=]+)'
        base64_matches = re.findall(base64_pattern, raw_output)

        for img_format, img_data in base64_matches:
            images.append({
                "type": "image",
                "content": img_data,
                "format": img_format
            })

        return images

    def _extract_map_data(self, raw_output: str, response: Dict) -> Dict[str, Any] | None:
        """
        Extract 2D map data from output

        Args:
            raw_output: Raw text output
            response: Agent response dict

        Returns:
            Map data object or None
        """
        # Check if output contains map-related keywords
        output_lower = raw_output.lower()
        has_map_keywords = any(kw in output_lower for kw in self.map_keywords)

        if not has_map_keywords:
            return None

        # Try to extract coordinate data
        # Pattern for coordinate pairs: (lat, lon) or lat, lon
        coord_pattern = r'[-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+'
        coords = re.findall(coord_pattern, raw_output)

        if coords:
            # Parse coordinates
            points = []
            for coord_str in coords:
                parts = coord_str.split(',')
                if len(parts) == 2:
                    try:
                        lat = float(parts[0].strip())
                        lon = float(parts[1].strip())
                        points.append({"lat": lat, "lon": lon})
                    except ValueError:
                        continue

            if points:
                return {
                    "type": "map",
                    "content": {
                        "points": points,
                        "description": "Coordinate data extracted from agent output"
                    }
                }

        # Try to extract JSON map data
        try:
            # Look for JSON objects in output
            json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
            json_matches = re.findall(json_pattern, raw_output)

            for json_str in json_matches:
                try:
                    data = json.loads(json_str)
                    # Check if it's map-like data
                    if isinstance(data, dict):
                        if any(key in data for key in ["coordinates", "points", "locations", "lat", "lon"]):
                            return {
                                "type": "map",
                                "content": data
                            }
                except json.JSONDecodeError:
                    continue
        except Exception as e:
            print(f"Error extracting JSON map data: {e}")

        return None

    def _extract_code_blocks(self, response: Dict) -> List[Dict[str, Any]]:
        """
        Extract code blocks from agent response

        Args:
            response: Agent response dict

        Returns:
            List of code block objects
        """
        code_blocks = []

        # First, check if there are explicit code_steps from agent
        if 'code_steps' in response and response['code_steps']:
            for i, step in enumerate(response['code_steps']):
                code_blocks.append({
                    "type": "code",
                    "content": step.get('code', ''),
                    "step": step.get('step', f'Step {i+1}'),
                    "language": "python"  # smolagents uses Python
                })

        # Also extract code blocks from raw output (markdown code blocks)
        raw_output = response.get("raw_output", "")
        if raw_output:
            # Pattern for markdown code blocks: ```language\ncode\n```
            code_pattern = r'```(\w+)?\n(.*?)```'
            matches = re.findall(code_pattern, raw_output, re.DOTALL)

            for language, code in matches:
                if code.strip():
                    code_blocks.append({
                        "type": "code",
                        "content": code.strip(),
                        "language": language if language else "python"
                    })

            # Try alternative patterns for code detection
            # Pattern: "Code:" followed by indented lines
            code_after_label_pattern = r'(?:Code:|Executing code:|Running code:)\s*\n((?:[ \t]+.+\n?)+)'
            code_after_label = re.findall(code_after_label_pattern, raw_output, re.MULTILINE)

            for code in code_after_label:
                if code.strip() and not any(cb['content'] == code.strip() for cb in code_blocks):
                    code_blocks.append({
                        "type": "code",
                        "content": code.strip(),
                        "language": "python"
                    })

            # Also look for code blocks without language specification
            simple_code_pattern = r'```\n(.*?)```'
            simple_matches = re.findall(simple_code_pattern, raw_output, re.DOTALL)

            for code in simple_matches:
                if code.strip() and not any(cb['content'] == code.strip() for cb in code_blocks):
                    code_blocks.append({
                        "type": "code",
                        "content": code.strip(),
                        "language": "python"
                    })

        # Extract code from logs if available
        if 'logs' in response and response['logs']:
            for log_entry in response['logs']:
                # smolagents logs might contain code in various formats
                if isinstance(log_entry, str):
                    # Check if the log entry contains code-like patterns
                    if ('def ' in log_entry or 'import ' in log_entry or
                        'class ' in log_entry or '=' in log_entry):
                        # This might be code, but only add if not already added
                        if not any(cb['content'] == log_entry for cb in code_blocks):
                            code_blocks.append({
                                "type": "code",
                                "content": log_entry,
                                "language": "python",
                                "source": "logs"
                            })

        return code_blocks

    def _extract_code_from_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Extract code blocks from text content

        Args:
            text: Text content to search

        Returns:
            List of code block objects
        """
        code_blocks = []

        # Pattern for markdown code blocks in text
        code_pattern = r'```(\w+)?\n(.*?)```'
        matches = re.findall(code_pattern, text, re.DOTALL)

        for language, code in matches:
            if code.strip():
                code_blocks.append({
                    "type": "code",
                    "content": code.strip(),
                    "language": language if language else "python"
                })

        return code_blocks

    def _extract_room_highlights(self, text: str) -> List[str]:
        """
        Extract room names from agent's final answer to highlight on the map

        Args:
            text: Agent's text response

        Returns:
            List of room names to highlight
        """
        if not text:
            return []

        highlighted_rooms = []
        text_lower = text.lower()

        # Check each room name (case-insensitive)
        for room in self.room_names:
            # Look for exact room name or room name with common separators
            pattern = r'\b' + re.escape(room.lower()) + r'\b'
            if re.search(pattern, text_lower):
                highlighted_rooms.append(room)

        return highlighted_rooms

    def _extract_arrows(self, raw_output: str, text_content: str) -> List[Dict[str, Any]]:
        """
        Extract arrow commands from agent output

        Args:
            raw_output: Raw output text
            text_content: Agent's text response

        Returns:
            List of arrow output objects
        """
        arrows = []

        # Combine both outputs for searching
        combined_output = raw_output + "\n" + text_content

        # Pattern to match: ARROW_COMMAND: room=RoomName, direction=direction
        arrow_pattern = r'ARROW_COMMAND:\s*room=([^,]+),\s*direction=(up|down|left|right)'
        matches = re.findall(arrow_pattern, combined_output, re.IGNORECASE)

        for room_name, direction in matches:
            arrows.append({
                "type": "arrow",
                "content": {
                    "room": room_name.strip(),
                    "direction": direction.lower()
                }
            })

        return arrows
