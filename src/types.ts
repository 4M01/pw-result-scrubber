/**
 * types.ts
 * Core types and interfaces for the Playwright Result Scrubber
 */

export interface ScrubbingRule {
    pattern: string | RegExp;
    replacement: string;
}

export interface ScrubberOptions {
    rules: ScrubbingRule[];
    outputDir?: string;
    preserveOriginals?: boolean;
    verbose?: boolean;
}

export interface PlaywrightConfig {
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

export interface DirectoryPaths {
    htmlReportDir: string | null;
    traceDir: string | null;
}

export interface LocatorRuleConfig {
    sensitiveIdentifiers: string[];
    maskingStrategy: 'asterisks' | 'placeholder' | 'custom';
    customMask?: string;
    caseSensitive?: boolean;
}