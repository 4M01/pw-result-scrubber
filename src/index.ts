/**
 * index.ts
 * Main entry point and convenience functions
 */

import { PlaywrightResultScrubber } from './main-scrubber';
import { ScrubberOptions } from './types';

// Export all types and classes
export { AbstractScrubber } from './abstract-scrubber';
export { PlaywrightConfigParser } from './config-parser';
export { DefaultRulesFactory } from './default-rules';
export { FileProcessor } from './file-processor';
export { HtmlReportScrubber } from './html-scrubber';
export { LocatorRulesFactory } from './locator-rules';
export { PlaywrightResultScrubber } from './main-scrubber';
export { TraceScrubber } from './trace-scrubber';
export * from './types';

/**
 * Convenience function for easy usage
 * DEFAULT: Uses './playwright.config.ts' as config path
 * ASSUMPTION: Current working directory contains Playwright project
 */
export async function scrubPlaywrightResult(
    configPath: string = './playwright.config.ts',
    options: ScrubberOptions
): Promise<void> {
    const scrubber = new PlaywrightResultScrubber(configPath, options);
    await scrubber.scrub();
}