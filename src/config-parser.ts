/**
 * config-parser.ts
 * Enhanced configuration parser with better OOP design
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';
import { DirectoryPaths, PlaywrightConfig } from './types';

const execAsync = promisify(exec);

export class PlaywrightConfigParser {
    private readonly configPath: string;
    private readonly projectRoot: string;

    constructor(configPath: string) {
        // ASSUMPTION: Config path is provided and should exist
        this.configPath = path.resolve(configPath);
        this.projectRoot = path.dirname(this.configPath);

        if (!fs.existsSync(this.configPath)) {
            throw new Error(`Config file not found: ${this.configPath}`);
        }
    }

    /**
     * Parse Playwright configuration file
     * ASSUMPTION: Config file is either .js or .ts and follows Playwright config structure
     * DEFAULT: Adds default reporter and output directory if not specified
     */
    async parse(): Promise<PlaywrightConfig> {
        const ext = path.extname(this.configPath).toLowerCase();
        let config: PlaywrightConfig;

        switch (ext) {
            case '.js':
                config = await this.parseJavaScriptConfig();
                break;
            case '.ts':
                config = await this.parseTypeScriptConfig();
                break;
            default:
                throw new Error(`Unsupported config file extension: ${ext}. Supported: .js, .ts`);
        }

        return this.addDefaults(config);
    }

    /**
     * Parse JavaScript configuration
     * ASSUMPTION: File exports a valid Playwright config object
     */
    private async parseJavaScriptConfig(): Promise<PlaywrightConfig> {
        try {
            const configModule = await import(pathToFileURL(this.configPath).toString());
            return configModule.default || configModule;
        } catch (error) {
            throw new Error(`Failed to load JavaScript config: ${error}`);
        }
    }

    /**
     * Parse TypeScript configuration using ts-node
     * ASSUMPTION: ts-node is available in the environment
     * ASSUMPTION: TypeScript config compiles successfully
     */
    private async parseTypeScriptConfig(): Promise<PlaywrightConfig> {
        const tmpScriptPath = path.join(process.cwd(), '.temp-config-script.mjs');
        const script = `
try {
    const config = await import('${pathToFileURL(this.configPath).toString()}');
    console.log(JSON.stringify(config.default || config));
} catch (error) {
    console.error('Failed to load config:', error.message);
    process.exit(1);
}`;

        try {
            fs.writeFileSync(tmpScriptPath, script);
            const { stdout } = await execAsync(`node --loader ts-node/esm "${tmpScriptPath}"`);
            return JSON.parse(stdout);
        } catch (error) {
            throw new Error(`Failed to load TypeScript config: ${error}`);
        } finally {
            await this.cleanup(tmpScriptPath);
        }
    }

    /**
     * Add default configuration values
     * DEFAULT: outputDir = 'test-results', HTML reporter = 'playwright-report'
     */
    private addDefaults(config: PlaywrightConfig): PlaywrightConfig {
        const result = { ...config };

        // DEFAULT: Set default outputDir
        if (!result.outputDir) {
            result.outputDir = 'test-results';
        }

        // DEFAULT: Ensure reporter array exists
        if (!result.reporter || !Array.isArray(result.reporter)) {
            result.reporter = [];
        }

        // DEFAULT: Add HTML reporter if not present
        if (!this.hasHtmlReporter(result.reporter)) {
            result.reporter.push(['html', { outputFolder: 'playwright-report' }]);
        }

        return result;
    }

    /**
     * Check if HTML reporter is configured
     * ASSUMPTION: Reporter array contains valid reporter configurations
     */
    private hasHtmlReporter(reporters: Array<string | [string, any]>): boolean {
        return reporters.some(reporter => {
            if (typeof reporter === 'string') {
                return reporter === 'html';
            }
            if (Array.isArray(reporter)) {
                return reporter[0] === 'html';
            }
            return false;
        });
    }

    /**
     * Extract directory paths from configuration  
     * DEFAULT: HTML report = 'playwright-report', traces use outputDir
     * ASSUMPTION: Trace is enabled if use.trace is truthy (except 'off')
     */
    getDirectoryPaths(config: PlaywrightConfig): DirectoryPaths {
        return {
            htmlReportDir: this.getHtmlReportDir(config),
            traceDir: this.getTraceDir(config)
        };
    }

    private getHtmlReportDir(config: PlaywrightConfig): string | null {
        if (!config.reporter) return null;

        for (const reporter of config.reporter) {
            if (typeof reporter === 'string' && reporter === 'html') {
                return path.resolve(this.projectRoot, 'playwright-report'); // DEFAULT
            }
            if (Array.isArray(reporter) && reporter[0] === 'html') {
                const options = reporter[1] || {};
                const outputFolder = options.outputFolder || 'playwright-report'; // DEFAULT
                return path.resolve(this.projectRoot, outputFolder);
            }
        }
        return null;
    }

    private getTraceDir(config: PlaywrightConfig): string | null {
        if (!config.use?.trace) return null;

        // ASSUMPTION: Any truthy trace value except 'off' means tracing is enabled
        const traceEnabled = config.use.trace === true ||
            (typeof config.use.trace === 'string' && config.use.trace !== 'off') ||
            (typeof config.use.trace === 'object');

        if (traceEnabled) {
            return path.resolve(this.projectRoot, config.outputDir || 'test-results'); // DEFAULT
        }
        return null;
    }

    private async cleanup(filePath: string): Promise<void> {
        try {
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}