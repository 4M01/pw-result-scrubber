/**
 * playwright-data-scrubber
 * 
 * A package to scrub sensitive information from Playwright HTML reports and trace files.
 */

import fs from 'fs';
import path from 'path';
import glob from 'glob';
import { parseConfig } from './config-parser';
import { HtmlReportScrubber } from './html-scrubber';
import { TraceScrubber } from './trace-scrubber';

export interface ScrubbingRule {
    pattern: string | RegExp;
    replacement: string;
}

export interface ScrubberOptions {
    rules: ScrubbingRule[];
    outputDir?: string; // Optional output directory (if not provided, files will be overwritten)
    preserveOriginals?: boolean; // Whether to keep original files
    verbose?: boolean; // Enable verbose logging
}

export class PlaywrightDataScrubber {
    private options: ScrubberOptions;
    private configPath: string;
    private projectRoot: string;
    private htmlReportDir: string | null = null;
    private traceDir: string | null = null;

    constructor(configPath: string, options: ScrubberOptions) {
        this.configPath = configPath;
        this.options = options;
        this.projectRoot = path.dirname(path.resolve(configPath));

        if (!this.options.rules || this.options.rules.length === 0) {
            throw new Error('At least one scrubbing rule must be provided');
        }
    }

    /**
     * Run the scrubbing process
     */
    async scrub(): Promise<void> {
        this.log('Starting scrubbing process...');

        // Parse Playwright config to find output directories
        await this.parsePlaywrightConfig();

        // Scrub HTML reports
        if (this.htmlReportDir) {
            await this.scrubHtmlReports();
        } else {
            this.log('No HTML report directory found in config');
        }

        // Scrub trace files
        if (this.traceDir) {
            await this.scrubTraceFiles();
        } else {
            this.log('No trace directory found in config');
        }

        this.log('Scrubbing process complete!');
    }

    /**
     * Parse Playwright config to extract report and trace directories
     */
    private async parsePlaywrightConfig(): Promise<void> {
        this.log(`Parsing Playwright config at ${this.configPath}`);
        const config = await parseConfig(this.configPath);

        // Extract HTML report directory
        if (config.reporter && Array.isArray(config.reporter)) {
            for (const reporter of config.reporter) {
                if (Array.isArray(reporter) && reporter[0] === 'html') {
                    let reporterOptions = reporter[1] || {};
                    this.htmlReportDir = path.resolve(
                        this.projectRoot,
                        reporterOptions.outputFolder || 'playwright-report'
                    );
                    break;
                }
            }
        }

        // Extract trace directory
        if (config.use && config.use.trace) {
            let traceConfig = config.use.trace;
            if (typeof traceConfig === 'object' && traceConfig.snapshots) {
                this.traceDir = path.resolve(
                    this.projectRoot,
                    config.outputDir || 'test-results'
                );
            }
        }

        this.log(`HTML report directory: ${this.htmlReportDir || 'Not configured'}`);
        this.log(`Trace directory: ${this.traceDir || 'Not configured'}`);
    }

    /**
     * Scrub HTML report files
     */
    private async scrubHtmlReports(): Promise<void> {
        if (!this.htmlReportDir) return;

        this.log(`Scrubbing HTML reports in ${this.htmlReportDir}`);

        // Find all HTML and JS files in the report directory
        const htmlFiles = glob.sync(path.join(this.htmlReportDir, '**/*.{html,js}'));

        if (htmlFiles.length === 0) {
            this.log('No HTML or JS files found in report directory');
            return;
        }

        this.log(`Found ${htmlFiles.length} files to process`);

        const scrubber = new HtmlReportScrubber(this.options);

        for (const file of htmlFiles) {
            this.log(`Processing file: ${file}`);
            await scrubber.scrubFile(file);
        }
    }

    /**
     * Scrub trace files
     */
    private async scrubTraceFiles(): Promise<void> {
        if (!this.traceDir) return;

        this.log(`Scrubbing trace files in ${this.traceDir}`);

        // Find all trace files
        const traceFiles = glob.sync(path.join(this.traceDir, '**/*.zip'));

        if (traceFiles.length === 0) {
            this.log('No trace files found');
            return;
        }

        this.log(`Found ${traceFiles.length} trace files to process`);

        const scrubber = new TraceScrubber(this.options);

        for (const file of traceFiles) {
            this.log(`Processing trace file: ${file}`);
            await scrubber.scrubFile(file);
        }
    }

    private log(message: string): void {
        if (this.options.verbose) {
            console.log(`[PlaywrightDataScrubber] ${message}`);
        }
    }
}

// Export helper functions for easy usage
export async function scrubPlaywrightData(
    configPath: string = './playwright.config.ts',
    options: ScrubberOptions
): Promise<void> {
    const scrubber = new PlaywrightDataScrubber(configPath, options);
    await scrubber.scrub();
}