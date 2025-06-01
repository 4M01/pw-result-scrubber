/**
 * config-parser.ts
 * 
 * Utility to parse Playwright config files
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PlaywrightConfig {
    reporter?: Array<string | [string, any]>;
    outputDir?: string;
    use?: {
        trace?: boolean | string | {
            mode?: string;
            snapshots?: boolean;
            screenshots?: boolean;
            sources?: boolean;
            attachments?: boolean;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

/**
 * Add default paths for HTML reports and traces if not configured
 */
function addDefaultPaths(config: PlaywrightConfig): PlaywrightConfig {
    const result = { ...config };

    // Set default outputDir if not specified
    if (!result.outputDir) {
        result.outputDir = 'test-results';
    }

    // Ensure reporter array exists
    if (!result.reporter || !Array.isArray(result.reporter)) {
        result.reporter = [];
    }

    // Check if HTML reporter is already configured
    const hasHtmlReporter = result.reporter.some(reporter => {
        if (typeof reporter === 'string') {
            return reporter === 'html';
        }
        if (Array.isArray(reporter)) {
            return reporter[0] === 'html';
        }
        return false;
    });

    // Add default HTML reporter if not present
    if (!hasHtmlReporter) {
        result.reporter.push(['html', { outputFolder: 'playwright-report' }]);
    }

    // Don't set default trace configuration - let user's config determine this
    // The scrubbing tool should work with whatever trace settings the user has

    return result;
}

/**
 * Parse a Playwright config file
 * This handles both JavaScript and TypeScript config files
 */
export async function parseConfig(configPath: string): Promise<PlaywrightConfig> {
    const resolvedPath = path.resolve(configPath);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Config file not found: ${resolvedPath}`);
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    let config: PlaywrightConfig;

    // For JavaScript files, use dynamic import
    if (ext === '.js') {
        try {
            const configModule = await import(pathToFileURL(resolvedPath).toString());
            config = configModule.default || configModule;
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            console.error(`Error: ${message}`);
            process.exit(1);
        }
    }

    // For TypeScript files, use ts-node to execute them
    else if (ext === '.ts') {
        const tmpScriptPath = path.join(process.cwd(), '.temp-config-script.mjs');
        const script = `
try {
    const config = await import('${pathToFileURL(resolvedPath).toString()}');
    console.log(JSON.stringify(config.default || config));
} catch (error) {
    console.error('Failed to load config:', error.message);
    process.exit(1);
}
`;

        try {
            fs.writeFileSync(tmpScriptPath, script);
            // Use ts-node/esm loader which handles ES modules properly
            const { stdout } = await execAsync(`node --loader ts-node/esm "${tmpScriptPath}"`);
            config = JSON.parse(stdout);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            console.error(`Error: ${message}`);
            process.exit(1);
        } finally {
            if (fs.existsSync(tmpScriptPath)) {
                fs.unlinkSync(tmpScriptPath);
            }
        }
    } else {
        throw new Error(`Unsupported config file extension: ${ext}`);
    }

    // Add default paths for HTML reports and traces
    return addDefaultPaths(config);
}

/**
 * Extract directory paths for HTML reports and traces from config
 */
export function getDirectoryPaths(config: PlaywrightConfig): {
    htmlReportDir: string | null;
    traceDir: string | null;
} {
    let htmlReportDir: string | null = null;

    // Find HTML reporter configuration
    if (config.reporter) {
        for (const reporter of config.reporter) {
            if (typeof reporter === 'string' && reporter === 'html') {
                htmlReportDir = 'playwright-report'; // Default path
                break;
            } else if (Array.isArray(reporter) && reporter[0] === 'html') {
                const options = reporter[1] || {};
                htmlReportDir = options.outputFolder || 'playwright-report';
                break;
            }
        }
    }

    // Check if tracing is enabled
    let traceDir: string | null = null;
    if (config.use?.trace) {
        // If trace is enabled (boolean true, or string like 'on', 'on-first-retry', etc.)
        const traceEnabled = config.use.trace === true ||
            (typeof config.use.trace === 'string' && config.use.trace !== 'off') ||
            (typeof config.use.trace === 'object');

        if (traceEnabled) {
            traceDir = config.outputDir || 'test-results';
        }
    }

    return {
        htmlReportDir,
        traceDir
    };
}