/**
 * This module contains functions for cloning a Git repository to a local path.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { CloneConfig } from './types/ingestion_schema';
import { asyncTimeout } from './utils/timeout_wrapper';

/** Timeout in seconds for clone operations */
export const TIMEOUT = 60;

/**
 * Clone a repository to a local path based on the provided configuration.
 * 
 * This function handles the process of cloning a Git repository to the local file system.
 * It can clone a specific branch or commit if provided, and it raises exceptions if
 * any errors occur during the cloning process.
 * 
 * @param config - The configuration for cloning the repository
 * @throws Error if the repository is not found or if the provided URL is invalid
 * @throws Error if an error occurs while creating the parent directory for the repository
 */
export const clone = asyncTimeout(TIMEOUT)(async (config: CloneConfig): Promise<void> => {
    // Extract and validate query parameters
    const { url, local_path, commit, branch } = config;
    const partial_clone = config.subpath !== "/";

    // Create parent directory if it doesn't exist
    const parent_dir = path.dirname(local_path);
    try {
        await fs.mkdir(parent_dir, { recursive: true });
    } catch (exc) {
        throw new Error(`Failed to create parent directory ${parent_dir}: ${exc}`);
    }

    // Check if the repository exists
    if (!(await checkRepoExists(url))) {
        throw new Error("Repository not found, make sure it is public");
    }

    const clone_cmd = ["clone", "--single-branch"];
    // TODO re-enable --recurse-submodules

    if (partial_clone) {
        clone_cmd.push("--filter=blob:none", "--sparse");
    }

    if (!commit) {
        clone_cmd.push("--depth=1");
        if (branch && branch.toLowerCase() !== "main" && branch.toLowerCase() !== "master") {
            clone_cmd.push("--branch", branch);
        }
    }

    clone_cmd.push(url, local_path);

    // Clone the repository
    await runCommand("git", clone_cmd);

    if (commit || partial_clone) {
        const checkout_cmd = ["-C", local_path];

        if (partial_clone) {
            let subpath = config.subpath.replace(/^\//, "");
            if (config.blob) {
                // When ingesting from a file url (blob/branch/path/file.txt), we need to remove the file name
                subpath = path.dirname(subpath);
            }

            checkout_cmd.push("sparse-checkout", "set", subpath);
        }

        if (commit) {
            checkout_cmd.push("checkout", commit);
        }

        // Check out the specific commit and/or subpath
        await runCommand("git", checkout_cmd);
    }
});

/**
 * Check if a Git repository exists at the provided URL.
 * 
 * @param url - The URL of the Git repository to check
 * @returns True if the repository exists, False otherwise
 * @throws Error if the curl command returns an unexpected status code
 */
export async function checkRepoExists(url: string): Promise<boolean> {
    try {
        const { stdout } = await runCommand("curl", ["-I", url]);
        const response = stdout.toString();
        const status_code = getStatusCode(response);

        if (status_code === 200 || status_code === 301) {
            return true;
        }

        if (status_code === 404 || status_code === 302) {
            return false;
        }

        throw new Error(`Unexpected status code: ${status_code}`);
    } catch {
        return false;
    }
}

/**
 * Fetch the list of branches from a remote Git repository.
 * 
 * @param url - The URL of the Git repository to fetch branches from
 * @returns A list of branch names available in the remote repository
 */
export async function fetchRemoteBranchList(url: string): Promise<string[]> {
    const { stdout } = await runCommand("git", ["ls-remote", "--heads", url]);
    const stdout_decoded = stdout.toString();

    return stdout_decoded
        .split("\n")
        .filter(line => line.trim() && line.includes("refs/heads/"))
        .map(line => line.split("refs/heads/")[1]);
}

/**
 * Execute a command asynchronously and captures its output.
 * 
 * @param command - The command to execute
 * @param args - The arguments for the command
 * @returns A promise that resolves to an object containing stdout and stderr
 * @throws Error if command exits with a non-zero status
 */
export async function runCommand(command: string, args: string[]): Promise<{ stdout: Buffer; stderr: Buffer }> {
    // await checkGitInstalled();

    return new Promise((resolve, reject) => {
        const proc = spawn(command, args);
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];

        proc.stdout.on('data', (data) => stdout.push(Buffer.from(data)));
        proc.stderr.on('data', (data) => stderr.push(Buffer.from(data)));

        proc.on('close', (code) => {
            if (code !== 0) {
                const error_message = Buffer.concat(stderr).toString().trim();
                reject(new Error(`Command failed: ${command} ${args.join(' ')}\nError: ${error_message}`));
            } else {
                resolve({
                    stdout: Buffer.concat(stdout),
                    stderr: Buffer.concat(stderr)
                });
            }
        });

        proc.on('error', (err) => {
            reject(new Error(`Failed to start command: ${err.message}`));
        });
    });
}

/**
 * Check if Git is installed and accessible on the system.
 * 
 * @throws Error if Git is not installed or if the Git command exits with a non-zero status
 */
export async function checkGitInstalled(): Promise<void> {
    try {
        await runCommand("git", ["--version"]);
    } catch (error) {
        throw new Error("Git is not installed or not accessible");
    }
}

/**
 * Extract the status code from an HTTP response.
 * 
 * @param response - The HTTP response string
 * @returns The status code of the response
 */
function getStatusCode(response: string): number {
    const match = response.match(/HTTP\/[\d.]+\s+(\d+)/);
    if (!match) {
        throw new Error("Could not find status code in response");
    }
    return parseInt(match[1], 10);
}
