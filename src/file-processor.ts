/**
 * file-processor.ts
 * Concrete file processor for handling file operations
 */

import fs from 'fs';
import glob from 'glob';
import path from 'path';
import { promisify } from 'util';

const globAsync = promisify(glob);

export class FileProcessor {
    protected readonly baseDir: string;
    protected readonly fileExtensions: string[];

    constructor(baseDir: string, fileExtensions: string[]) {
        // ASSUMPTION: baseDir exists or will be created
        // ASSUMPTION: fileExtensions are provided with leading dots (e.g., '.html')
        this.baseDir = baseDir;
        this.fileExtensions = fileExtensions;
    }

    /**
     * Find all files matching the processor's criteria
     * ASSUMPTION: baseDir exists and is readable
     * ASSUMPTION: File extensions are provided in lowercase with dots (e.g., '.html')
     */
    async findFiles(): Promise<string[]> {
        if (!fs.existsSync(this.baseDir)) {
            console.log(`[FileProcessor] Directory does not exist: ${this.baseDir}`);
            return [];
        }

        const patterns = this.fileExtensions.map(ext =>
            path.join(this.baseDir, `**/*${ext}`).replace(/\\/g, '/')
        );

        console.log(`[FileProcessor] Searching patterns: ${patterns.join(', ')}`);

        const allFiles: string[] = [];
        for (const pattern of patterns) {
            try {
                const files = await globAsync(pattern);
                console.log(`[FileProcessor] Pattern "${pattern}" found ${files.length} files`);
                allFiles.push(...files);
            } catch (error) {
                console.log(`[FileProcessor] Error with pattern "${pattern}": ${error}`);
            }
        }

        const uniqueFiles = [...new Set(allFiles)]; // Remove duplicates
        console.log(`[FileProcessor] Total unique files found: ${uniqueFiles.length}`);

        return uniqueFiles;
    }

    /**
     * Check if file exists and is readable
     */
    async isFileAccessible(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get all files recursively from directory
     * ASSUMPTION: Directory exists and we have read permissions
     */
    getAllFilesRecursively(dirPath: string, arrayOfFiles: string[] = []): string[] {
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                this.getAllFilesRecursively(fullPath, arrayOfFiles);
            } else {
                arrayOfFiles.push(fullPath);
            }
        }

        return arrayOfFiles;
    }
}