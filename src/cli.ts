#!/usr/bin/env node

/**
 * cli.ts
 * 
 * Command-line interface for the Playwright Result Scrubber
 */

import fs from 'fs';
import path from 'path';
import { ScrubbingRule, scrubPlaywrightResult } from './index';

// Simple CLI argument parser
async function parseArgs(): Promise<{
    configPath: string;
    rulesFile: string | null;
    outputDir: string | null;
    preserveOriginals: boolean;
    verbose: boolean;
    rules: ScrubbingRule[];
}> {
    const args = process.argv.slice(2);
    let configPath = './playwright.config.ts';
    let rulesFile: string | null = null;
    let outputDir: string | null = null;
    let preserveOriginals = false;
    let verbose = false;
    const inlineRules: ScrubbingRule[] = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--config' || arg === '-c') {
            configPath = args[++i];
        } else if (arg === '--rules' || arg === '-r') {
            rulesFile = args[++i];
        } else if (arg === '--output' || arg === '-o') {
            outputDir = args[++i];
        } else if (arg === '--preserve' || arg === '-p') {
            preserveOriginals = true;
        } else if (arg === '--verbose' || arg === '-v') {
            verbose = true;
        } else if (arg === '--pattern') {
            const pattern = args[++i];
            const replacement = args[++i];
            inlineRules.push({ pattern, replacement });
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    // Load rules from file if specified
    const rules = await loadRulesFromFile(rulesFile, inlineRules);

    return {
        configPath,
        rulesFile,
        outputDir,
        preserveOriginals,
        verbose,
        rules
    };
}

async function loadRulesFromFile(rulesFile: string | null, inlineRules: ScrubbingRule[]): Promise<ScrubbingRule[]> {
    // If we have inline rules, use those
    if (inlineRules.length > 0) {
        return inlineRules;
    }

    // If no rules file specified, look for default files
    if (!rulesFile) {
        const defaultFiles = [
            './playwright-scrub-rules.json',
            './playwright-scrub-rules.js'
        ];

        for (const file of defaultFiles) {
            if (fs.existsSync(file)) {
                rulesFile = file;
                break;
            }
        }

        // If still no rules file, use default rules
        if (!rulesFile) {
            return getDefaultRules();
        }
    }

    // Load rules from file
    try {
        const ext = path.extname(rulesFile).toLowerCase();

        if (ext === '.json') {
            const content = fs.readFileSync(rulesFile, 'utf8');
            return JSON.parse(content);
        } else if (ext === '.js') {
            // Use dynamic import for ES Modules
            return (await import(path.resolve(rulesFile))).default || (await import(path.resolve(rulesFile)));
        } else {
            console.error(`Unsupported rules file extension: ${ext}`);
            process.exit(1);
        }
    } catch (error) {
        const message = (error instanceof Error) ? error.message : String(error);
        console.error(`Failed to load rules file: ${message}`);
        process.exit(1);
    }
}

function getDefaultRules(): ScrubbingRule[] {
    return [
        // Password rules
        { pattern: /password["']?\s*[=:]\s*["']([^"']+)["']/gi, replacement: 'password="********"' },
        { pattern: /pass["']?\s*[=:]\s*["']([^"']+)["']/gi, replacement: 'pass="********"' },

        // Email patterns
        { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: 'user@example.com' },

        // Credit card numbers
        { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '****-****-****-****' },

        // API keys/tokens (common formats)
        { pattern: /["']?api[-_]?key["']?\s*[=:]\s*["']([^"']{8,})["']/gi, replacement: 'api-key="********"' },
        { pattern: /["']?auth[-_]?token["']?\s*[=:]\s*["']([^"']{8,})["']/gi, replacement: 'auth-token="********"' },

        // JWT tokens
        { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, replacement: 'JWT_TOKEN_REMOVED' }
    ];
}

function printHelp(): void {
    console.log(`
Playwright Result Scrubber - Remove sensitive information from Playwright reports and traces

Usage: playwright-scrub [options]

Options:
  --config, -c     Path to Playwright config file (default: ./playwright.config.ts)
  --rules, -r      Path to rules file (JSON or JS)
  --output, -o     Output directory for scrubbed files (default: overwrite originals)
  --preserve, -p   Preserve original files when output directory is specified
  --verbose, -v    Enable verbose logging
  --pattern        Define an inline scrubbing rule (followed by pattern and replacement)
  --help, -h       Show this help message

Examples:
  playwright-scrub
  playwright-scrub --config=./tests/e2e/playwright.config.ts
  playwright-scrub --rules=./scrub-rules.json --output=./sanitized-reports
  playwright-scrub --pattern "password['\"]?\\s*[=:]\\s*['\"]([^'\"]+)['\"]" "password=\\\"********\\\""
  `);
}

// Main function
async function main(): Promise<void> {
    const {
        configPath,
        outputDir,
        preserveOriginals,
        verbose,
        rules
    } = await parseArgs();

    if (rules.length === 0) {
        console.error('No scrubbing rules defined. Please provide rules via file or inline patterns.');
        process.exit(1);
    }

    if (verbose) {
        console.log(`Using Playwright config: ${configPath}`);
        console.log(`Number of scrubbing rules: ${rules.length}`);
        if (outputDir) {
            console.log(`Output directory: ${outputDir}`);
        }
        console.log(`Preserve originals: ${preserveOriginals}`);
    }

    try {
        await scrubPlaywrightResult(configPath, {
            rules,
            outputDir: outputDir || undefined,
            preserveOriginals,
            verbose
        });
        console.log('Scrubbing completed successfully!');
    } catch (error) {
        const message = (error instanceof Error) ? error.message : String(error);
        console.error(`Error: ${message}`);
        process.exit(1);
    }
}

// Run the CLI
main().catch(error => {
    const message = (error instanceof Error) ? error.message : String(error);
    console.error(`Fatal error: ${message}`);
    process.exit(1);
});