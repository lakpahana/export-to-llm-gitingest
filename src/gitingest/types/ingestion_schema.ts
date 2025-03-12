/**
 * This module contains the interfaces and types for the ingestion process.
 */

import { v4 as uuidv4 } from 'uuid';
import { MAX_FILE_SIZE } from '../config';

/**
 * Configuration for cloning a Git repository.
 * 
 * This interface holds the necessary parameters for cloning a repository to a local path, including
 * the repository's URL, the target local path, and optional parameters for a specific commit or branch.
 */
export interface CloneConfig {
    /** The URL of the Git repository to clone */
    url: string;
    /** The local directory where the repository will be cloned */
    local_path: string;
    /** The specific commit hash to check out after cloning */
    commit?: string;
    /** The branch to clone */
    branch?: string;
    /** The subpath to clone from the repository */
    subpath: string;
    /** Whether this is a blob (file) or tree (directory) */
    blob: boolean;
}

/**
 * Model to store the parsed details of the repository or file path.
 */
export interface IngestionQuery {
    /** Username or organization name */
    user_name?: string;
    /** Repository name */
    repo_name?: string;
    /** Local path where the repository will be cloned */
    local_path: string;
    /** Repository URL */
    url?: string;
    /** Unique identifier for the repository */
    slug: string;
    /** Unique identifier for this query */
    id: string;
    /** Subpath within the repository */
    subpath: string;
    /** Type of the resource (e.g., "blob" or "tree") */
    type: string;
    /** Branch name */
    branch?: string;
    /** Commit hash */
    commit?: string;
    /** Maximum file size to process */
    max_file_size: number;
    /** Patterns to ignore */
    ignore_patterns: Set<string>;
    /** Patterns to include */
    include_patterns?: Set<string>;
}

/**
 * Create a new IngestionQuery with default values.
 * 
 * @param params - Partial IngestionQuery parameters to override defaults
 * @returns A complete IngestionQuery object with all required fields
 */
export function createIngestionQuery(params: Partial<IngestionQuery>): IngestionQuery {
    const id = params.id || uuidv4();
    const slug = params.slug || `query-${id}`;
    
    return {
        local_path: params.local_path || '',  // This must be set by the caller
        slug,
        id,
        type: params.type || 'tree',
        subpath: params.subpath || '/',
        max_file_size: params.max_file_size || MAX_FILE_SIZE,
        ignore_patterns: params.ignore_patterns || new Set(),
        // Optional fields
        user_name: params.user_name,
        repo_name: params.repo_name,
        url: params.url,
        branch: params.branch,
        commit: params.commit,
        include_patterns: params.include_patterns,
    };
}

/**
 * Extract clone configuration from an IngestionQuery
 * 
 * @param query - The IngestionQuery to extract configuration from
 * @returns A CloneConfig object containing the relevant fields
 * @throws Error if the 'url' parameter is not provided
 */
export function extractCloneConfig(query: IngestionQuery): CloneConfig {
    if (!query.url) {
        throw new Error("The 'url' parameter is required.");
    }

    return {
        url: query.url,
        local_path: query.local_path,
        commit: query.commit,
        branch: query.branch,
        subpath: query.subpath,
        blob: query.type === "blob"
    };
}
