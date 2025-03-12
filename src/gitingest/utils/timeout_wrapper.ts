/**
 * Utility functions for the Gitingest package.
 */

/**
 * Custom error for async timeout operations
 */
export class AsyncTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AsyncTimeoutError';
    }
}

/**
 * Async Timeout decorator.
 * 
 * This decorator wraps an asynchronous function and ensures it does not run for
 * longer than the specified number of seconds. If the function execution exceeds
 * this limit, it raises an `AsyncTimeoutError`.
 * 
 * @param seconds - The maximum allowed time (in seconds) for the asynchronous function to complete.
 * @returns A decorator that, when applied to an async function, ensures the function
 *          completes within the specified time limit.
 */
export function asyncTimeout<T>(seconds: number):
    (target: (...args: any[]) => Promise<T>) => (...args: any[]) => Promise<T> {

    return function decorator(func: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T> {
        async function wrapper(...args: any[]): Promise<T> {
            try {
                // Create a timeout promise
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => {
                        reject(new AsyncTimeoutError(`Operation timed out after ${seconds} seconds`));
                    }, seconds * 1000);
                });

                // Race the original function against the timeout
                return await Promise.race([
                    func(...args),
                    timeoutPromise
                ]) as T;
            } catch (error) {
                if (error instanceof AsyncTimeoutError) {
                    throw error;
                }
                throw error;
            }
        }

        // Preserve the original function name and properties
        Object.defineProperty(wrapper, 'name', { value: func.name, writable: false });
        return wrapper;
    };
}

/**
 * Example usage:
 * 
 * @asyncTimeout(5)
 * async function longRunningOperation(): Promise<string> {
 *   // Some async operation
 *   return "result";
 * }
 * 
 * Note: TypeScript decorators are experimental.
 * For class methods, you would use:
 * 
 * class MyClass {
 *   @asyncTimeout(5)
 *   async someMethod() {
 *     // implementation
 *   }
 * }
 * 
 * Or as a function wrapper:
 * 
 * const wrappedFunction = asyncTimeout(5)(longRunningOperation);
 */