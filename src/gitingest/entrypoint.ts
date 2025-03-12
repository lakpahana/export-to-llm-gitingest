/**
 * Main entry point for ingesting a source and processing its contents.
 */

import * as fs from 'fs/promises';
import { rimraf } from 'rimraf';

import { clone } from './cloning';
import { TMP_BASE_PATH } from './config';
import { ingestQuery } from './ingestion';
import { parseQuery } from './query_parsing';
import { IngestionQuery } from './types/ingestion_schema';

/**
 * Main entry point for ingesting a source and processing its contents.
 * 
 * This function analyzes a source (URL or local path), clones the corresponding repository (if applicable),
 * and processes its files according to the specified query parameters. It returns a summary, a tree-like
 * structure of the files, and the content of the files. The results can optionally be written to an output file.
 * 
 * @param source - The source to analyze, which can be a URL (for a Git repository) or a local directory path
 * @param max_file_size - Maximum allowed file size for file ingestion. Files larger than this size are ignored
 * @param include_patterns - Pattern or set of patterns specifying which files to include
 * @param exclude_patterns - Pattern or set of patterns specifying which files to exclude
 * @param branch - The branch to clone and ingest
 * @param output - File path where the summary and content should be written
 * @returns A tuple containing summary string, tree-like structure, and file contents
 * @throws Error if clone operation fails or if source type is unsupported
 */
export async function ingestAsync(
    source: string,
    max_file_size: number = 10 * 1024 * 1024, // 10 MB
    include_patterns?: Set<string> | string,
    exclude_patterns?: Set<string> | string,
    branch?: string,
    output?: string,
): Promise<[string, string, string]> {
    let repo_cloned = false;

    try {
        const query: IngestionQuery = await parseQuery({
            source,
            max_file_size,
            from_web: false,
            include_patterns,
            ignore_patterns: exclude_patterns,
        });

        if (query.url) {
            // prioritize branch argument
            const selected_branch = branch || query.branch;
            query.branch = selected_branch;

            const clone_config = extractCloneConfig(query);
            await clone(clone_config);
            repo_cloned = true;
        }

        const [summary, tree, content] = await ingestQuery(query);

        if (output) {
            await fs.writeFile(output, tree + "\n" + content, 'utf-8');
        }

        return [summary, tree, content];
    } finally {
        // Clean up the temporary directory if it was created
        if (repo_cloned) {
            try {
                await rimraf(TMP_BASE_PATH);
            } catch (error) {
                console.warn(`Failed to clean up temporary directory: ${error}`);
            }
        }
    }
}

/**
 * Synchronous version of ingestAsync.
 * 
 * This function analyzes a source (URL or local path), clones the corresponding repository (if applicable),
 * and processes its files according to the specified query parameters. It returns a summary, a tree-like
 * structure of the files, and the content of the files. The results can optionally be written to an output file.
 * 
 * Note: In TypeScript/Node.js, we don't have a direct equivalent to Python's asyncio.run().
 * Instead, we're using a Promise-based approach. The function is still marked as async
 * because Node.js doesn't have a synchronous event loop like Python.
 * 
 * @param source - The source to analyze, which can be a URL (for a Git repository) or a local directory path
 * @param max_file_size - Maximum allowed file size for file ingestion. Files larger than this size are ignored
 * @param include_patterns - Pattern or set of patterns specifying which files to include
 * @param exclude_patterns - Pattern or set of patterns specifying which files to exclude
 * @param branch - The branch to clone and ingest
 * @param output - File path where the summary and content should be written
 * @returns A Promise that resolves to a tuple containing summary string, tree-like structure, and file contents
 * @see ingestAsync - The main asynchronous version of this function
 */
export async function ingest(
    source: string,
    max_file_size: number = 10 * 1024 * 1024, // 10 MB
    include_patterns?: Set<string> | string,
    exclude_patterns?: Set<string> | string,
    branch?: string,
    output?: string,
): Promise<[string, string, string]> {
    return ingestAsync(
        source,
        max_file_size,
        include_patterns,
        exclude_patterns,
        branch,
        output
    );
}

/**
 * Helper function to extract clone configuration from an IngestionQuery.
 * This is used internally by ingestAsync.
 * 
 * @param query - The IngestionQuery to extract configuration from
 * @returns The clone configuration object
 */
function extractCloneConfig(query: IngestionQuery) {
    if (!query.url) {
        throw new Error("URL is required for cloning");
    }

    return {
        url: query.url,
        local_path: query.local_path,
        commit: query.commit,
        branch: query.branch,
        subpath: query.subpath || "/",
        blob: query.type === "blob"
    };
}
