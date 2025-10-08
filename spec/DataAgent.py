"""
Sample Data Analysis Agent using smolagents

This is an example of how to create a data analysis agent that:
1. Can perform data analysis tasks
2. Generate plots/images
3. Work with coordinate data for map visualization

Usage:
    python DataAgent.py
"""

from smolagents import CodeAgent, HfApiModel, tool
import matplotlib.pyplot as plt
import numpy as np
import io
import base64


@tool
def generate_sample_plot(plot_type: str = "line") -> str:
    """
    Generate a sample plot for testing image display.

    Args:
        plot_type: Type of plot to generate ("line", "scatter", "bar")

    Returns:
        Path to the generated plot image
    """
    plt.figure(figsize=(10, 6))

    x = np.linspace(0, 10, 100)

    if plot_type == "line":
        y = np.sin(x)
        plt.plot(x, y, 'b-', linewidth=2)
        plt.title('Sample Line Plot: sin(x)')

    elif plot_type == "scatter":
        y = np.random.randn(50)
        x_scatter = np.random.randn(50)
        plt.scatter(x_scatter, y, c='red', alpha=0.5)
        plt.title('Sample Scatter Plot')

    elif plot_type == "bar":
        categories = ['A', 'B', 'C', 'D', 'E']
        values = np.random.randint(10, 100, 5)
        plt.bar(categories, values, color='green')
        plt.title('Sample Bar Plot')

    else:
        y = np.sin(x)
        plt.plot(x, y)
        plt.title('Default Plot')

    plt.xlabel('X axis')
    plt.ylabel('Y axis')
    plt.grid(True, alpha=0.3)

    # Save plot
    output_path = f'/tmp/plot_{plot_type}.png'
    plt.savefig(output_path, dpi=100, bbox_inches='tight')
    plt.close()

    return output_path


@tool
def generate_coordinates(num_points: int = 5) -> str:
    """
    Generate sample coordinate data for map visualization.

    Args:
        num_points: Number of coordinate points to generate

    Returns:
        String representation of coordinates
    """
    # Generate random coordinates (latitude, longitude)
    # Using realistic ranges: lat in [-90, 90], lon in [-180, 180]

    coordinates = []
    for i in range(num_points):
        lat = np.random.uniform(-90, 90)
        lon = np.random.uniform(-180, 180)
        coordinates.append((lat, lon))

    # Format as string
    result = "Coordinates:\n"
    for i, (lat, lon) in enumerate(coordinates):
        result += f"Point {i}: {lat:.4f}, {lon:.4f}\n"

    return result


@tool
def analyze_data(data_description: str) -> str:
    """
    Perform simple data analysis based on description.

    Args:
        data_description: Description of data to analyze

    Returns:
        Analysis results as string
    """
    # Simple mock analysis
    result = f"Analysis of: {data_description}\n\n"
    result += "Summary statistics:\n"
    result += f"- Mean: {np.random.uniform(10, 100):.2f}\n"
    result += f"- Std Dev: {np.random.uniform(1, 10):.2f}\n"
    result += f"- Min: {np.random.uniform(0, 10):.2f}\n"
    result += f"- Max: {np.random.uniform(90, 100):.2f}\n"

    return result


def create_agent():
    """Create and configure the data analysis agent"""

    # Initialize model (using HuggingFace API)
    model = HfApiModel()

    # Create agent with tools
    agent = CodeAgent(
        tools=[generate_sample_plot, generate_coordinates, analyze_data],
        model=model,
    )

    return agent


def main():
    """Main function to demonstrate agent usage"""

    print("Creating Data Analysis Agent...")
    agent = create_agent()

    # Example queries
    examples = [
        "Generate a line plot",
        "Show me 5 random coordinates on the map",
        "Analyze sales data for Q1",
        "Create a scatter plot and show 3 coordinates"
    ]

    print("\nExample queries you can try:")
    for i, example in enumerate(examples, 1):
        print(f"{i}. {example}")

    print("\n" + "=" * 50)
    print("Agent is ready! You can now use it in the UI.")
    print("=" * 50)

    # Interactive mode
    while True:
        try:
            query = input("\nEnter your query (or 'quit' to exit): ").strip()

            if query.lower() in ['quit', 'exit', 'q']:
                break

            if not query:
                continue

            print("\nProcessing...")
            result = agent.run(query)
            print(f"\nResult: {result}")

        except KeyboardInterrupt:
            print("\n\nExiting...")
            break
        except Exception as e:
            print(f"\nError: {e}")


if __name__ == "__main__":
    main()
