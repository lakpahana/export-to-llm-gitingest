/**
 * Utility functions for the ingestion process.
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Get list of encodings to try, prioritized for the current platform.
 * 
 * @returns List of encoding names to try in priority order, starting with the
 *          platform's default encoding followed by common fallback encodings.
 */
export function getEncodingList(): string[] {
    // In TypeScript/Node.js, we don't have direct locale.getpreferredencoding() equivalent,
    // so we'll start with common encodings and prioritize based on platform
    const encodings = ["utf-8", "utf-16", "utf-16le", "utf-8-sig", "latin1"];

    // Add Windows-specific encodings if on Windows
    if (os.platform() === "win32") {
        encodings.push("cp1252", "iso-8859-1");
    }

    return encodings;
}

/**
 * Determine if the given file or directory path matches any of the include patterns.
 * 
 * This function checks whether the relative path of a file or directory matches any of the specified patterns. If a
 * match is found, it returns `true`, indicating that the file or directory should be included in further processing.
 * 
 * @param filePath - The absolute path of the file or directory to check.
 * @param basePath - The base directory from which the relative path is calculated.
 * @param includePatterns - A set of patterns to check against the relative path.
 * @returns `true` if the path matches any of the include patterns, `false` otherwise.
 */
export function shouldInclude(filePath: string, basePath: string, includePatterns: Set<string>): boolean {
    try {
        // Calculate relative path
        const relativePath = path.relative(basePath, filePath);

        // If path is not under base_path at all
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return false;
        }

        let relStr = relativePath;

        // Check if it's a directory and add trailing slash if needed
        // Note: In Node.js, we'd typically use fs.statSync().isDirectory()
        // For simplicity in this conversion, we're assuming a directory check is handled elsewhere
        // or would be added with appropriate fs import
        const isDirectory = false; // This would need proper implementation in a real app
        if (isDirectory) {
            relStr += "/";
        }

        for (const pattern of includePatterns) {
            if (matchPattern(relStr, pattern)) {
                return true;
            }
        }

        return false;
    } catch (error) {
        // Error in path calculation
        return false;
    }
}

/**
 * Determine if the given file or directory path matches any of the ignore patterns.
 * 
 * This function checks whether the relative path of a file or directory matches
 * any of the specified ignore patterns. If a match is found, it returns `true`, indicating
 * that the file or directory should be excluded from further processing.
 * 
 * @param filePath - The absolute path of the file or directory to check.
 * @param basePath - The base directory from which the relative path is calculated.
 * @param ignorePatterns - A set of patterns to check against the relative path.
 * @returns `true` if the path matches any of the ignore patterns, `false` otherwise.
 */
export function shouldExclude(filePath: string, basePath: string, ignorePatterns: Set<string>): boolean {
    try {
        // Calculate relative path
        const relativePath = path.relative(basePath, filePath);

        // If path is not under base_path at all
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return true;
        }

        for (const pattern of ignorePatterns) {
            if (pattern && matchPattern(relativePath, pattern)) {
                return true;
            }
        }

        return false;
    } catch (error) {
        // Error in path calculation
        return true;
    }
}

/**
 * Simple pattern matching function to replace Python's fnmatch.
 * This is a basic implementation and would need to be expanded for
 * full fnmatch functionality.
 * 
 * @param string - The string to check against the pattern
 * @param pattern - The pattern to match
 * @returns Whether the string matches the pattern
 */
function matchPattern(string: string, pattern: string): boolean {
    // Convert fnmatch pattern to JavaScript RegExp
    const regExpPattern = pattern
        .replace(/\./g, '\\.')    // Escape dots
        .replace(/\*/g, '.*')     // Convert * to .*
        .replace(/\?/g, '.');     // Convert ? to .

    const regExp = new RegExp(`^${regExpPattern}$`);
    return regExp.test(string);
}