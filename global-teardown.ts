import { FullConfig } from '@playwright/test';
import { scrubPlaywrightResult } from 'playwright-result-scrubber';

async function globalTeardown(config: FullConfig) {
    // Run any other teardown logic here

    // Run result scrubber
    await scrubPlaywrightResult(config.configFile || './playwright.config.ts', {
        rules: [
            {
                pattern: /(username|password|email).*?fill\(".*?"\)/g,
                replacement: 'fill("*********")'
            }
        ],
        verbose: true
    });
}

export default globalTeardown;