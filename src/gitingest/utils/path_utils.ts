/**
 * Utility functions for working with file paths.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Check if a symlink points to a location within the base directory.
 * 
 * This function resolves the target of a symlink and ensures it is within the specified
 * base directory, returning `true` if it is safe, or `false` if the symlink points outside
 * the base directory.
 * 
 * @param symlink_path - The path of the symlink to check
 * @param base_path - The base directory to ensure the symlink points within
 * @returns `true` if the symlink points within the base directory, `false` otherwise
 */
export async function isSafeSymlink(symlink_path: string, base_path: string): Promise<boolean> {
    try {
        // On Windows, first check if it's actually a symlink
        if (os.platform() === 'win32') {
            try {
                const stats = fs.lstatSync(symlink_path);
                if (!stats.isSymbolicLink()) {
                    return false;
                }
            } catch {
                return false;
            }
        }

        // Resolve both paths to their real absolute paths
        const target_path = await fs.promises.realpath(symlink_path);
        const base_resolved = await fs.promises.realpath(base_path);

        // Check if base_resolved is a parent of target_path or if they're the same
        const relative = path.relative(base_resolved, target_path);
        return !relative.startsWith('..') && !path.isAbsolute(relative);
    } catch {
        // If there's any error resolving the paths, consider it unsafe
        return false;
    }
}
