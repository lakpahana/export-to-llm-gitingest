/**
 * Command-line interface for the Gitingest package.
 */

import { Command } from 'commander';
import { MAX_FILE_SIZE, OUTPUT_FILE_NAME } from './config';
import { ingestAsync } from './entrypoint';

const program = new Command();

/**
 * Analyze a directory or repository and create a text dump of its contents.
 * 
 * This command analyzes the contents of a specified source directory or repository, applies custom include and
 * exclude patterns, and generates a text summary of the analysis which is then written to an output file.
 * 
 * @param source - The source directory or repository to analyze
 * @param options - Command line options including output path, max size, patterns, and branch
 */
async function asyncMain(
    source: string,
    options: {
        output?: string;
        maxSize?: number;
        excludePattern?: string[];
        includePattern?: string[];
        branch?: string;
    }
): Promise<void> {
    try {
        // Combine default and custom ignore patterns
        const exclude_patterns = new Set(options.excludePattern || []);
        const include_patterns = new Set(options.includePattern || []);
        const output = options.output || OUTPUT_FILE_NAME;

        const [summary] = await ingestAsync(
            source,
            options.maxSize || MAX_FILE_SIZE,
            include_patterns,
            exclude_patterns,
            options.branch,
            output
        );

        console.log(`Analysis complete! Output written to: ${output}`);
        console.log("\nSummary:");
        console.log(summary);
    } catch (exc) {
        console.error(`Error: ${exc}`);
        process.exit(1);
    }
}

program
    .name('gitingest')
    .description('CLI tool to analyze and create a text dump of repository contents')
    .argument('<source>', 'Source directory or repository to analyze', '.')
    .option('-o, --output <path>', 'Output file path (default: <repo_name>.txt in current directory)')
    .option('-s, --max-size <bytes>', 'Maximum file size to process in bytes', String(MAX_FILE_SIZE))
    .option('-e, --exclude-pattern <patterns...>', 'Patterns to exclude')
    .option('-i, --include-pattern <patterns...>', 'Patterns to include')
    .option('-b, --branch <name>', 'Branch to clone')
    .action(async (source: string, options: any) => {
        await asyncMain(source, {
            output: options.output,
            maxSize: parseInt(options.maxSize, 10),
            excludePattern: options.excludePattern,
            includePattern: options.includePattern,
            branch: options.branch
        });
    });

// Only run the CLI if this file is being run directly
if (require.main === module) {
    program.parse(process.argv);
}
