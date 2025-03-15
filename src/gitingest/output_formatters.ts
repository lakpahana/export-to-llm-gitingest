/**
 * Functions to ingest and analyze a codebase directory or single file.
 */

import { FileSystemNode, FileSystemNodeType } from './types/filesystem_schema';
import { IngestionQuery } from './types/ingestion_schema';

/**
 * Generate a summary, directory structure, and file contents for a given file system node.
 * 
 * If the node represents a directory, the function will recursively process its contents.
 * 
 * @param node - The file system node to be summarized
 * @param query - The parsed query object containing information about the repository and query parameters
 * @returns A tuple containing the summary, directory structure, and file contents
 */
export function formatNode(node: FileSystemNode, query: IngestionQuery): [string, string, string] {
    const is_single_file = node.type === FileSystemNodeType.FILE;
    let summary = createSummaryPrefix(query, is_single_file);

    if (node.type === FileSystemNodeType.DIRECTORY) {
        summary += `Files analyzed: ${node.file_count}\n`;
    } else {
        summary += `File: ${node.name}\n`;
        summary += `Lines: ${node.content.split('\n').length.toLocaleString()}\n`;
    }

    const tree = "Directory structure:\n" + createTreeStructure(query, node);
    const content = gatherFileContents(node);

    const token_estimate = formatTokenCount(tree + content);
    if (token_estimate) {
        summary += `\nEstimated tokens: ${token_estimate}`;
    }

    return [summary, tree, content];
}

/**
 * Create a prefix string for summarizing a repository or local directory.
 * 
 * Includes repository name (if provided), commit/branch details, and subpath if relevant.
 * 
 * @param query - The parsed query object containing information about the repository and query parameters
 * @param single_file - A flag indicating whether the summary is for a single file
 * @returns A summary prefix string containing repository, commit, branch, and subpath details
 */
function createSummaryPrefix(query: IngestionQuery, single_file: boolean = false): string {
    const parts: string[] = [];

    if (query.user_name) {
        parts.push(`Repository: ${query.user_name}/${query.repo_name}`);
    } else {
        // Local scenario
        parts.push(`Directory: ${query.slug}`);
    }

    if (query.commit) {
        parts.push(`Commit: ${query.commit}`);
    } else if (query.branch && !["main", "master"].includes(query.branch.toLowerCase())) {
        parts.push(`Branch: ${query.branch}`);
    }

    if (query.subpath !== "/" && !single_file) {
        parts.push(`Subpath: ${query.subpath}`);
    }

    return parts.join('\n') + '\n';
}

/**
 * Recursively gather contents of all files under the given node.
 * 
 * This function recursively processes a directory node and gathers the contents of all files
 * under that node. It returns the concatenated content of all files as a single string.
 * 
 * @param node - The current directory or file node being processed
 * @returns The concatenated content of all files under the given node
 */
function gatherFileContents(node: FileSystemNode): string {
    if (node.type === FileSystemNodeType.FILE) {
        // Get file extension for syntax highlighting
        const ext = node.name.split('.').pop() || '';
        // Format content with markdown code block and file path
        return `### ${node.path_str}\n\`\`\`${ext}\n${node.contentString}\n\`\`\`\n`;
    }

    // Process all children (both files and directories) recursively
    return node.children
        .map(child => gatherFileContents(child))
        .join('\n');
}

/**
 * Generate a tree-like string representation of the file structure.
 * 
 * This function generates a string representation of the directory structure, formatted
 * as a tree with appropriate indentation for nested directories and files.
 * 
 * @param query - The parsed query object containing information about the repository and query parameters
 * @param node - The current directory or file node being processed
 * @param prefix - A string used for indentation and formatting of the tree structure
 * @param is_last - A flag indicating whether the current node is the last in its directory
 * @returns A string representing the directory structure formatted as a tree
 */
function createTreeStructure(
    query: IngestionQuery,
    node: FileSystemNode,
    prefix: string = "",
    is_last: boolean = true
): string {
    if (!node.name) {
        // If no name is present, use the slug as the top-level directory name
        node.name = query.slug;
    }

    let tree_str = "";
    const current_prefix = is_last ? "└── " : "├── ";

    // Indicate directories with a trailing slash
    let display_name = node.name;
    if (node.type === FileSystemNodeType.DIRECTORY) {
        display_name += "/";
    }

    tree_str += `${prefix}${current_prefix}${display_name}\n`;

    if (node.type === FileSystemNodeType.DIRECTORY && node.children.length > 0) {
        const new_prefix = prefix + (is_last ? "    " : "│   ");
        node.children.forEach((child, index) => {
            tree_str += createTreeStructure(
                query,
                child,
                new_prefix,
                index === node.children.length - 1
            );
        });
    }
    return tree_str;
}

/**
 * Return a human-readable string representing the token count of the given text.
 * 
 * E.g., '120' -> '120', '1200' -> '1.2k', '1200000' -> '1.2M'.
 * 
 * Note: In TypeScript version, we're using a simple character-based estimation
 * since we don't have direct access to tiktoken. For production use,
 * you would want to use a proper tokenizer.
 * 
 * @param text - The text string for which the token count is to be estimated
 * @returns The formatted number of tokens as a string (e.g., '1.2k', '1.2M'), or undefined if an error occurs
 */
function formatTokenCount(text: string): string | undefined {
    try {
        // Simple estimation: ~4 characters per token on average
        const total_tokens = Math.ceil(text.length / 4);

        if (total_tokens >= 1_000_000) {
            return `${(total_tokens / 1_000_000).toFixed(1)}M`;
        }

        if (total_tokens >= 1_000) {
            return `${(total_tokens / 1_000).toFixed(1)}k`;
        }

        return total_tokens.toString();
    } catch (error) {
        console.error(error);
        return undefined;
    }
}
