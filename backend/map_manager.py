"""
Map Manager for handling multi-floor building maps with overlays.
Manages map definitions, display commands, and coordinate transformations.
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class Coordinate:
    """Virtual coordinate in the map system"""
    x: float
    y: float


@dataclass
class Point:
    """Point with both pixel and virtual coordinates"""
    px: float  # Pixel coordinate X
    py: float  # Pixel coordinate Y
    x: float   # Virtual coordinate X
    y: float   # Virtual coordinate Y


@dataclass
class CoordinateSystem:
    """Coordinate system defining mapping between pixel and virtual coordinates"""
    topLeft: Point
    bottomRight: Point
    scaleX: float
    scaleY: float


@dataclass
class Rectangle:
    """Named rectangle area on the floor plan"""
    name: str
    topLeft: Coordinate
    bottomRight: Coordinate
    width: float
    height: float


@dataclass
class Floor:
    """Floor definition with image, coordinate system, and rectangles"""
    floorId: str
    floorName: str
    floorImage: str
    coordinateSystem: CoordinateSystem
    rectangles: List[Rectangle]


@dataclass
class Bitmap:
    """Bitmap resource definition"""
    bitmapId: str
    bitmapName: str
    bitmapFile: str


@dataclass
class MapDefinition:
    """Complete map definition with all floors and bitmaps"""
    floors: List[Floor]
    bitmaps: List[Bitmap]


class MapManager:
    """Manager class for map definitions and operations"""

    def __init__(self, data_dir: Path):
        """
        Initialize MapManager with data directory

        Args:
            data_dir: Path to directory containing map data files
        """
        self.data_dir = Path(data_dir)
        self.map_definition: Optional[MapDefinition] = None
        self.current_floor_id: Optional[str] = None

    def load_legacy_data(self, floor_image: str, rectangles_json: str,
                         floor_id: str = "1F", floor_name: str = "1階") -> MapDefinition:
        """
        Load legacy single-floor data and convert to new format

        Args:
            floor_image: Filename of floor plan image
            rectangles_json: Filename of rectangles JSON file
            floor_id: ID for the floor (default: "1F")
            floor_name: Display name for the floor (default: "1階")

        Returns:
            MapDefinition object
        """
        # Load rectangles JSON
        json_path = self.data_dir / rectangles_json
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Convert to new format
        coord_sys_data = data['coordinateSystem']
        coord_system = CoordinateSystem(
            topLeft=Point(**coord_sys_data['topLeft']),
            bottomRight=Point(**coord_sys_data['bottomRight']),
            scaleX=coord_sys_data['scaleX'],
            scaleY=coord_sys_data['scaleY']
        )

        rectangles = [
            Rectangle(
                name=rect['name'],
                topLeft=Coordinate(**rect['topLeft']),
                bottomRight=Coordinate(**rect['bottomRight']),
                width=rect['width'],
                height=rect['height']
            )
            for rect in data['rectangles']
        ]

        floor = Floor(
            floorId=floor_id,
            floorName=floor_name,
            floorImage=floor_image,
            coordinateSystem=coord_system,
            rectangles=rectangles
        )

        # Load available bitmaps
        bitmaps = self._scan_bitmaps()

        self.map_definition = MapDefinition(
            floors=[floor],
            bitmaps=bitmaps
        )

        return self.map_definition

    def _scan_bitmaps(self) -> List[Bitmap]:
        """
        Scan bitmaps directory and create bitmap definitions

        Returns:
            List of Bitmap objects
        """
        bitmaps = []
        bitmap_dir = self.data_dir.parent / 'bitmaps'

        if bitmap_dir.exists():
            # Scan for bitmap files
            bitmap_mapping = {
                'arrow_up.bmp': ('arrow_up', '上向き矢印'),
                'arrow_down.bmp': ('arrow_down', '下向き矢印'),
                'arrow_left.bmp': ('arrow_left', '左向き矢印'),
                'arrow_right.bmp': ('arrow_right', '右向き矢印'),
            }

            for filename, (bitmap_id, name) in bitmap_mapping.items():
                if (bitmap_dir / filename).exists():
                    bitmaps.append(Bitmap(
                        bitmapId=bitmap_id,
                        bitmapName=name,
                        bitmapFile=filename
                    ))

        return bitmaps

    def get_map_definition_message(self) -> Dict[str, Any]:
        """
        Get map_definition message in the format required by frontend

        Returns:
            Dictionary with type and content for WebSocket transmission
        """
        if not self.map_definition:
            raise ValueError("Map definition not loaded")

        return {
            "type": "map_definition",
            "content": self._dataclass_to_dict(self.map_definition)
        }

    def _dataclass_to_dict(self, obj: Any) -> Any:
        """
        Convert dataclass to dictionary recursively

        Args:
            obj: Dataclass object to convert

        Returns:
            Dictionary representation
        """
        if hasattr(obj, '__dataclass_fields__'):
            result = {}
            for field_name, field_def in obj.__dataclass_fields__.items():
                value = getattr(obj, field_name)
                result[field_name] = self._dataclass_to_dict(value)
            return result
        elif isinstance(obj, list):
            return [self._dataclass_to_dict(item) for item in obj]
        else:
            return obj

    def create_map_command(self, floor_id: str, rectangles: List[Dict],
                          overlays: List[Dict], timestamp: str = None) -> Dict[str, Any]:
        """
        Create map display command message

        Args:
            floor_id: Target floor ID
            rectangles: List of rectangle display configs
            overlays: List of overlay elements
            timestamp: ISO 8601 timestamp (optional)

        Returns:
            Dictionary with type and content for WebSocket transmission
        """
        from datetime import datetime

        if timestamp is None:
            timestamp = datetime.utcnow().isoformat() + 'Z'

        return {
            "type": "map",
            "content": {
                "floorId": floor_id,
                "timestamp": timestamp,
                "rectangles": rectangles,
                "overlays": overlays
            }
        }
