import os

def compile_directory_contents(root_dir, output_file_path, readable_extensions=None):
    """
    Compiles a directory's file structure and the contents of specified file types
    into a single text file.

    Args:
        root_dir (str): The path to the directory to be compiled.
        output_file_path (str): The path to the output text file.
        readable_extensions (list, optional): A list of file extensions to read.
            Defaults to a common list of text-based files.
    """
    # Default list of extensions for files that can be read by a text editor
    if readable_extensions is None:
        readable_extensions = ['.txt', '.js', '.html', '.css', '.py', '.json',
                               '.md', '.log', '.xml', '.yml', '.yaml', '.sh']

    # Normalize extensions to be lowercase for consistent checking
    readable_extensions = [ext.lower() for ext in readable_extensions]

    # Initialize an empty list to store the output lines
    output_lines = []
    output_lines.append(f"## Directory Compilation for: {os.path.abspath(root_dir)}\n\n")

    try:
        # Use os.walk to traverse the directory tree
        for dirpath, dirnames, filenames in os.walk(root_dir):
            # Calculate the relative path for a clean tree structure
            relative_path = os.path.relpath(dirpath, root_dir)

            # Ignore the root directory itself in the tree view if it's the current directory
            if relative_path == ".":
                relative_path = ""

            # Add directory path to the output with indentation
            indent_level = len(relative_path.split(os.sep)) - 1
            if relative_path:
                output_lines.append(f"{'  ' * indent_level}├── {os.path.basename(dirpath)}{os.sep}\n")

            # Add files to the output with indentation
            for filename in filenames:
                output_lines.append(f"{'  ' * (indent_level + 1)}├── {filename}\n")

            # Add a separator between the file tree and file contents
            if not output_lines[-1].endswith('\n'):
                output_lines.append('\n')

        output_lines.append("\n" + "="*80 + "\n\n")
        output_lines.append("## File Contents\n\n")

        # Now, iterate through the directory again to read file contents
        for dirpath, _, filenames in os.walk(root_dir):
            for filename in filenames:
                file_path = os.path.join(dirpath, filename)
                file_extension = os.path.splitext(filename)[1].lower()

                # Check if the file's extension is in our list of readable types
                if file_extension in readable_extensions:
                    output_lines.append(f"### File: {file_path}\n")
                    output_lines.append("-" * (len(f"### File: {file_path}") - 1) + "\n")
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            # Read and add the file's content to the output
                            content = f.read()
                            output_lines.append(content)
                            output_lines.append("\n\n") # Add a newline for separation
                    except (IOError, UnicodeDecodeError) as e:
                        output_lines.append(f"[ERROR] Could not read file: {e}\n\n")

    except FileNotFoundError:
        print(f"Error: The directory '{root_dir}' was not found.")
        return
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return

    # Write the collected output to the specified file
    try:
        with open(output_file_path, 'w', encoding='utf-8') as outfile:
            outfile.writelines(output_lines)
        print(f"Successfully compiled contents to '{output_file_path}'")
    except IOError as e:
        print(f"Error: Could not write to the output file '{output_file_path}': {e}")

# --- Example Usage ---
if __name__ == "__main__":
    # Specify the directory you want to compile.
    # Replace 'path/to/your/folder' with the actual path.
    # The '.' indicates the current directory.
    directory_to_compile = "."

    # Specify the name for the output file
    output_filename = "compiled_directory_contents.txt"

    # Call the function to run the compilation
    compile_directory_contents(directory_to_compile, output_filename)
