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
        arrows = self._extract_arrows(raw_output, text_content, agent_response)
        outputs.extend(arrows)

        # Check for clear arrows command
        clear_command = self._extract_clear_arrows(raw_output, text_content, agent_response)
        if clear_command:
            outputs.append(clear_command)

        # Check for map display commands (new interface)
        map_command = self._extract_map_command(raw_output, text_content, agent_response)
        if map_command:
            outputs.append(map_command)

        # Check for clear map command
        clear_map_command = self._extract_clear_map_command(raw_output, text_content, agent_response)
        if clear_map_command:
            outputs.append(clear_map_command)

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
        image_paths = set()  # Track found paths to avoid duplicates

        # First, check code_steps for image file generation (plt.savefig, etc.)
        if 'code_steps' in response and response['code_steps']:
            for step in response['code_steps']:
                code = step.get('code', '')
                # Look for savefig calls
                savefig_pattern = r'(?:plt\.savefig|fig\.savefig|matplotlib\.pyplot\.savefig)\s*\(\s*["\']([^"\']+)["\']'
                savefig_matches = re.findall(savefig_pattern, code, re.IGNORECASE)
                for img_path in savefig_matches:
                    image_paths.add(img_path)

                # Look for other image saving patterns (seaborn, etc.)
                # Pattern for any .save() or .to_file() with image extensions
                save_pattern = r'\.(?:save|to_file)\s*\(\s*["\']([^"\']+\.(?:png|jpg|jpeg|gif|bmp|svg))["\']'
                save_matches = re.findall(save_pattern, code, re.IGNORECASE)
                for img_path in save_matches:
                    image_paths.add(img_path)

        # Also check for image paths in raw_output
        image_path_pattern = r'([^\s]+\.(?:png|jpg|jpeg|gif|bmp|svg))'
        matches = re.findall(image_path_pattern, raw_output, re.IGNORECASE)
        for match in matches:
            image_paths.add(match)

        # Try to find and read each image file
        for img_path_str in image_paths:
            path = Path(img_path_str)

            # If path is not absolute, try multiple locations
            if not path.is_absolute():
                # Get backend directory
                backend_dir = Path(__file__).parent
                search_paths = [
                    path,  # Current working directory
                    backend_dir / img_path_str,  # Backend directory
                    backend_dir / "data" / img_path_str,  # Backend data directory
                    backend_dir.parent / img_path_str,  # Project root
                ]

                found_path = None
                for search_path in search_paths:
                    if search_path.exists():
                        found_path = search_path
                        break

                if found_path:
                    path = found_path

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
                    print(f"OutputParser: Found and encoded image: {path}")
                except Exception as e:
                    print(f"Error reading image {path}: {e}")
            else:
                print(f"OutputParser: Image file not found: {img_path_str} (searched in multiple locations)")

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

    def _extract_arrows(self, raw_output: str, text_content: str, agent_response: Dict) -> List[Dict[str, Any]]:
        """
        Extract arrow commands from agent output

        Args:
            raw_output: Raw output text
            text_content: Agent's text response
            agent_response: Full agent response dict

        Returns:
            List of arrow output objects
        """
        arrows = []

        # First, extract from code_steps if available
        if 'code_steps' in agent_response and agent_response['code_steps']:
            for step in agent_response['code_steps']:
                code = step.get('code', '')
                # Pattern to match draw_arrow calls in code
                draw_arrow_call_pattern = r'draw_arrow\s*\(\s*room_name\s*=\s*["\']([^"\']+)["\']\s*,\s*direction\s*=\s*["\']([^"\']+)["\']\s*\)'
                call_matches = re.findall(draw_arrow_call_pattern, code, re.IGNORECASE)

                for room_name, direction in call_matches:
                    arrows.append({
                        "type": "arrow",
                        "content": {
                            "room": room_name.strip(),
                            "direction": direction.lower()
                        }
                    })

        # Combine both outputs for searching
        combined_output = raw_output + "\n" + text_content

        # Pattern 1: Match ARROW_COMMAND format (from tool return value)
        arrow_pattern = r'ARROW_COMMAND:\s*room=([^,]+),\s*direction=(up|down|left|right)'
        matches = re.findall(arrow_pattern, combined_output, re.IGNORECASE)

        for room_name, direction in matches:
            # Avoid duplicates
            if not any(a['content']['room'] == room_name and a['content']['direction'] == direction.lower() for a in arrows):
                arrows.append({
                    "type": "arrow",
                    "content": {
                        "room": room_name.strip(),
                        "direction": direction.lower()
                    }
                })

        # Pattern 2: Also extract from draw_arrow() function calls in the output
        # This catches draw_arrow(room_name="Kitchen", direction="left")
        draw_arrow_call_pattern = r'draw_arrow\s*\(\s*room_name\s*=\s*["\']([^"\']+)["\']\s*,\s*direction\s*=\s*["\']([^"\']+)["\']\s*\)'
        call_matches = re.findall(draw_arrow_call_pattern, combined_output, re.IGNORECASE)

        for room_name, direction in call_matches:
            # Avoid duplicates
            if not any(a['content']['room'] == room_name and a['content']['direction'] == direction.lower() for a in arrows):
                arrows.append({
                    "type": "arrow",
                    "content": {
                        "room": room_name.strip(),
                        "direction": direction.lower()
                    }
                })

        return arrows

    def _extract_clear_arrows(self, raw_output: str, text_content: str, agent_response: Dict) -> Dict[str, Any] | None:
        """
        Extract clear arrows command from agent output

        Args:
            raw_output: Raw output text
            text_content: Agent's text response
            agent_response: Full agent response dict

        Returns:
            Clear arrows command object or None
        """
        # First, check code_steps for clear_arrows() calls
        if 'code_steps' in agent_response and agent_response['code_steps']:
            for step in agent_response['code_steps']:
                code = step.get('code', '')
                if 'clear_arrows()' in code:
                    return {
                        "type": "clear_arrows",
                        "content": {}
                    }

        # Combine both outputs for searching
        combined_output = raw_output + "\n" + text_content

        # Check for CLEAR_ARROWS_COMMAND pattern
        if 'CLEAR_ARROWS_COMMAND' in combined_output:
            return {
                "type": "clear_arrows",
                "content": {}
            }

        return None

    def _extract_map_command(self, raw_output: str, text_content: str, agent_response: Dict) -> Dict[str, Any] | None:
        """
        Extract map display command from agent output (new interface)

        Args:
            raw_output: Raw output text
            text_content: Agent's text response
            agent_response: Full agent response dict

        Returns:
            Map command object or None
        """
        # First, check code_steps for show_map() calls
        if 'code_steps' in agent_response and agent_response['code_steps']:
            for step in agent_response['code_steps']:
                code = step.get('code', '')
                # Look for show_map function calls
                if 'show_map(' in code:
                    # Parse the map command from the code output
                    # The show_map tool returns "MAP_COMMAND: {json}"
                    pass

        # Combine both outputs for searching
        combined_output = raw_output + "\n" + text_content

        # Pattern: MAP_COMMAND: {json}
        map_command_pattern = r'MAP_COMMAND:\s*(\{.*?\})'
        matches = re.findall(map_command_pattern, combined_output, re.DOTALL)

        if matches:
            # Get the last match (most recent command)
            json_str = matches[-1]
            try:
                map_data = json.loads(json_str)
                return {
                    "type": "map",
                    "content": map_data
                }
            except json.JSONDecodeError as e:
                print(f"Error parsing MAP_COMMAND JSON: {e}")
                print(f"JSON string: {json_str}")
                return None

        return None

    def _extract_clear_map_command(self, raw_output: str, text_content: str, agent_response: Dict) -> Dict[str, Any] | None:
        """
        Extract clear map command from agent output

        Args:
            raw_output: Raw output text
            text_content: Agent's text response
            agent_response: Full agent response dict

        Returns:
            Clear map command object or None
        """
        # First, check code_steps for clear_map() calls
        if 'code_steps' in agent_response and agent_response['code_steps']:
            for step in agent_response['code_steps']:
                code = step.get('code', '')
                if 'clear_map()' in code:
                    return {
                        "type": "clear_map",
                        "content": {}
                    }

        # Combine both outputs for searching
        combined_output = raw_output + "\n" + text_content

        # Check for CLEAR_MAP_COMMAND pattern
        if 'CLEAR_MAP_COMMAND' in combined_output:
            return {
                "type": "clear_map",
                "content": {}
            }

        return None

    def generate_unified_response(self, agent_response: Dict[str, Any], parsed_outputs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate Phase 2.0 unified response format

        Converts individual message objects into a single unified response object
        containing all data categories (sensor, bim, 2d_map, images, report)

        Args:
            agent_response: Original agent response dict
            parsed_outputs: List of parsed output objects from parse()

        Returns:
            List containing single unified response object (Phase 2.0 format)
        """
        # Initialize unified response with required fields
        unified = {
            "message": "",  # Will be populated from text content
            "agent": "smolAgent"  # Fixed value per Phase 2.0 spec
        }

        # Process each parsed output
        for output in parsed_outputs:
            output_type = output.get("type")
            content = output.get("content")

            if output_type == "text":
                # Primary message content
                unified["message"] = content

            elif output_type == "code":
                # Append code information to message (optional)
                if unified["message"]:
                    unified["message"] += f"\n\n**Code ({output.get('step', 'N/A')})**:\n```{output.get('language', 'python')}\n{content}\n```"
                else:
                    unified["message"] = f"Code generated:\n```{output.get('language', 'python')}\n{content}\n```"

            elif output_type == "image":
                # Add to images array
                if "images" not in unified:
                    unified["images"] = []
                unified["images"].append({
                    "title": output.get("path", "Generated Image"),  # Use path as title or default
                    "data": content,  # base64 encoded image
                    "type": output.get("format", "png")  # Image format
                })

            elif output_type == "map":
                # Phase 2.0 2d_map structure
                map_content = content

                # Check if this is a MAP_COMMAND (new format)
                if isinstance(map_content, dict):
                    floor_id = map_content.get("floorId", "1F")

                    # Build 2d_map object per Phase 2.0 spec
                    unified["2d_map"] = {
                        "floor": floor_id,
                        "area": {
                            "type": "map",
                            "content": {
                                "timestamp": map_content.get("timestamp", ""),
                                "rectangles": map_content.get("rectangles", []),
                                "overlays": map_content.get("overlays", [])
                            }
                        }
                    }

            elif output_type == "highlight_room":
                # Convert highlight_room to 2d_map format
                rooms = content.get("rooms", [])
                if rooms and "2d_map" not in unified:
                    # Create 2d_map with rectangles for highlighted rooms
                    unified["2d_map"] = {
                        "floor": "1F",  # Default floor
                        "area": {
                            "type": "map",
                            "content": {
                                "timestamp": "",
                                "rectangles": [
                                    {
                                        "name": room,
                                        "color": "#0066ff",  # Blue highlight
                                        "strokeOpacity": 1.0,
                                        "fillOpacity": 0.3,
                                        "showName": True
                                    } for room in rooms
                                ],
                                "overlays": []
                            }
                        }
                    }

        # Ensure message field exists (required per Phase 2.0 spec)
        if not unified["message"]:
            unified["message"] = agent_response.get("text", "Response generated")

        # Return as array (Phase 2.0 format)
        return [unified]
