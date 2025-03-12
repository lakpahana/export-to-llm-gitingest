import * as vscode from 'vscode';
import * as path from 'path';
import { ingestQuery } from './gitingest/ingestion';
import { parseLocalDirPath, parseRemoteRepo } from './gitingest/query_parsing';
import { applyPatterns } from './gitingest/query_parsing';

/**
 * Ingest a local directory or Git repository and show results
 */
async function ingest_async(query_str: string, is_local: boolean): Promise<void> {
    try {
        // Parse query based on type
        const query = is_local ?
            parseLocalDirPath(query_str) :
            await parseRemoteRepo(query_str);

        // Get user preferences for ignore/include patterns
        const config = vscode.workspace.getConfiguration('gitingest');
        const maxFileSize = config.get<number>('maxFileSize') || 0;
        const ignorePatterns = config.get<string[]>('ignorePatterns') || [];
        const includePatterns = config.get<string[]>('includePatterns') || [];

        // Apply user preferences
        const finalQuery = applyPatterns(query, {
            max_file_size: maxFileSize,
            ignore_patterns: ignorePatterns,
            include_patterns: includePatterns
        });

        // Run ingestion
        const [summary, structure, contents] = await ingestQuery(finalQuery);

        // Create output document
        const doc = await vscode.workspace.openTextDocument({
            content: `# Ingestion Results for ${query_str}

			## Summary
			${summary}

			## Directory Structure
			${structure}

			## File Contents
			${contents}`,
						language: 'markdown'
					});

        await vscode.window.showTextDocument(doc, { preview: false });
    } catch (error) {
        vscode.window.showErrorMessage(`Ingestion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Gitingest extension is now active');

    // Register command to ingest local directory
    let ingestLocal = vscode.commands.registerCommand('gitingest.ingestLocal', async () => {
        const result = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select Directory to Ingest'
        });

        if (result && result[0]) {
            await ingest_async(result[0].fsPath, true);
        }
    });

    // Register command to ingest Git repository
    let ingestGit = vscode.commands.registerCommand('gitingest.ingestGit', async () => {
        const repoUrl = await vscode.window.showInputBox({
            prompt: 'Enter Git repository URL',
            placeHolder: 'e.g., https://github.com/username/repo'
        });

        if (repoUrl) {
            await ingest_async(repoUrl, false);
        }
    });

    context.subscriptions.push(ingestLocal, ingestGit);
}

/**
 * Deactivate the extension
 */
export function deactivate() { }
