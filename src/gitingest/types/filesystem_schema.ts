/**
 * Define the schema for the filesystem representation.
 */

import * as path from 'path';
import * as fs from 'fs';
import { getEncodingList } from '../utils/ingestion_utils';
import { isTextFile } from '../utils/textfile_checker_utils';
import { processNotebook } from '../utils/notebook_utils';

/** Tiktoken, the tokenizer openai uses, counts 2 tokens if we have more than 48 */
export const SEPARATOR = "=".repeat(48);

/**
 * Enum representing the type of a file system node (directory or file).
 */
export enum FileSystemNodeType {
    DIRECTORY = "DIRECTORY",
    FILE = "FILE"
}

/**
 * Class for tracking statistics during file system traversal.
 */
export class FileSystemStats {
    visited: Set<string> = new Set();
    total_files: number = 0;
    total_size: number = 0;
}

/**
 * Class representing a node in the file system (either a file or directory).
 * Tracks properties of files/directories for comprehensive analysis.
 */
export class FileSystemNode {
    name: string;
    type: FileSystemNodeType;
    path_str: string;
    path: string;
    size: number = 0;
    file_count: number = 0;
    dir_count: number = 0;
    depth: number = 0;
    children: FileSystemNode[] = [];

    constructor(name: string, type: FileSystemNodeType, path_str: string, path: string) {
        this.name = name;
        this.type = type;
        this.path_str = path_str;
        this.path = path;
    }

    /**
     * Sort the children nodes of a directory according to a specific order.
     * 
     * Order of sorting:
     *   1. README files
     *   2. Regular files (not starting with dot)
     *   3. Hidden files (starting with dot)
     *   4. Regular directories (not starting with dot)
     *   5. Hidden directories (starting with dot)
     * 
     * All groups are sorted alphanumerically within themselves.
     * 
     * @throws Error if the node is not a directory
     */
    sortChildren(): void {
        if (this.type !== FileSystemNodeType.DIRECTORY) {
            throw new Error("Cannot sort children of a non-directory node");
        }

        const sortKey = (child: FileSystemNode): [number, string] => {
            // returns the priority order for the sort function, 0 is first
            // Groups: 0=README, 1=regular file, 2=hidden file, 3=regular dir, 4=hidden dir
            const name = child.name.toLowerCase();
            if (child.type === FileSystemNodeType.FILE) {
                if (name === "readme.md") {
                    return [0, name];
                }
                return [name.startsWith(".") ? 2 : 1, name];
            }
            return [name.startsWith(".") ? 4 : 3, name];
        };

        this.children.sort((a, b) => {
            const [orderA, nameA] = sortKey(a);
            const [orderB, nameB] = sortKey(b);
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return nameA.localeCompare(nameB);
        });
    }

    /**
     * Return the content of the node as a string.
     */
    get contentString(): string {
        return this.content;
    }

    /**
     * Read the content of a file if it's text (or a notebook). Return an error message otherwise.
     * 
     * @throws Error if the node is a directory
     */
    get content(): string {
        if (this.type === FileSystemNodeType.DIRECTORY) {
            throw new Error("Cannot read content of a directory node");
        }

        if (!isTextFile(this.path)) {
            return "[Non-text file]";
        }

        if (path.extname(this.path) === ".ipynb") {
            try {
                return processNotebook(this.path);
            } catch (exc) {
                return `Error processing notebook: ${exc}`;
            }
        }

        // Try multiple encodings
        for (const encoding of getEncodingList()) {
            try {
                const content = require('fs').readFileSync(this.path, { encoding });
                return content;
            } catch (error) {
                if (error instanceof Error && 
                    (error.message.includes('decode') || error.message.includes('encoding'))) {
                    continue;
                }
                return `Error reading file: ${error}`;
            }
        }

        return "Error: Unable to decode file with available encodings";
    }
}
