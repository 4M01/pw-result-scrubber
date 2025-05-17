/**
 * config-parser.ts
 * 
 * Utility to parse Playwright config files
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PlaywrightConfig {
    reporter?: Array<string | [string, any]>;
    outputDir?: string;
    use?: {
        trace?: boolean | {
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
 * Parse a Playwright config file
 * This handles both JavaScript and TypeScript config files
 */
export async function parseConfig(configPath: string): Promise<PlaywrightConfig> {
    const resolvedPath = path.resolve(configPath);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Config file not found: ${resolvedPath}`);
    }

    const ext = path.extname(resolvedPath).toLowerCase();

    // For JavaScript files, we can require them directly
    if (ext === '.js') {
        try {
            // Delete require cache to ensure we get fresh config
            delete require.cache[require.resolve(resolvedPath)];
            const config = require(resolvedPath);
            return config.default || config;
        } catch (error) {
            throw new Error(`Failed to parse JavaScript config: ${error.message}`);
        }
    }

    // For TypeScript files, we need to use ts-node to execute them
    else if (ext === '.ts') {
        // Create a small script to output the config as JSON
        const tmpScriptPath = path.join(process.cwd(), '.temp-config-script.js');
        const script = `
      require('ts-node/register');
      const config = require('${resolvedPath.replace(/\\/g, '\\\\')}');
      console.log(JSON.stringify(config.default || config));
    `;

        try {
            fs.writeFileSync(tmpScriptPath, script);
            const { stdout } = await execAsync(`node "${tmpScriptPath}"`);
            return JSON.parse(stdout);
        } catch (error) {
            throw new Error(`Failed to parse TypeScript config: ${error.message}`);
        } finally {
            if (fs.existsSync(tmpScriptPath)) {
                fs.unlinkSync(tmpScriptPath);
            }
        }
    }

    throw new Error(`Unsupported config file extension: ${ext}`);
}