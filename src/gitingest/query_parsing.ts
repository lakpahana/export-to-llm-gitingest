/**
 * This module contains functions to parse and validate input sources and patterns.
 */

import { URL } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

import { checkRepoExists, fetchRemoteBranchList } from './cloning';
import { TMP_BASE_PATH } from './config';
import { InvalidPatternError } from './errors/exceptions';
import { IngestionQuery, createIngestionQuery } from './types/ingestion_schema';
import { DEFAULT_IGNORE_PATTERNS } from './utils/ignore_patterns';
import {
    KNOWN_GIT_HOSTS,
    getUserAndRepoFromPath,
    isValidGitCommitHash,
    isValidPattern,
    normalizePattern,
    validateHost,
    validateUrlScheme,
} from './utils/query_parser_utils';

/**
 * Parse the input source (URL or path) to extract relevant details for the query.
 * 
 * @param source - The source URL or file path to parse
 * @param max_file_size - The maximum file size in bytes to include
 * @param from_web - Flag indicating whether the source is a web URL
 * @param include_patterns - Patterns to include (optional)
 * @param ignore_patterns - Patterns to ignore (optional)
 * @returns A query object containing the parsed details
 */
export async function parseQuery(
    params: {
        source: string;
        max_file_size: number;
        from_web: boolean;
        include_patterns?: Set<string> | string;
        ignore_patterns?: Set<string> | string;
    }
): Promise<IngestionQuery> {
    const { source, max_file_size, from_web, include_patterns, ignore_patterns } = params;

    // Determine the parsing method based on the source type
    let query: IngestionQuery;
    if (from_web || /^https?:\/\//.test(source) || KNOWN_GIT_HOSTS.some(h => source.includes(h))) {
        // We either have a full URL or a domain-less slug
        query = await parseRemoteRepo(source);
    } else {
        // Local path scenario
        query = parseLocalDirPath(source);
    }

    // Combine default ignore patterns + custom patterns
    const ignore_patterns_set = new Set(DEFAULT_IGNORE_PATTERNS);
    if (ignore_patterns) {
        parsePatterns(ignore_patterns).forEach(p => ignore_patterns_set.add(p));
    }

    // Process include patterns and override ignore patterns accordingly
    let parsed_include: Set<string> | undefined;
    if (include_patterns) {
        parsed_include = parsePatterns(include_patterns);
        // Override ignore patterns with include patterns
        parsed_include.forEach(p => ignore_patterns_set.delete(p));
    }

    return createIngestionQuery({
        ...query,
        max_file_size,
        ignore_patterns: ignore_patterns_set,
        include_patterns: parsed_include
    });
}

/**
 * Parse a repository URL into a structured query.
 * 
 * @param source - The URL or domain-less slug to parse
 * @returns A query object containing the parsed details
 */
export async function parseRemoteRepo(source: string): Promise<IngestionQuery> {
    source = decodeURIComponent(source);
    let url: URL;

    try {
        url = new URL(source);
        validateUrlScheme(url.protocol.replace(':', ''));
        validateHost(url.hostname.toLowerCase());
    } catch {
        // No scheme or invalid URL
        const parts = source.split('/');
        const tmp_host = parts[0].toLowerCase();

        if (tmp_host.includes('.')) {
            validateHost(tmp_host);
            source = `https://${source}`;
        } else {
            // No scheme, no domain => user typed "user/repo", so we'll guess the domain
            const [user_name, repo_name] = getUserAndRepoFromPath(source);
            const host = await tryDomainsForUserAndRepo(user_name, repo_name);
            source = `https://${host}/${source}`;
        }

        url = new URL(source);
    }

    const host = url.hostname.toLowerCase();
    const [user_name, repo_name] = getUserAndRepoFromPath(url.pathname);

    const id = uuidv4();
    const slug = `${user_name}-${repo_name}`;
    const local_path = path.join(TMP_BASE_PATH, id, slug);
    const final_url = `https://${host}/${user_name}/${repo_name}`;

    const query = createIngestionQuery({
        user_name,
        repo_name,
        url: final_url,
        local_path,
        slug,
        id,
        type: 'tree',
        subpath: '/',
        max_file_size: 0,
        ignore_patterns: new Set()
    });

    const remaining_parts = url.pathname.split('/').filter(p => p.length > 0).slice(2);

    if (!remaining_parts.length) {
        return query;
    }

    const possible_type = remaining_parts.shift()!;

    // If no extra path parts, just return
    if (!remaining_parts.length) {
        return query;
    }

    // If this is an issues page or pull requests, return early without processing subpath
    if (possible_type === 'issues' || possible_type === 'pull') {
        return query;
    }

    query.type = possible_type;

    // Commit or branch
    const commit_or_branch = remaining_parts[0];
    if (isValidGitCommitHash(commit_or_branch)) {
        query.commit = commit_or_branch;
        remaining_parts.shift();
    } else {
        query.branch = await configureBranchAndSubpath(remaining_parts, final_url);
    }

    // Subpath if anything left
    if (remaining_parts.length) {
        query.subpath = '/' + remaining_parts.join('/');
    }

    return query;
}

/**
 * Configure the branch and subpath based on the remaining parts of the URL.
 * 
 * @param remaining_parts - The remaining parts of the URL path
 * @param url - The URL of the repository
 * @returns The branch name if found
 */
async function configureBranchAndSubpath(remaining_parts: string[], url: string): Promise<string | undefined> {
    try {
        const branches = await fetchRemoteBranchList(url);
        const potential_branch = remaining_parts[0];

        if (branches.includes(potential_branch)) {
            remaining_parts.shift();
            return potential_branch;
        }
    } catch (error) {
        console.warn('Failed to fetch branch list:', error);
    }

    return undefined;
}

/**
 * Parse and validate file/directory patterns.
 * 
 * @param pattern - Pattern(s) to parse
 * @returns A set of normalized patterns
 * @throws InvalidPatternError if any pattern contains invalid characters
 */
function parsePatterns(pattern: string | Set<string>): Set<string> {
    const patterns = typeof pattern === 'string' ? pattern.split(/[,\s]+/) : Array.from(pattern);
    const normalized = new Set<string>();

    for (const p of patterns) {
        if (!p) continue;

        if (!isValidPattern(p)) {
            throw new InvalidPatternError(
                `Invalid pattern: ${p}. Only alphanumeric characters, dash (-), underscore (_), ` +
                'dot (.), forward slash (/), plus (+), and asterisk (*) are allowed.'
            );
        }

        normalized.add(normalizePattern(p));
    }

    return normalized;
}

/**
 * Parse a local directory path into a structured query.
 * 
 * @param path_str - The file path to parse
 * @returns A query object containing the parsed details
 */
/**
 * Apply user-defined patterns and settings to a query
 * 
 * @param query - The base query to modify
 * @param params - Object containing max_file_size, ignore_patterns, and include_patterns
 * @returns Modified query with user preferences applied
 */
export function applyPatterns(
    query: IngestionQuery,
    params: {
        max_file_size?: number;
        ignore_patterns?: string[];
        include_patterns?: string[];
    }
): IngestionQuery {
    const {
        max_file_size = 0,
        ignore_patterns = [],
        include_patterns = []
    } = params;

    // Convert arrays to sets for pattern matching
    const ignoreSet = new Set(ignore_patterns.map(normalizePattern));
    const includeSet = new Set(include_patterns.map(normalizePattern));

    // Create new query with updated patterns
    return createIngestionQuery({
        ...query,
        max_file_size,
        ignore_patterns: new Set([...query.ignore_patterns, ...ignoreSet]),
        include_patterns: includeSet.size > 0 ? includeSet : query.include_patterns
    });
}

/**
 * Parse a local directory path into a structured query.
 * 
 * @param path_str - The file path to parse
 * @returns A query object containing the parsed details
 */
export function parseLocalDirPath(path_str: string): IngestionQuery {
    const absolute_path = path.resolve(path_str);
    const id = uuidv4();
    const slug = path.basename(absolute_path);

    return createIngestionQuery({
        local_path: absolute_path,
        slug,
        id,
        type: 'tree',
        ignore_patterns: new Set()
    });
}

/**
 * Attempt to find a valid repository host for the given user_name and repo_name.
 * 
 * @param user_name - The username or owner of the repository
 * @param repo_name - The name of the repository
 * @returns The domain of the valid repository host
 * @throws Error if no valid repository host is found
 */
async function tryDomainsForUserAndRepo(user_name: string, repo_name: string): Promise<string> {
    for (const host of KNOWN_GIT_HOSTS) {
        const url = `https://${host}/${user_name}/${repo_name}`;
        try {
            if (await checkRepoExists(url)) {
                return host;
            }
        } catch {
            continue;
        }
    }

    throw new Error(
        `Could not find repository ${user_name}/${repo_name} on any known hosting service: ` +
        KNOWN_GIT_HOSTS.join(', ')
    );
}
