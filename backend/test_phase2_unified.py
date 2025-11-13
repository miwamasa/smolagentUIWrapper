#!/usr/bin/env python3
"""
Test script for Phase 2.0 unified response format
Verifies that generate_unified_response() produces correct output structure
"""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

from output_parser import OutputParser

def test_unified_response_generation():
    """Test unified response generation with various output types"""
    parser = OutputParser()

    print("=" * 60)
    print("Testing Phase 2.0 Unified Response Generation")
    print("=" * 60)

    # Test Case 1: Simple text response
    print("\n[Test 1] Simple text response")
    agent_response = {
        "text": "Test response text",
        "raw_output": "Test response text"
    }
    parsed_outputs = [
        {"type": "text", "content": "Test response text"}
    ]
    unified = parser.generate_unified_response(agent_response, parsed_outputs)

    assert isinstance(unified, list), "Unified response should be a list"
    assert len(unified) == 1, "Unified response should contain exactly one element"
    assert unified[0]["message"] == "Test response text", "Message field should match"
    assert unified[0]["agent"] == "smolAgent", "Agent field should be 'smolAgent'"
    print("✓ Text response: PASS")

    # Test Case 2: Response with image
    print("\n[Test 2] Response with image")
    parsed_outputs = [
        {"type": "text", "content": "Here is the plot"},
        {"type": "image", "content": "base64data", "format": "png", "path": "temperature_plot.png"}
    ]
    unified = parser.generate_unified_response(agent_response, parsed_outputs)

    assert "images" in unified[0], "Should have images field"
    assert len(unified[0]["images"]) == 1, "Should have one image"
    assert unified[0]["images"][0]["title"] == "temperature_plot.png", "Image title should match"
    assert unified[0]["images"][0]["type"] == "png", "Image type should match"
    print("✓ Image response: PASS")

    # Test Case 3: Response with highlight_room (converted to 2d_map)
    print("\n[Test 3] Response with highlight_room (legacy)")
    parsed_outputs = [
        {"type": "text", "content": "Highlighting rooms"},
        {"type": "highlight_room", "content": {"rooms": ["Room1", "Room2"]}}
    ]
    unified = parser.generate_unified_response(agent_response, parsed_outputs)

    assert "2d_map" in unified[0], "Should have 2d_map field"
    assert unified[0]["2d_map"]["floor"] == "1F", "Should have floor"
    assert unified[0]["2d_map"]["area"]["type"] == "map", "Area type should be 'map'"
    assert len(unified[0]["2d_map"]["area"]["content"]["rectangles"]) == 2, "Should have 2 rectangles"
    print("✓ highlight_room conversion: PASS")

    # Test Case 4: Response with map command
    print("\n[Test 4] Response with map command")
    parsed_outputs = [
        {"type": "text", "content": "Showing map"},
        {"type": "map", "content": {
            "floorId": "2F",
            "timestamp": "2025-01-01 12:00:00",
            "rectangles": [{"name": "Room3", "color": "#ff0000"}],
            "overlays": []
        }}
    ]
    unified = parser.generate_unified_response(agent_response, parsed_outputs)

    assert "2d_map" in unified[0], "Should have 2d_map field"
    assert unified[0]["2d_map"]["floor"] == "2F", "Floor should match"
    assert unified[0]["2d_map"]["area"]["content"]["timestamp"] == "2025-01-01 12:00:00", "Timestamp should match"
    print("✓ Map command: PASS")

    # Test Case 5: Complex response with multiple data types
    print("\n[Test 5] Complex response with multiple data types")
    parsed_outputs = [
        {"type": "text", "content": "Analysis complete"},
        {"type": "image", "content": "base64_1", "format": "png", "path": "plot1.png"},
        {"type": "image", "content": "base64_2", "format": "jpg", "path": "plot2.jpg"},
        {"type": "map", "content": {
            "floorId": "1F",
            "timestamp": "2025-01-01 12:00:00",
            "rectangles": [],
            "overlays": []
        }}
    ]
    unified = parser.generate_unified_response(agent_response, parsed_outputs)

    assert unified[0]["message"] == "Analysis complete", "Message should match"
    assert len(unified[0]["images"]) == 2, "Should have 2 images"
    assert "2d_map" in unified[0], "Should have 2d_map"
    print("✓ Complex response: PASS")

    # Test Case 6: Empty response handling
    print("\n[Test 6] Empty response handling")
    agent_response = {"text": "Default message"}
    parsed_outputs = []
    unified = parser.generate_unified_response(agent_response, parsed_outputs)

    assert unified[0]["message"] == "Default message", "Should use agent response text as fallback"
    assert unified[0]["agent"] == "smolAgent", "Agent field should always be present"
    print("✓ Empty response handling: PASS")

    print("\n" + "=" * 60)
    print("All tests PASSED! ✓")
    print("=" * 60)
    print("\nPhase 2.0 unified response format is working correctly.")
    print("The system generates proper unified responses with:")
    print("  - Required fields: message, agent")
    print("  - Optional fields: images, 2d_map, sensor, bim, report")
    print("  - Backward compatibility maintained")

if __name__ == "__main__":
    try:
        test_unified_response_generation()
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
