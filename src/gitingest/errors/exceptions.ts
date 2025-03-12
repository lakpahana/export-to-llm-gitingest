/**
 * Custom exceptions for the Gitingest package.
 */

/**
 * Exception raised when a pattern contains invalid characters.
 * This exception is used to signal that a pattern provided for some operation
 * contains characters that are not allowed. The valid characters for the pattern
 * include alphanumeric characters, dash (-), underscore (_), dot (.), forward slash (/),
 * plus (+), and asterisk (*).
 */
export class InvalidPatternError extends Error {
    constructor(pattern: string) {
        super(
            `Pattern '${pattern}' contains invalid characters. Only alphanumeric characters, dash (-), ` +
            `underscore (_), dot (.), forward slash (/), plus (+), and asterisk (*) are allowed.`
        );
        this.name = 'InvalidPatternError';
    }
}

/**
 * Exception raised when an async operation exceeds its timeout limit.
 * 
 * This exception is used by the `asyncTimeout` decorator to signal that the wrapped
 * asynchronous function has exceeded the specified time limit for execution.
 */
export class AsyncTimeoutError extends Error {
    constructor(message: string = 'Operation timed out') {
        super(message);
        this.name = 'AsyncTimeoutError';
    }
}

/**
 * Exception raised when a Jupyter notebook is invalid or cannot be processed.
 */
export class InvalidNotebookError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidNotebookError';
    }
}
