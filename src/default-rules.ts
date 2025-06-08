/**
 * default-rules.ts
 * Enhanced default scrubbing rules factory with locator-based rules
 */

import { LocatorRuleConfig, LocatorRulesFactory } from './locator-rules';
import { ScrubbingRule } from './types';

export class DefaultRulesFactory {
    /**
     * Get legacy pattern-based scrubbing rules
     * ASSUMPTION: Common sensitive data patterns are covered
     */
    static getLegacyRules(): ScrubbingRule[] {
        return [
            // Email addresses (global pattern)
            {
                pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                replacement: 'user@example.com'
            },

            // Credit card numbers (global pattern)
            {
                pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
                replacement: '****-****-****-****'
            },

            // Social Security Numbers (US format)
            {
                pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
                replacement: '***-**-****'
            },

            // JWT tokens (global pattern)
            {
                pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
                replacement: 'JWT_TOKEN_REMOVED'
            },

            // API keys in configuration (when not using locators)
            {
                pattern: /["']?api[-_]?key["']?\s*[=:]\s*["']([^"']{8,})["']/gi,
                replacement: 'api-key="********"'
            },

            // Generic long numeric sequences (phone numbers, IDs, etc.)
            {
                pattern: /\b\d{10,16}\b/g,
                replacement: '**********'
            }
        ];
    }

    /**
     * Get locator-based scrubbing rules for Playwright tests
     * DEFAULT: Uses standard sensitive field identifiers
     */
    static getLocatorRules(config?: Partial<LocatorRuleConfig>): ScrubbingRule[] {
        return LocatorRulesFactory.getAllRules(config);
    }

    /**
     * Get comprehensive default rules (legacy + locator-based)
     * DEFAULT: Combines both legacy patterns and locator-based rules
     */
    static getDefaultRules(config?: Partial<LocatorRuleConfig>): ScrubbingRule[] {
        return [
            ...this.getLocatorRules(config),
            ...this.getLegacyRules(),
            ...this.getJavaScriptRules() // Add JavaScript-specific rules
        ];
    }

    /**
     * Get rules optimized for Playwright HTML reports
     * ASSUMPTION: HTML reports contain test code with locator patterns
     */
    static getPlaywrightRules(config?: Partial<LocatorRuleConfig>): ScrubbingRule[] {
        const defaultConfig: LocatorRuleConfig = {
            sensitiveIdentifiers: [
                'password', 'pass', 'pwd', 'secret', 'token',
                'username', 'user', 'login', 'email', 'mail',
                'credit', 'card', 'ssn', 'social', 'phone',
                'address', 'zip', 'postal', 'account', 'otp',
                'pin', 'security', 'answer', 'key'
            ],
            maskingStrategy: 'asterisks',
            caseSensitive: false,
            ...config
        };

        return this.getDefaultRules(defaultConfig);
    }

    /**
     * Get rules for trace files
     * ASSUMPTION: Trace files may contain both code and runtime values
     */
    static getTraceRules(config?: Partial<LocatorRuleConfig>): ScrubbingRule[] {
        return [
            ...this.getLocatorRules(config),
            ...this.getLegacyRules(),
            // Additional rules for trace-specific patterns
            {
                pattern: /"value"\s*:\s*"([^"]{8,})"/g,
                replacement: '"value": "********"'
            },
            {
                pattern: /"text"\s*:\s*"([^"]{8,})"/g,
                replacement: '"text": "********"'
            }
        ];
    }

    /**
     * Create rules from JSON configuration
     * ASSUMPTION: JSON contains valid rule objects with pattern and replacement
     */
    static fromJson(jsonRules: any[]): ScrubbingRule[] {
        return jsonRules.map(rule => ({
            pattern: rule.pattern,
            replacement: rule.replacement
        }));
    }

    /**
     * Create custom configuration for specific project needs
     */
    static createCustomConfig(options: {
        additionalIdentifiers?: string[];
        excludeIdentifiers?: string[];
        maskingStrategy?: 'asterisks' | 'placeholder' | 'custom';
        customMask?: string;
        caseSensitive?: boolean;
    }): LocatorRuleConfig {
        const baseIdentifiers = [
            'password', 'pass', 'pwd', 'secret', 'token',
            'username', 'user', 'login', 'email', 'mail',
            'credit', 'card', 'ssn', 'social', 'phone'
        ];

        let sensitiveIdentifiers = [...baseIdentifiers];

        if (options.additionalIdentifiers) {
            sensitiveIdentifiers.push(...options.additionalIdentifiers);
        }

        if (options.excludeIdentifiers) {
            sensitiveIdentifiers = sensitiveIdentifiers.filter(
                id => !options.excludeIdentifiers!.includes(id)
            );
        }

        return {
            sensitiveIdentifiers,
            maskingStrategy: options.maskingStrategy || 'asterisks',
            customMask: options.customMask,
            caseSensitive: options.caseSensitive || false
        };
    }

    /**
     * Get rules for JavaScript context
     * ASSUMPTION: Scrubs sensitive data in dynamically injected JavaScript strings
     */
    static getJavaScriptRules(): ScrubbingRule[] {
        return [
            // Scrub sensitive data in dynamically injected JavaScript strings
            {
                pattern: /window\.playwrightReportBase64\s*=\s*["']data:application\/zip;base64,[^"']+["']/g,
                replacement: 'window.playwrightReportBase64 = "********";'
            },
            {
                pattern: /(["']password["']\s*:\s*["'])([^"']+)(["'])/g,
                replacement: '$1********$3'
            },
            {
                pattern: /(["']email["']\s*:\s*["'])([^"']+)(["'])/g,
                replacement: '$1********$3'
            },
            {
                pattern: /(["']token["']\s*:\s*["'])([^"']+)(["'])/g,
                replacement: '$1********$3'
            }
        ];
    }

    static getBase64DecodedRules(): ScrubbingRule[] {
        return [
            {
                pattern: /(["']password["']\s*:\s*["'])([^"']+)(["'])/g,
                replacement: '$1********$3'
            },
            {
                pattern: /(["']email["']\s*:\s*["'])([^"']+)(["'])/g,
                replacement: '$1********$3'
            },
            {
                pattern: /(["']token["']\s*:\s*["'])([^"']+)(["'])/g,
                replacement: '$1********$3'
            }
        ];
    }
}