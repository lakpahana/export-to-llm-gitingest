/**
 * Configuration file for the project.
 */

import * as os from 'os';
import * as path from 'path';

/** Maximum file size to process (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum depth of directory traversal */
export const MAX_DIRECTORY_DEPTH = 20;

/** Maximum number of files to process */
export const MAX_FILES = 10_000;

/** Maximum total size in bytes to process (500 MB) */
export const MAX_TOTAL_SIZE_BYTES = 500 * 1024 * 1024;

/** Name of the output file */
export const OUTPUT_FILE_NAME = "digest.txt";

/** Base path for temporary files */
export const TMP_BASE_PATH = path.join(os.tmpdir(), "gitingest");
