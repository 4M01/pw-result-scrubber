/**
 * config-parser.ts
 * 
 * Utility to parse Playwright config files
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
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

    // For JavaScript files, use dynamic import
    if (ext === '.js') {
        try {
            const config = await import(resolvedPath);
            return config.default || config;
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            console.error(`Error: ${message}`);
            process.exit(1);
        }
    }

    // For TypeScript files, use ts-node to execute them
    else if (ext === '.ts') {
        const tmpScriptPath = path.join(process.cwd(), '.temp-config-script.js');
        const script = `
import 'ts-node/register';
import config from '${resolvedPath.replace(/\\/g, '\\\\')}';
console.log(JSON.stringify(config.default || config));
`;

        try {
            fs.writeFileSync(tmpScriptPath, script);
            const { stdout } = await execAsync(`node "${tmpScriptPath}"`);
            return JSON.parse(stdout);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            console.error(`Error: ${message}`);
            process.exit(1);
        } finally {
            if (fs.existsSync(tmpScriptPath)) {
                fs.unlinkSync(tmpScriptPath);
            }
        }
    }

    throw new Error(`Unsupported config file extension: ${ext}`);
}