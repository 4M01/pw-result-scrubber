/**
 * abstract-scrubber.ts
 * Abstract base class for all scrubbers
 * Provides common functionality and enforces interface
 */

import fs from 'fs';
import path from 'path';
import { ScrubberOptions, ScrubbingRule } from './types';

export abstract class AbstractScrubber {
    protected readonly options: ScrubberOptions;
    protected readonly name: string;

    constructor(options: ScrubberOptions, name: string) {
        // ASSUMPTION: Options object is valid and contains at least one rule
        if (!options.rules || options.rules.length === 0) {
            throw new Error('At least one scrubbing rule must be provided');
        }

        this.options = { ...options }; // Defensive copy
        this.name = name;
    }

    /**
     * Main entry point for scrubbing a file
     * ASSUMPTION: File exists and is readable
     */
    abstract scrubFile(filePath: string): Promise<void>;

    /**
     * Apply scrubbing rules to content
     * ASSUMPTION: Content is a string and rules are valid regex patterns
     */
    protected applyScrubRules(content: string): string {
        let scrubbedContent = content;

        for (const rule of this.options.rules) {
            try {
                const pattern = this.createRegexPattern(rule);
                scrubbedContent = scrubbedContent.replace(pattern, rule.replacement);
            } catch (error) {
                this.log(`Warning: Failed to apply rule with pattern ${rule.pattern}: ${error}`);
            }
        }

        return scrubbedContent;
    }

    /**
     * Create regex pattern from rule
     * ASSUMPTION: String patterns are valid regex, RegExp patterns are already compiled
     */
    private createRegexPattern(rule: ScrubbingRule): RegExp {
        if (typeof rule.pattern === 'string') {
            // ASSUMPTION: String patterns should have global flag for multiple replacements
            return new RegExp(rule.pattern, 'g');
        }
        return rule.pattern;
    }

    /**
     * Determine output path for processed file
     * ASSUMPTION: Process.cwd() returns a valid directory path
     * DEFAULT: If no output directory specified, overwrite original file
     */
    protected getOutputPath(filePath: string): string {
        if (!this.options.outputDir) {
            return filePath; // DEFAULT: Overwrite original
        }

        const relativePath = path.relative(process.cwd(), filePath);
        return path.join(this.options.outputDir, relativePath);
    }

    /**
     * Ensure output directory exists
     * ASSUMPTION: We have write permissions to create directories
     */
    protected async ensureOutputDirectory(outputPath: string): Promise<void> {
        const outputDir = path.dirname(outputPath);
        await fs.promises.mkdir(outputDir, { recursive: true });
    }

    /**
     * Handle original file based on options
     * ASSUMPTION: We have permissions to delete files when needed
     */
    protected async handleOriginalFile(originalPath: string, outputPath: string): Promise<void> {
        if (outputPath !== originalPath && !this.options.preserveOriginals) {
            try {
                await fs.promises.unlink(originalPath);
                this.log(`Removed original file ${originalPath}`);
            } catch (error) {
                this.log(`Warning: Could not remove original file ${originalPath}: ${error}`);
            }
        }
    }

    /**
     * Log message with scrubber name prefix
     * DEFAULT: Only log if verbose mode is enabled
     */
    protected log(message: string): void {
        if (this.options.verbose) {
            console.log(`[${this.name}] ${message}`);
        }
    }

    /**
     * Check if content has sensitive data that was scrubbed
     */
    protected hasContentChanged(original: string, scrubbed: string): boolean {
        return original !== scrubbed;
    }
}