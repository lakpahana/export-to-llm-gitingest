/**
* Utilities for processing Jupyter notebooks.
*/

import * as fs from 'fs';
import * as path from 'path';

/**
 * Custom error for invalid notebook files
 */
export class InvalidNotebookError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidNotebookError';
    }
}

/**
 * Process a Jupyter notebook file and return an executable Python script as a string.
 *
 * @param filePath - The path to the Jupyter notebook file.
 * @param includeOutput - Whether to include cell outputs in the generated script, by default true.
 * @returns The executable Python script as a string.
 * @throws InvalidNotebookError If the notebook file is invalid or cannot be processed.
 */
export function processNotebook(filePath: string, includeOutput: boolean = true): string {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const notebook: Record<string, any> = JSON.parse(fileContent);

        // Check if the notebook contains worksheets
        const worksheets = notebook.worksheets;
        let cells: any[];

        if (worksheets) {
            console.warn(
                'Worksheets are deprecated as of IPEP-17. Consider updating the notebook. ' +
                '(See: https://github.com/jupyter/nbformat and ' +
                'https://github.com/ipython/ipython/wiki/IPEP-17:-Notebook-Format-4#remove-multiple-worksheets ' +
                'for more information.)'
            );

            if (worksheets.length > 1) {
                console.warn('Multiple worksheets detected. Combining all worksheets into a single script.');
            }

            cells = worksheets.flatMap((ws: any) => ws.cells);
        } else {
            cells = notebook.cells;
        }

        const result = ['# Jupyter notebook converted to Python script.'];

        for (const cell of cells) {
            const cellStr = processCell(cell, includeOutput);
            if (cellStr) {
                result.push(cellStr);
            }
        }

        return result.join('\n\n') + '\n';
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new InvalidNotebookError(`Invalid JSON in notebook: ${filePath}`);
        }
        throw error;
    }
}

/**
 * Process a Jupyter notebook cell and return the cell content as a string.
 *
 * @param cell - The cell dictionary from a Jupyter notebook.
 * @param includeOutput - Whether to include cell outputs in the generated script
 * @returns The cell content as a string, or null if the cell is empty.
 * @throws Error If an unexpected cell type is encountered.
 */
function processCell(cell: Record<string, any>, includeOutput: boolean): string | null {
    const cellType = cell.cell_type;

    // Validate cell type and handle unexpected types
    if (!['markdown', 'code', 'raw'].includes(cellType)) {
        throw new Error(`Unknown cell type: ${cellType}`);
    }

    let cellStr: string;

    // Handle source that could be string or string[]
    if (Array.isArray(cell.source)) {
        cellStr = cell.source.join('');
    } else {
        cellStr = cell.source;
    }

    // Skip empty cells
    if (!cellStr) {
        return null;
    }

    // Convert Markdown and raw cells to multi-line comments
    if (cellType === 'markdown' || cellType === 'raw') {
        return `"""\n${cellStr}\n"""`;
    }

    // Add cell output as comments
    const outputs = cell.outputs;
    if (includeOutput && outputs && outputs.length > 0) {
        // Include cell outputs as comments
        const outputLines: string[] = [];

        for (const output of outputs) {
            outputLines.push(...extractOutput(output));
        }

        const formattedOutputLines = outputLines.map(line => {
            if (!line.endsWith('\n')) {
                return line + '\n';
            }
            return line;
        });

        cellStr += '\n# Output:\n#   ' + formattedOutputLines.join('\n#   ');
    }

    return cellStr;
}

/**
 * Extract the output from a Jupyter notebook cell.
 *
 * @param output - The output dictionary from a Jupyter notebook cell.
 * @returns The output as an array of strings.
 * @throws Error If an unknown output type is encountered.
 */
function extractOutput(output: Record<string, any>): string[] {
    const outputType = output.output_type;

    if (outputType === 'stream') {
        return Array.isArray(output.text) ? output.text : [output.text];
    }

    if (outputType === 'execute_result' || outputType === 'display_data') {
        const textData = output.data['text/plain'];
        return Array.isArray(textData) ? textData : [textData];
    }

    if (outputType === 'error') {
        return [`Error: ${output.ename}: ${output.evalue}`];
    }

    throw new Error(`Unknown output type: ${outputType}`);
}