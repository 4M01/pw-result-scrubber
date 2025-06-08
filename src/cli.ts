#!/usr/bin/env node

/**
 * cli.ts
 * 
 * Enhanced command-line interface with locator-based scrubbing support
 */

import fs from 'fs';
import path from 'path';
import { DefaultRulesFactory } from './default-rules';
import { scrubPlaywrightResult } from './index';
import { ScrubbingRule } from './types';

// Enhanced CLI argument parser
async function parseArgs(): Promise<{
    configPath: string;
    rulesFile: string | null;
    outputDir: string | null;
    preserveOriginals: boolean;
    verbose: boolean;
    rules: ScrubbingRule[];
    locatorBased: boolean;
    maskingStrategy: 'asterisks' | 'placeholder' | 'custom';
    customMask: string | null;
    sensitiveFields: string[];
}> {
    const args = process.argv.slice(2);
    let configPath = './playwright.config.ts'; // DEFAULT
    let rulesFile: string | null = null;
    let outputDir: string | null = null;
    let preserveOriginals = false; // DEFAULT
    let verbose = false; // DEFAULT
    let locatorBased = true; // DEFAULT: Use locator-based rules
    let maskingStrategy: 'asterisks' | 'placeholder' | 'custom' = 'asterisks'; // DEFAULT
    let customMask: string | null = null;
    let sensitiveFields: string[] = [];
    const inlineRules: ScrubbingRule[] = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--config':
            case '-c':
                configPath = args[++i];
                break;
            case '--rules':
            case '-r':
                rulesFile = args[++i];
                break;
            case '--output':
            case '-o':
                outputDir = args[++i];
                break;
            case '--preserve':
            case '-p':
                preserveOriginals = true;
                break;
            case '--verbose':
            case '-v':
                verbose = true;
                break;
            case '--pattern':
                const pattern = args[++i];
                const replacement = args[++i];
                inlineRules.push({ pattern, replacement });
                break;
            case '--locator-based':
                locatorBased = true;
                break;
            case '--legacy-rules':
                locatorBased = false;
                break;
            case '--masking':
                maskingStrategy = args[++i] as 'asterisks' | 'placeholder' | 'custom';
                break;
            case '--custom-mask':
                customMask = args[++i];
                maskingStrategy = 'custom';
                break;
            case '--sensitive-field':
                sensitiveFields.push(args[++i]);
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
        }
    }

    // Load rules from file or generate based on strategy
    const rules = await loadRules(rulesFile, inlineRules, locatorBased, {
        maskingStrategy,
        customMask,
        additionalIdentifiers: sensitiveFields
    });

    return {
        configPath,
        rulesFile,
        outputDir,
        preserveOriginals,
        verbose,
        rules,
        locatorBased,
        maskingStrategy,
        customMask,
        sensitiveFields
    };
}

/**
 * Load scrubbing rules from various sources
 * ASSUMPTION: Rules file contains valid rule objects or exports them
 * DEFAULT: Falls back to locator-based rules if no rules specified
 */
async function loadRules(
    rulesFile: string | null,
    inlineRules: ScrubbingRule[],
    locatorBased: boolean,
    options: {
        maskingStrategy: 'asterisks' | 'placeholder' | 'custom';
        customMask: string | null;
        additionalIdentifiers: string[];
    }
): Promise<ScrubbingRule[]> {
    // If we have inline rules, use those
    if (inlineRules.length > 0) {
        return inlineRules;
    }

    // If rules file specified, load from file
    if (rulesFile) {
        return await loadRulesFromFile(rulesFile);
    }

    // Look for default rules files
    const defaultFiles = [
        './playwright-scrub-rules.json',
        './playwright-scrub-rules.js'
    ];

    for (const file of defaultFiles) {
        if (fs.existsSync(file)) {
            return await loadRulesFromFile(file);
        }
    }

    // Generate rules based on strategy
    if (locatorBased) {
        const config = DefaultRulesFactory.createCustomConfig({
            additionalIdentifiers: options.additionalIdentifiers,
            maskingStrategy: options.maskingStrategy,
            customMask: options.customMask || undefined
        });
        return DefaultRulesFactory.getPlaywrightRules(config);
    } else {
        return DefaultRulesFactory.getLegacyRules();
    }
}

async function loadRulesFromFile(rulesFile: string): Promise<ScrubbingRule[]> {
    try {
        const ext = path.extname(rulesFile).toLowerCase();

        if (ext === '.json') {
            const content = fs.readFileSync(rulesFile, 'utf8');
            const jsonRules = JSON.parse(content);
            return DefaultRulesFactory.fromJson(jsonRules);
        } else if (ext === '.js') {
            const module = await import(path.resolve(rulesFile));
            const rules = module.default || module;
            return Array.isArray(rules) ? rules : DefaultRulesFactory.getDefaultRules();
        } else {
            console.error(`Unsupported rules file extension: ${ext}. Supported: .json, .js`);
            process.exit(1);
        }
    } catch (error) {
        const message = (error instanceof Error) ? error.message : String(error);
        console.error(`Failed to load rules file: ${message}`);
        process.exit(1);
    }
}

function printHelp(): void {
    console.log(`
Playwright Result Scrubber - Remove sensitive information from Playwright reports and traces

Usage: playwright-scrub [options]

Basic Options:
  --config, -c         Path to Playwright config file (default: ./playwright.config.ts)
  --rules, -r          Path to rules file (JSON or JS)
  --output, -o         Output directory for scrubbed files (default: overwrite originals)
  --preserve, -p       Preserve original files when output directory is specified
  --verbose, -v        Enable verbose logging
  --help, -h           Show this help message

Locator-Based Scrubbing Options:
  --locator-based      Use locator-based rules (default)
  --legacy-rules       Use only legacy pattern-based rules
  --masking <strategy> Masking strategy: asterisks|placeholder|custom (default: asterisks)
  --custom-mask <mask> Custom mask string (implies --masking custom)
  --sensitive-field <field> Add custom sensitive field identifier (can be used multiple times)

Legacy Options:
  --pattern <pattern> <replacement>  Define an inline scrubbing rule

Examples:
  # Basic usage with locator-based rules
  playwright-scrub

  # Use placeholder masking instead of asterisks
  playwright-scrub --masking placeholder

  # Add custom sensitive field identifiers
  playwright-scrub --sensitive-field "apikey" --sensitive-field "clientsecret"

  # Use custom mask
  playwright-scrub --custom-mask "[REDACTED]"

  # Use legacy rules only
  playwright-scrub --legacy-rules

  # Custom config and output
  playwright-scrub --config ./tests/playwright.config.ts --output ./sanitized-reports

  # Inline pattern (legacy style)
  playwright-scrub --pattern "myCustomField['\"]?\\s*[=:]\\s*['\"]([^'\"]+)['\"]" "myCustomField=\\\"***\\\""

Locator-Based Scrubbing:
  The default mode identifies sensitive data based on Playwright locator patterns.
  It looks for locators containing sensitive field names (password, username, email, etc.)
  and masks the values passed to .fill(), .type(), and other input methods.

  Example transformations:
    await page.locator("#password").fill("secret123");
    → await page.locator("#password").fill("********");

    await page.getByTestId("username-input").fill("john.doe@example.com");
    → await page.getByTestId("username-input").fill("********");

Default Sensitive Identifiers:
  password, pass, pwd, secret, token, username, user, login, email, mail,
  credit, card, ssn, social, phone, address, zip, postal, account, otp, pin

Defaults:
  - Config path: ./playwright.config.ts
  - Rules: Locator-based rules with asterisk masking
  - Output: Overwrite original files
  - Preserve originals: false
  - Verbose: false
  - Masking: asterisks (**********)

Assumptions:
  - Playwright test files use standard locator patterns
  - Sensitive fields follow common naming conventions
  - HTML reports contain test code with locator expressions
  - Trace files contain both code and runtime values
    `);
}

// Main function
async function main(): Promise<void> {
    const {
        configPath,
        outputDir,
        preserveOriginals,
        verbose,
        rules,
        locatorBased,
        maskingStrategy,
        sensitiveFields
    } = await parseArgs();

    if (rules.length === 0) {
        console.error('No scrubbing rules defined. Please provide rules via file or inline patterns.');
        process.exit(1);
    }

    if (verbose) {
        console.log(`Using Playwright config: ${configPath}`);
        console.log(`Rule strategy: ${locatorBased ? 'Locator-based' : 'Legacy patterns'}`);
        console.log(`Masking strategy: ${maskingStrategy}`);
        console.log(`Number of scrubbing rules: ${rules.length}`);
        if (sensitiveFields.length > 0) {
            console.log(`Custom sensitive fields: ${sensitiveFields.join(', ')}`);
        }
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

const rules = DefaultRulesFactory.getDefaultRules({
    maskingStrategy: 'asterisks',
    customMask: '[REDACTED]'
}).concat(DefaultRulesFactory.getBase64DecodedRules());