/**
 * trace-scrubber.ts
 * Trace Scrubber with enhanced OOP design
 */

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { AbstractScrubber } from './abstract-scrubber';
import { FileProcessor } from './file-processor';
import { ScrubberOptions } from './types';

export class TraceScrubber extends AbstractScrubber {
    private readonly fileProcessor: FileProcessor;
    private readonly traceDir: string;

    constructor(traceDir: string, options: ScrubberOptions) {
        super(options, 'TraceScrubber');

        this.traceDir = traceDir;
        // ASSUMPTION: Trace files are stored as .zip files
        this.fileProcessor = new FileProcessor(traceDir, ['.zip']);

        this.log(`Initialized TraceScrubber for directory: ${traceDir}`);
    }

    /**
     * Scrub all trace files
     * ASSUMPTION: Trace directory exists
     */
    async scrubAllFiles(): Promise<void> {
        this.log(`Looking for trace files in: ${this.traceDir}`);

        // Check if directory exists
        if (!fs.existsSync(this.traceDir)) {
            this.log(`Trace directory does not exist: ${this.traceDir}`);
            return;
        }

        // List directory contents for debugging
        try {
            const dirContents = fs.readdirSync(this.traceDir);
            this.log(`Directory contents: ${dirContents.join(', ')}`);

            // Check for any .zip files manually
            const zipFiles = dirContents.filter(file => file.endsWith('.zip'));
            this.log(`ZIP files found manually: ${zipFiles.join(', ')}`);
        } catch (error) {
            this.log(`Error reading directory: ${error}`);
        }

        const files = await this.fileProcessor.findFiles();

        if (files.length === 0) {
            this.log('No trace files found');
            return;
        }

        this.log(`Found ${files.length} trace files to process`);

        for (const file of files) {
            await this.scrubFile(file);
        }
    }

    /**
     * Scrub a single trace file (ZIP format)
     * ASSUMPTION: Trace file is a valid ZIP archive
     * ASSUMPTION: We have write permissions for temp directory
     */
    async scrubFile(filePath: string): Promise<void> {
        this.log(`Processing trace file: ${filePath}`);

        const tempDir = path.join(process.cwd(), '.trace-scrubber-temp', path.basename(filePath, '.zip'));

        try {
            await this.processTraceFile(filePath, tempDir);
        } finally {
            await this.cleanup(tempDir);
        }
    }

    /**
     * Process a single trace file
     */
    private async processTraceFile(filePath: string, tempDir: string): Promise<void> {
        // Create temp directory
        await fs.promises.mkdir(tempDir, { recursive: true });

        // Extract ZIP file
        const zip = new AdmZip(filePath);
        zip.extractAllTo(tempDir, true);

        // Process extracted files
        await this.processExtractedFiles(tempDir);

        // Create new ZIP with scrubbed content
        const outputPath = this.getOutputPath(filePath);
        await this.createScrubbedZip(tempDir, outputPath);

        this.log(`Wrote scrubbed trace to ${outputPath}`);
        await this.handleOriginalFile(filePath, outputPath);
    }

    /**
     * Process all extracted files from trace
     * ASSUMPTION: Trace contains text files (.json, .txt, .html, .js) that may have sensitive data
     */
    private async processExtractedFiles(tempDir: string): Promise<void> {
        const files = this.fileProcessor.getAllFilesRecursively(tempDir);
        const textExtensions = ['.json', '.txt', '.html', '.js'];

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (textExtensions.includes(ext)) {
                await this.scrubTextFile(file);
            }
        }
    }

    /**
     * Scrub a text file within the trace
     * ASSUMPTION: Files are UTF-8 encoded text files
     */
    private async scrubTextFile(filePath: string): Promise<void> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const scrubbedContent = this.applyScrubRules(content);

            if (this.hasContentChanged(content, scrubbedContent)) {
                await fs.promises.writeFile(filePath, scrubbedContent, 'utf8');
                this.log(`Scrubbed sensitive data from ${path.basename(filePath)}`);
            }
        } catch (error) {
            this.log(`Warning: Could not process file ${filePath}: ${error}`);
        }
    }

    /**
     * Create new ZIP file with scrubbed content
     * ASSUMPTION: We have write permissions for output directory
     */
    private async createScrubbedZip(tempDir: string, outputPath: string): Promise<void> {
        await this.ensureOutputDirectory(outputPath);

        const newZip = new AdmZip();
        const files = this.fileProcessor.getAllFilesRecursively(tempDir);

        for (const file of files) {
            const relativePath = path.relative(tempDir, file);
            newZip.addLocalFile(file, path.dirname(relativePath));
        }

        newZip.writeZip(outputPath);
    }

    /**
     * Clean up temporary directory
     */
    private async cleanup(tempDir: string): Promise<void> {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            this.log(`Warning: Could not clean up temp directory ${tempDir}: ${error}`);
        }
    }
}