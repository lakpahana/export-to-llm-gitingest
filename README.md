# Gitingest VS Code Extension

A powerful VS Code extension for analyzing and exporting codebases to LLM-friendly formats. This extension allows you to analyze both local directories and remote Git repositories, providing structured output with summaries, directory structures, and file contents.


## Extension Settings

This extension contributes the following settings:

* `gitingest.maxFileSize`: Maximum file size in bytes to process (default: 1MB)
* `gitingest.ignorePatterns`: Array of glob patterns to ignore (default: [".git/**", "node_modules/**", "__pycache__/**"])
* `gitingest.includePatterns`: Array of glob patterns to explicitly include (overrides ignore patterns)

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Gitingest" to see available commands:
   - `Gitingest: Ingest Local Directory`: Analyze a local directory
   - `Gitingest: Ingest Git Repository`: Analyze a remote Git repository
3. Follow the prompts to select a directory or enter a repository URL
4. View the results in a new Markdown document

