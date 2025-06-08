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
            const content = await fs.promises.readFile(filePath, 'utf8');

            // Regex to match all base64 zip data URIs in the file
            const base64Pattern = /data:application\/zip;base64,([^"']+)/g;
            let match;
            let newContent = content;
            let found = false;

            while ((match = base64Pattern.exec(content)) !== null) {
                found = true;
                const base64Str = match[1];
                const decoded = decodeBase64(base64Str);
                const scrubbed = this.applyScrubRules(decoded);

                // Only replace if content changed
                if (decoded !== scrubbed) {
                    const reEncoded = encodeBase64(scrubbed);
                    newContent = newContent.replace(base64Str, reEncoded);
                }
            }

            if (!found) {
                this.log(`No base64 zip data found in ${filePath}`);
                return;
            }

            const outputPath = this.getOutputPath(filePath);
            await this.ensureOutputDirectory(outputPath);
            await fs.promises.writeFile(outputPath, newContent, 'utf8');

            this.log(`Scrubbed sensitive data from ${filePath}`);
            await this.handleOriginalFile(filePath, outputPath);

        } catch (error) {
            this.log(`Error processing file ${filePath}: ${error}`);
            throw error;
        }
    }
}

/**
 * Decode a Base64 encoded string
 * @param base64Str - The Base64 string to decode
 * @returns The decoded string
 */
function decodeBase64(base64Str: string): string {
    return Buffer.from(base64Str, 'base64').toString('utf8');
}

/**
 * Encode a string to Base64
 * @param str - The string to encode
 * @returns The Base64 encoded string
 */
function encodeBase64(str: string): string {
    return Buffer.from(str, 'utf8').toString('base64');
}