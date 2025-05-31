import { scrubPlaywrightResult } from 'playwright-result-scrubber';
import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
    // Run any other teardown logic here

    // Run result scrubber
    await scrubPlaywrightResult(config.configFile || './playwright.config.ts', {
        rules: [
            { pattern: /password["']?\s*[=:]\s*["']([^"']+)["']/gi, replacement: 'password="********"' },
            { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: 'user@example.com' },
            // Add more rules as needed
        ],
        verbose: true
    });
}

export default globalTeardown;