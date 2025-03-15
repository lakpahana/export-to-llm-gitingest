/**
 * Functions to ingest and analyze a codebase directory or single file.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as toml from '@iarna/toml';

import { MAX_DIRECTORY_DEPTH, MAX_FILES, MAX_TOTAL_SIZE_BYTES } from './config';
import { FileSystemNode, FileSystemNodeType, FileSystemStats } from './types/filesystem_schema';
import { formatNode } from './output_formatters';
import { IngestionQuery } from './types/ingestion_schema';
import { shouldExclude, shouldInclude } from './utils/ingestion_utils';
import { isSafeSymlink } from './utils/path_utils';

/** Interface for .gitingest file configuration */
interface GitingestConfig {
    config?: {
        ignore_patterns?: string | string[];
    };
}

/**
 * Run the ingestion process for a parsed query.
 * 
 * This is the main entry point for analyzing a codebase directory or single file. It processes the query
 * parameters, reads the file or directory content, and generates a summary, directory structure, and file content,
 * along with token estimations.
 * 
 * @param query - The parsed query object containing information about the repository and query parameters
 * @returns A tuple containing the summary, directory structure, and file contents
 * @throws Error if the path cannot be found, is not a file, or the file has no content
 */
export async function ingestQuery(query: IngestionQuery): Promise<[string, string, string]> {
    const subpath = path.posix.join(...query.subpath.split('/').filter(Boolean));
    const targetPath = path.join(query.local_path, subpath);

    await applyGitingestFile(targetPath, query);

    try {
        await fs.access(targetPath);
    } catch {
        throw new Error(`${query.slug} cannot be found`);
    }

    const stats = await fs.stat(targetPath);

    if ((query.type && query.type === "blob") || stats.isFile()) {
        if (!stats.isFile()) {
            throw new Error(`Path ${targetPath} is not a file`);
        }

        const relativePath = path.relative(query.local_path, targetPath);

        const file_node = new FileSystemNode(
            path.basename(targetPath),
            FileSystemNodeType.FILE,
            relativePath,
            targetPath
        );
        file_node.size = stats.size;
        file_node.file_count = 1;

        if (!file_node.content) {
            throw new Error(`File ${file_node.name} has no content`);
        }

        return formatNode(file_node, query);
    }

    const root_node = new FileSystemNode(
        path.basename(targetPath),
        FileSystemNodeType.DIRECTORY,
        path.relative(query.local_path, targetPath),
        targetPath
    );

    const stats_tracker = new FileSystemStats();

    await processNode(root_node, query, stats_tracker);

    return formatNode(root_node, query);
}

/**
 * Apply the .gitingest file to the query object.
 * 
 * This function reads the .gitingest file in the specified path and updates the query object with the ignore
 * patterns found in the file.
 * 
 * @param filePath - The path of the directory to ingest
 * @param query - The parsed query object containing information about the repository and query parameters
 */
async function applyGitingestFile(filePath: string, query: IngestionQuery): Promise<void> {
    const gitingestPath = path.join(filePath, ".gitingest");

    try {
        await fs.access(gitingestPath);
    } catch {
        return;
    }

    try {
        const content = await fs.readFile(gitingestPath, 'utf-8');
        const data = toml.parse(content) as GitingestConfig;

        const ignorePatterns = data.config?.ignore_patterns;
        if (!ignorePatterns) {
            return;
        }

        // If a single string is provided, make it a list of one element
        const patterns = Array.isArray(ignorePatterns) ? ignorePatterns : [ignorePatterns];

        // Filter out any non-string entries
        const validPatterns = new Set(patterns.filter(pattern => typeof pattern === 'string'));
        const invalidPatterns = patterns.filter(pattern => typeof pattern !== 'string');

        if (invalidPatterns.length > 0) {
            console.warn(`Ignore patterns ${invalidPatterns} are not strings. Skipping.`);
        }

        if (validPatterns.size === 0) {
            return;
        }

        if (!query.ignore_patterns) {
            query.ignore_patterns = validPatterns;
        } else {
            validPatterns.forEach(pattern => query.ignore_patterns!.add(pattern));
        }
    } catch (error) {
        console.warn(`Invalid TOML in ${gitingestPath}: ${error}`);
    }
}

/**
 * Process a file or directory item within a directory.
 * 
 * This function handles each file or directory item, checking if it should be included or excluded based on the
 * provided patterns. It handles symlinks, directories, and files accordingly.
 * 
 * @param node - The current directory or file node being processed
 * @param query - The parsed query object containing information about the repository and query parameters
 * @param stats - Statistics tracking object for the total file count and size
 * @throws Error if an unexpected error occurs during processing
 */
async function processNode(
    node: FileSystemNode,
    query: IngestionQuery,
    stats: FileSystemStats
): Promise<void> {
    if (limitExceeded(stats, node.depth)) {
        return;
    }

    const entries = await fs.readdir(node.path, { withFileTypes: true });

    for (const entry of entries) {
        // console.log(`Processing ${entry.name} in ${node.path}`);
        const entryPath = path.join(node.path, entry.name);

        let symlink_path: string | undefined;
        let targetPath = entryPath;

        if (entry.isSymbolicLink()) {
            if (!await isSafeSymlink(entryPath, query.local_path)) {
                console.log(`Skipping unsafe symlink: ${entryPath}`);
                continue;
            }

            symlink_path = entryPath;
            targetPath = await fs.realpath(entryPath);
        }

        if (stats.visited.has(targetPath)) {
            console.log(`Skipping already visited path: ${targetPath}`);
            continue;
        }

        stats.visited.add(targetPath);

        if (query.ignore_patterns && shouldExclude(targetPath, query.local_path, query.ignore_patterns)) {
            continue;
        }

        if (query.include_patterns && !shouldInclude(targetPath, query.local_path, query.include_patterns)) {
            continue;
        }

        const targetStats = await fs.stat(targetPath);
        // console.log(`Processing ${targetPath}`);
        // console.log(`Stats: ${JSON.stringify(targetStats)}`);
        if (targetStats.isFile()) {
            // console.log(`Processing file ${targetPath}`);
            await processFile(targetPath, node, stats, query.local_path);
        } else if (targetStats.isDirectory()) {
            // console.log(`Processing directory ${targetPath}`);
            const child_directory_node = new FileSystemNode(
                path.basename(targetPath),
                FileSystemNodeType.DIRECTORY,
                path.relative(query.local_path, targetPath),
                targetPath
            );
            child_directory_node.depth = node.depth + 1;

            // rename the subdir to reflect the symlink name
            if (symlink_path) {
                child_directory_node.name = path.basename(symlink_path);
                child_directory_node.path_str = symlink_path;
            }

            await processNode(child_directory_node, query, stats);
            node.children.push(child_directory_node);
            node.size += child_directory_node.size;
            node.file_count += child_directory_node.file_count;
            node.dir_count += 1 + child_directory_node.dir_count;
        } else {
            throw new Error(`Unexpected error: ${targetPath} is neither a file nor a directory`);
        }
    }

    node.sortChildren();
}

/**
 * Process a file in the file system.
 * 
 * This function checks the file's size, increments the statistics, and reads its content.
 * If the file size exceeds the maximum allowed, it raises an error.
 * 
 * @param filePath - The full path of the file
 * @param parent_node - The parent node to add this file to
 * @param stats - Statistics tracking object for the total file count and size
 * @param local_path - The base path of the repository or directory being processed
 */
async function processFile(
    filePath: string,
    parent_node: FileSystemNode,
    stats: FileSystemStats,
    local_path: string
): Promise<void> {
    const fileStats = await fs.stat(filePath);
    const file_size = fileStats.size;

    if (stats.total_size + file_size > MAX_TOTAL_SIZE_BYTES) {
        console.log(`Skipping file ${filePath}: would exceed total size limit`);
        return;
    }

    stats.total_files += 1;
    stats.total_size += file_size;

    if (stats.total_files > MAX_FILES) {
        console.log(`Maximum file limit (${MAX_FILES}) reached`);
        return;
    }

    const child = new FileSystemNode(
        path.basename(filePath),
        FileSystemNodeType.FILE,
        path.relative(local_path, filePath),
        filePath
    );
    child.size = file_size;
    child.file_count = 1;
    child.depth = parent_node.depth + 1;

    parent_node.children.push(child);
    parent_node.size += file_size;
    parent_node.file_count += 1;
}

/**
 * Check if any of the traversal limits have been exceeded.
 * 
 * This function checks if the current traversal has exceeded any of the configured limits:
 * maximum directory depth, maximum number of files, or maximum total size in bytes.
 * 
 * @param stats - Statistics tracking object for the total file count and size
 * @param depth - The current depth of directory traversal
 * @returns True if any limit has been exceeded, False otherwise
 */
function limitExceeded(stats: FileSystemStats, depth: number): boolean {
    if (depth > MAX_DIRECTORY_DEPTH) {
        console.log(`Maximum depth limit (${MAX_DIRECTORY_DEPTH}) reached`);
        return true;
    }

    if (stats.total_files >= MAX_FILES) {
        console.log(`Maximum file limit (${MAX_FILES}) reached`);
        return true;
    }

    if (stats.total_size >= MAX_TOTAL_SIZE_BYTES) {
        console.log(`Maximum total size limit (${(MAX_TOTAL_SIZE_BYTES / 1024 / 1024).toFixed(1)}MB) reached`);
        return true;
    }

    return false;
}
