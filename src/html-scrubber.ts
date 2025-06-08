/**
 * html-scrubber.ts
 * HTML Report Scrubber with ZIP handling for Playwright reports
 */

import fs from 'fs';
import JSZip from 'jszip';
import { AbstractScrubber } from './abstract-scrubber';
import { FileProcessor } from './file-processor';
import { ScrubberOptions } from './types';

export class HtmlReportScrubber extends AbstractScrubber {
    private readonly fileProcessor: FileProcessor;

    constructor(htmlReportDir: string, options: ScrubberOptions) {
        super(options, 'HtmlReportScrubber');
        this.fileProcessor = new FileProcessor(htmlReportDir, ['.html', '.js']);
    }



    /**
     * Scrub all HTML report files
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
     * Scrub a single HTML file containing base64 ZIP data
     */
    async scrubFile(filePath: string): Promise<void> {
        if (!(await this.fileProcessor.isFileAccessible(filePath))) {
            this.log(`Warning: Cannot access file ${filePath}`);
            return;
        }

        try {
            const content = await fs.promises.readFile(filePath, 'utf8');

            // Find the script tag with the base64 zip data
            const scriptPattern = /(window\.playwrightReportBase64\s*=\s*["']data:application\/zip;base64,)([^"']+)(["'];?)/;
            const match = scriptPattern.exec(content);

            if (!match) {
                this.log(`No playwrightReportBase64 data found in ${filePath}`);
                return;
            }

            const [fullMatch, prefix, base64Str, suffix] = match;

            // Decode base64 to get ZIP buffer
            const zipBuffer = Buffer.from(base64Str, 'base64');

            // Load ZIP and process contents
            const zip = await JSZip.loadAsync(zipBuffer);
            let hasChanges = false;

            // Process each file in the ZIP
            for (const [fileName, zipEntry] of Object.entries(zip.files)) {
                if (zipEntry.dir) continue; // Skip directories

                const fileContent = await zipEntry.async('string');

                this.log(`\n=== Processing ${fileName} ===`);
                this.log(`BEFORE (first 1000 chars):\n${fileContent.substring(0, 10000)}\n`);

                const scrubbedContent = this.applyScrubRules(fileContent);

                if (fileContent !== scrubbedContent) {
                    this.log(`AFTER (first 1000 chars):\n${scrubbedContent.substring(0, 1000)}\n`);

                    zip.file(fileName, scrubbedContent);
                    hasChanges = true;
                    this.log(`✓ Scrubbed ${fileName}`);
                } else {
                    this.log(`✗ No changes in ${fileName}`);
                }
            }

            // Only rewrite if there were changes
            if (hasChanges) {
                // Generate new ZIP buffer
                const newZipBuffer = await zip.generateAsync({
                    type: 'nodebuffer',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 6 }
                });

                // Re-encode to base64
                const newBase64 = newZipBuffer.toString('base64');
                const newScript = `${prefix}${newBase64}${suffix}`;
                const newContent = content.replace(fullMatch, newScript);

                const outputPath = this.getOutputPath(filePath);
                await this.ensureOutputDirectory(outputPath);
                await fs.promises.writeFile(outputPath, newContent, 'utf8');

                this.log(`Scrubbed sensitive data from ${filePath}`);
                await this.handleOriginalFile(filePath, outputPath);
            } else {
                this.log(`No sensitive data found to scrub in ${filePath}`);
            }

        } catch (error) {
            this.log(`Error processing file ${filePath}: ${error}`);
            throw error;
        }
    }
}