/**
 * html-scrubber.ts
 * HTML Report Scrubber with enhanced OOP design
 */

import fs from 'fs';
import { AbstractScrubber } from './abstract-scrubber';
import { FileProcessor } from './file-processor';
import { ScrubberOptions } from './types';

export class HtmlReportScrubber extends AbstractScrubber {
    private readonly fileProcessor: FileProcessor;

    constructor(htmlReportDir: string, options: ScrubberOptions) {
        super(options, 'HtmlReportScrubber');

        // ASSUMPTION: HTML reports contain .html and .js files
        this.fileProcessor = new FileProcessor(htmlReportDir, ['.html', '.js']);
    }

    /**
     * Scrub all HTML report files
     * ASSUMPTION: HTML report directory exists
     */
    async scrubAllFiles(): Promise<void> {
        const files = await this.fileProcessor.findFiles();

        if (files.length === 0) {
            this.log('No HTML or JS files found in report directory');
            return;
        }

        this.log(`Found ${files.length} files to process`);

        for (const file of files) {
            await this.scrubFile(file);
        }
    }

    /**
     * Scrub a single HTML or JS file
     * ASSUMPTION: File is text-based and can be read as UTF-8
     */
    async scrubFile(filePath: string): Promise<void> {
        if (!(await this.fileProcessor.isFileAccessible(filePath))) {
            this.log(`Warning: Cannot access file ${filePath}`);
            return;
        }

        try {
            // Read file content
            const content = await fs.promises.readFile(filePath, 'utf8');
            const scrubbedContent = this.applyScrubRules(content);

            // Check if content changed
            if (!this.hasContentChanged(content, scrubbedContent)) {
                this.log(`No sensitive data found in ${filePath}`);
                return;
            }

            // Write scrubbed content
            const outputPath = this.getOutputPath(filePath);
            await this.ensureOutputDirectory(outputPath);
            await fs.promises.writeFile(outputPath, scrubbedContent, 'utf8');

            this.log(`Scrubbed sensitive data from ${filePath}`);
            await this.handleOriginalFile(filePath, outputPath);

        } catch (error) {
            this.log(`Error processing file ${filePath}: ${error}`);
            throw error;
        }
    }
}