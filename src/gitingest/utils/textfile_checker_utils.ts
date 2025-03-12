/**
 * Utility functions for checking whether a file is likely a text file or a binary file.
 */

import * as fs from 'fs';
import { getEncodingList } from './ingestion_utils';

/**
 * Determine whether a file is likely a text file or a binary file using various heuristics.
 * 
 * @param filePath - The path to the file to check
 * @returns True if the file is likely textual; False if it appears to be binary
 */
export function isTextFile(filePath: string): boolean {
    try {
        // Attempt to read a small portion (up to 1024 bytes) of the file in binary mode
        const buffer = Buffer.alloc(1024);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
        fs.closeSync(fd);

        const chunk = buffer.slice(0, bytesRead);

        // If the file is empty, we treat it as text
        if (chunk.length === 0) {
            return true;
        }

        // Look for obvious binary indicators such as null (0x00) or 0xFF bytes
        if (chunk.includes(0x00) || chunk.includes(0xFF)) {
            return false;
        }

        // Try to decode the file using different encodings
        const encodings = getEncodingList();

        for (const encoding of encodings) {
            try {
                // In Node.js, we can use fs.readFileSync with an encoding to check if it's valid text
                fs.readFileSync(filePath, { encoding: encoding as BufferEncoding });
                return true;
            } catch (error) {
                if (error instanceof Error && error.message.includes('encoding')) {
                    // This is a decoding error, continue to the next encoding
                    continue;
                } else {
                    // This is some other file access error
                    return false;
                }
            }
        }

        return false;
    } catch (error) {
        // If we cannot read the file for any reason, treat it as non-textual
        return false;
    }
}