/**
 * Utility functions for parsing and validating query parameters.
 */

import * as path from 'path';

const HEX_DIGITS: Set<string> = new Set('0123456789ABCDEFabcdef');

const KNOWN_GIT_HOSTS: string[] = [
    "github.com",
    "gitlab.com",
    "bitbucket.org",
    "gitea.com",
    "codeberg.org",
    "gist.github.com",
];

/**
 * Validate if the provided string is a valid Git commit hash.
 * 
 * This function checks if the commit hash is a 40-character string consisting only
 * of hexadecimal digits, which is the standard format for Git commit hashes.
 * 
 * @param commit - The string to validate as a Git commit hash.
 * @returns True if the string is a valid 40-character Git commit hash, otherwise False.
 */
export function isValidGitCommitHash(commit: string): boolean {
    return commit.length === 40 && [...commit].every(c => HEX_DIGITS.has(c));
}

/**
 * Validate if the given pattern contains only valid characters.
 * 
 * This function checks if the pattern contains only alphanumeric characters or one
 * of the following allowed characters: dash (`-`), underscore (`_`), dot (`.`),
 * forward slash (`/`), plus (`+`), asterisk (`*`), or the at sign (`@`).
 * 
 * @param pattern - The pattern to validate.
 * @returns True if the pattern is valid, otherwise False.
 */
export function isValidPattern(pattern: string): boolean {
    return [...pattern].every(c => /[a-zA-Z0-9]/.test(c) || '-_./+*@'.includes(c));
}

/**
 * Validate the given host against the known Git hosts.
 * 
 * @param host - The host to validate.
 * @throws Error if the host is not a known Git host.
 */
export function validateHost(host: string): void {
    if (!KNOWN_GIT_HOSTS.includes(host)) {
        throw new Error(`Unknown domain '${host}' in URL`);
    }
}

/**
 * Validate the given scheme against the known schemes.
 * 
 * @param scheme - The scheme to validate.
 * @throws Error if the scheme is not 'http' or 'https'.
 */
export function validateUrlScheme(scheme: string): void {
    if (scheme !== 'https' && scheme !== 'http') {
        throw new Error(`Invalid URL scheme '${scheme}' in URL`);
    }
}

/**
 * Extract the user and repository names from a given path.
 * 
 * @param urlPath - The path to extract the user and repository names from.
 * @returns A tuple containing the user and repository names.
 * @throws Error if the path does not contain at least two parts.
 */
export function getUserAndRepoFromPath(urlPath: string): [string, string] {
    const pathParts = urlPath.toLowerCase().replace(/^\/|\/$/g, '').split('/');
    if (pathParts.length < 2) {
        throw new Error(`Invalid repository URL '${urlPath}'`);
    }
    return [pathParts[0], pathParts[1]];
}

/**
 * Normalize the given pattern by removing leading separators and appending a wildcard.
 * 
 * This function processes the pattern string by stripping leading directory separators
 * and appending a wildcard (`*`) if the pattern ends with a separator.
 * 
 * @param pattern - The pattern to normalize.
 * @returns The normalized pattern.
 */
export function normalizePattern(pattern: string): string {
    const separator = path.sep;
    let normalizedPattern = pattern;

    // Remove leading separator
    while (normalizedPattern.startsWith(separator)) {
        normalizedPattern = normalizedPattern.substring(separator.length);
    }

    // Append wildcard if pattern ends with separator
    if (normalizedPattern.endsWith(separator)) {
        normalizedPattern += '*';
    }

    return normalizedPattern;
}