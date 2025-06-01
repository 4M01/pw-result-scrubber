/**
 * main-scrubber.ts
 * Main orchestrator class for the scrubbing process
 */

import { PlaywrightConfigParser } from './config-parser';
import { HtmlReportScrubber } from './html-scrubber';
import { TraceScrubber } from './trace-scrubber';
import { ScrubberOptions } from './types';

export class PlaywrightResultScrubber {
    private readonly configParser: PlaywrightConfigParser;
    private readonly options: ScrubberOptions;

    constructor(configPath: string, options: ScrubberOptions) {
        // ASSUMPTION: Config path points to a valid Playwright configuration
        this.configParser = new PlaywrightConfigParser(configPath);
        this.options = { ...options }; // Defensive copy

        if (!this.options.rules || this.options.rules.length === 0) {
            throw new Error('At least one scrubbing rule must be provided');
        }
    }

    /**
     * Main entry point for scrubbing process
     * ASSUMPTION: Playwright has been run and generated reports/traces
     */
    async scrub(): Promise<void> {
        this.log('Starting scrubbing process...');

        try {
            const config = await this.configParser.parse();
            const paths = this.configParser.getDirectoryPaths(config);

            await this.scrubHtmlReports(paths.htmlReportDir);
            await this.scrubTraceFiles(paths.traceDir);

            this.log('Scrubbing process completed successfully!');
        } catch (error) {
            this.log(`Scrubbing failed: ${error}`);
            throw error;
        }
    }

    /**
     * Scrub HTML reports if directory exists
     * DEFAULT: Skip if no HTML report directory configured
     */
    private async scrubHtmlReports(htmlReportDir: string | null): Promise<void> {
        if (!htmlReportDir) {
            this.log('No HTML report directory found in config - skipping HTML scrubbing');
            return;
        }

        this.log(`Scrubbing HTML reports in ${htmlReportDir}`);
        const scrubber = new HtmlReportScrubber(htmlReportDir, this.options);
        await scrubber.scrubAllFiles();
    }

    /**
     * Scrub trace files if directory exists
     * DEFAULT: Skip if no trace directory configured
     */
    private async scrubTraceFiles(traceDir: string | null): Promise<void> {
        if (!traceDir) {
            this.log('No trace directory found in config - skipping trace scrubbing');
            return;
        }

        this.log(`Scrubbing trace files in ${traceDir}`);
        const scrubber = new TraceScrubber(traceDir, this.options);
        await scrubber.scrubAllFiles();
    }

    private log(message: string): void {
        if (this.options.verbose) {
            console.log(`[PlaywrightResultScrubber] ${message}`);
        }
    }
}