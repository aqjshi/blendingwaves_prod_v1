from PIL import Image

def remove_white_background(input_image_path, output_image_path):
    """
    Removes the white background from a PNG image and saves the result.

    Args:
        input_image_path (str): The path to the input PNG image.
        output_image_path (str): The path to save the output PNG image with
                                 transparent background.
    """
    try:
        img = Image.open(input_image_path)

        # Ensure the image has an alpha channel (RGBA)
        # If it's RGB, convert it to RGBA so we can add transparency
        if img.mode != 'RGBA':
            img = img.convert('RGBA')

        datas = img.getdata()

        newData = []
        for item in datas:
            # If the pixel is white (or very close to white), make it transparent
            # You can adjust the threshold (e.g., 240) based on your image's "white"
            if item[0] > 200 and item[1] > 200 and item[2] > 200:
                newData.append((255, 255, 255, 0)) # Transparent
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(output_image_path, "PNG")
        print(f"Background removed successfully! Image saved to: {output_image_path}")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_image_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # --- Configuration ---
    input_file = "static/images/logo3.png"  # Replace with your input PNG file name
    output_file = "static/images/logo4.png" # Desired output file name
    # ---------------------

    remove_white_background(input_file, output_file)