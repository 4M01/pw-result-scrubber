/**
 * trace-scrubber.ts
 * 
 * Module for scrubbing sensitive data from Playwright trace files
 */

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { ScrubberOptions } from './index';

export class TraceScrubber {
    private options: ScrubberOptions;

    constructor(options: ScrubberOptions) {
        this.options = options;
    }

    /**
     * Scrub a single trace file (ZIP format)
     */
    async scrubFile(filePath: string): Promise<void> {
        this.log(`Processing trace file: ${filePath}`);

        // Create temp directory for extraction
        const tempDir = path.join(process.cwd(), '.trace-scrubber-temp', path.basename(filePath, '.zip'));
        await fs.promises.mkdir(tempDir, { recursive: true });

        try {
            // Extract trace zip file
            const zip = new AdmZip(filePath);
            zip.extractAllTo(tempDir, true);

            // Process trace files
            await this.processTraceDirectory(tempDir);

            // Determine output path
            const outputPath = this.getOutputPath(filePath);

            // Create new zip file
            const newZip = new AdmZip();
            const files = this.getAllFiles(tempDir);

            for (const file of files) {
                const relativePath = path.relative(tempDir, file);
                newZip.addLocalFile(file, path.dirname(relativePath));
            }

            // Create directory if it doesn't exist
            const outputDir = path.dirname(outputPath);
            await fs.promises.mkdir(outputDir, { recursive: true });

            // Write new zip file
            newZip.writeZip(outputPath);
            this.log(`Wrote scrubbed trace to ${outputPath}`);

            // Handle original file
            if (outputPath !== filePath && !this.options.preserveOriginals) {
                await fs.promises.unlink(filePath);
                this.log(`Removed original trace file ${filePath}`);
            }
        } finally {
            // Clean up temp directory
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        }
    }

    /**
     * Process all files in the extracted trace directory
     */
    private async processTraceDirectory(dirPath: string): Promise<void> {
        const files = this.getAllFiles(dirPath);

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();

            if (ext === '.json' || ext === '.txt' || ext === '.html' || ext === '.js') {
                await this.scrubTextFile(file);
            }
        }
    }

    /**
     * Scrub a text file within the trace
     */
    private async scrubTextFile(filePath: string): Promise<void> {
        let content = await fs.promises.readFile(filePath, 'utf8');
        let originalContent = content;

        // Apply all scrubbing rules
        for (const rule of this.options.rules) {
            const pattern = typeof rule.pattern === 'string'
                ? new RegExp(rule.pattern, 'g')
                : rule.pattern;

            content = content.replace(pattern, rule.replacement);
        }

        // If content changed, write it back
        if (content !== originalContent) {
            await fs.promises.writeFile(filePath, content, 'utf8');
            this.log(`Scrubbed sensitive data from ${path.basename(filePath)}`);
        }
    }

    /**
     * Recursively get all files in a directory
     */
    private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                this.getAllFiles(fullPath, arrayOfFiles);
            } else {
                arrayOfFiles.push(fullPath);
            }
        }

        return arrayOfFiles;
    }

    /**
     * Determine the output path for a scrubbed file
     */
    private getOutputPath(filePath: string): string {
        if (!this.options.outputDir) {
            return filePath; // Overwrite original
        }

        const relativePath = path.relative(process.cwd(), filePath);
        return path.join(this.options.outputDir, relativePath);
    }

    private log(message: string): void {
        if (this.options.verbose) {
            console.log(`[TraceScrubber] ${message}`);
        }
    }
}