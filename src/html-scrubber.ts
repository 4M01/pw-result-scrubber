/**
 * html-scrubber.ts
 * 
 * Module for scrubbing sensitive result from HTML report files
 */

import fs from 'fs';
import path from 'path';
import { ScrubberOptions } from './index';

export class HtmlReportScrubber {
    private options: ScrubberOptions;

    constructor(options: ScrubberOptions) {
        this.options = options;
    }

    /**
     * Scrub a single HTML or JS file
     */
    async scrubFile(filePath: string): Promise<void> {
        // Read file content
        let content = await fs.promises.readFile(filePath, 'utf8');
        let originalContent = content;

        // Apply all scrubbing rules
        for (const rule of this.options.rules) {
            const pattern = typeof rule.pattern === 'string'
                ? new RegExp(rule.pattern, 'g')
                : rule.pattern;

            content = content.replace(pattern, rule.replacement);
        }

        // If content hasn't changed, no need to write it back
        if (content === originalContent) {
            this.log(`No sensitive result found in ${filePath}`);
            return;
        }

        // Determine output path
        const outputPath = this.getOutputPath(filePath);

        // Create directory if it doesn't exist
        const outputDir = path.dirname(outputPath);
        await fs.promises.mkdir(outputDir, { recursive: true });

        // Write scrubbed content
        await fs.promises.writeFile(outputPath, content, 'utf8');
        this.log(`Scrubbed sensitive result from ${filePath}`);

        // Handle original file
        if (outputPath !== filePath && !this.options.preserveOriginals) {
            await fs.promises.unlink(filePath);
            this.log(`Removed original file ${filePath}`);
        }
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
            console.log(`[HtmlReportScrubber] ${message}`);
        }
    }
}
