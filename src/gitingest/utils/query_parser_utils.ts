/**
 * Utility functions for parsing and validating repository queries.
 */

/** Known Git hosting services */
export const KNOWN_GIT_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org'];

/** Valid URL schemes */
const VALID_SCHEMES = ['http', 'https'];

/**
 * Validate that a URL scheme is supported.
 * 
 * @param scheme - The URL scheme to validate
 * @throws Error if the scheme is not supported
 */
export function validateUrlScheme(scheme: string): void {
    if (!VALID_SCHEMES.includes(scheme.toLowerCase())) {
        throw new Error(`Unsupported URL scheme: ${scheme}. Must be one of: ${VALID_SCHEMES.join(', ')}`);
    }
}

/**
 * Validate that a host is a known Git hosting service.
 * 
 * @param host - The host to validate
 * @throws Error if the host is not a known Git hosting service
 */
export function validateHost(host: string): void {
    if (!KNOWN_GIT_HOSTS.includes(host.toLowerCase())) {
        throw new Error(`Unsupported Git host: ${host}. Must be one of: ${KNOWN_GIT_HOSTS.join(', ')}`);
    }
}

/**
 * Extract user and repository names from a URL path.
 * 
 * @param path - The URL path to parse
 * @returns A tuple containing the user name and repository name
 * @throws Error if the path format is invalid
 */
export function getUserAndRepoFromPath(path: string): [string, string] {
    const parts = path.split('/').filter(p => p.length > 0);
    
    if (parts.length < 2) {
        throw new Error('Invalid repository path. Must be in format: user/repo');
    }

    return [parts[0], parts[1]];
}

/**
 * Check if a string is a valid Git commit hash.
 * 
 * @param hash - The string to check
 * @returns true if the string is a valid Git commit hash
 */
export function isValidGitCommitHash(hash: string): boolean {
    return /^[0-9a-f]{7,40}$/i.test(hash);
}

/**
 * Validate a pattern string for allowed characters.
 * 
 * @param pattern - The pattern to validate
 * @returns true if the pattern is valid
 */
export function isValidPattern(pattern: string): boolean {
    // Only allow alphanumeric characters, dash (-), underscore (_), dot (.), forward slash (/), plus (+), and asterisk (*)
    return /^[a-zA-Z0-9\-_./+*]+$/.test(pattern);
}

/**
 * Normalize a pattern string by removing extra spaces and slashes.
 * 
 * @param pattern - The pattern to normalize
 * @returns The normalized pattern
 */
export function normalizePattern(pattern: string): string {
    // Remove leading/trailing whitespace and slashes
    return pattern.trim().replace(/^\/+|\/+$/g, '');
}
