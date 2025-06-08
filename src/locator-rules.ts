/**
 * locator-rules.ts
 * Factory for creating locator-based scrubbing rules
 */

import { LocatorRuleConfig, ScrubbingRule } from './types';



export class LocatorRulesFactory {
    /**
     * Default configuration for sensitive field identifiers
     * ASSUMPTION: Common field names that contain sensitive data
     */
    private static readonly DEFAULT_CONFIG: LocatorRuleConfig = {
        sensitiveIdentifiers: [
            'password', 'pass', 'pwd', 'secret', 'token', 'key',
            'username', 'user', 'login', 'email', 'mail',
            'credit', 'card', 'ssn', 'social', 'phone', 'mobile',
            'address', 'zip', 'postal', 'account', 'number'
        ],
        maskingStrategy: 'asterisks',
        caseSensitive: false
    };

    /**
     * Generate locator-based scrubbing rules
     * ASSUMPTION: Playwright code uses standard locator patterns
     */
    static createLocatorRules(config: Partial<LocatorRuleConfig> = {}): ScrubbingRule[] {
        const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
        const rules: ScrubbingRule[] = [];

        for (const identifier of finalConfig.sensitiveIdentifiers) {
            // Create rules for different locator strategies
            rules.push(...this.createRulesForIdentifier(identifier, finalConfig));
        }

        return rules;
    }

    /**
     * Create rules for a specific sensitive identifier
     * Covers multiple locator strategies and selector types
     */
    private static createRulesForIdentifier(
        identifier: string,
        config: LocatorRuleConfig
    ): ScrubbingRule[] {
        const flags = config.caseSensitive ? 'g' : 'gi';
        const mask = this.getMaskValue(config);

        return [
            // CSS selectors with id attribute
            {
                pattern: new RegExp(
                    `(\\.locator\\s*\\(\\s*["''][^"'']*#[^"'']*${identifier}[^"'']*["'']\\s*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // CSS selectors with attribute selectors
            {
                pattern: new RegExp(
                    `(\\.locator\\s*\\(\\s*["''][^"'']*\\[[^\\]]*${identifier}[^\\]]*\\][^"'']*["'']\\s*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // XPath selectors with id attribute
            {
                pattern: new RegExp(
                    `(\\.locator\\s*\\(\\s*["'']//[^"'']*\\[@id\\s*=\\s*['"][^''"]*${identifier}[^''"]*['"][^"'']*["'']\\s*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // XPath selectors with name attribute
            {
                pattern: new RegExp(
                    `(\\.locator\\s*\\(\\s*["'']//[^"'']*\\[@name\\s*=\\s*['"][^''"]*${identifier}[^''"]*['"][^"'']*["'']\\s*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // XPath selectors with class attribute
            {
                pattern: new RegExp(
                    `(\\.locator\\s*\\(\\s*["'']//[^"'']*\\[@class\\s*=\\s*['"][^''"]*${identifier}[^''"]*['"][^"'']*["'']\\s*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // XPath selectors with contains() function
            {
                pattern: new RegExp(
                    `(\\.locator\\s*\\(\\s*["'']//[^"'']*contains\\s*\\([^,]+,\\s*['"][^''"]*${identifier}[^''"]*['"]\\)[^"'']*["'']\\s*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // data-testid selectors
            {
                pattern: new RegExp(
                    `(\\.locator\\s*\\(\\s*["'']\\[data-testid[^\\]]*${identifier}[^\\]]*\\]["'']\\s*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // getByTestId method
            {
                pattern: new RegExp(
                    `(\\.getByTestId\\s*\\(\\s*["''][^"'']*${identifier}[^"'']*["'']\\s*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // getByRole with name containing identifier
            {
                pattern: new RegExp(
                    `(\\.getByRole\\s*\\([^\\)]*name\\s*:\\s*["''][^"'']*${identifier}[^"'']*["''][^\\)]*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // getByLabel method
            {
                pattern: new RegExp(
                    `(\\.getByLabel\\s*\\(\\s*["''][^"'']*${identifier}[^"'']*["'']\\s*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // getByPlaceholder method
            {
                pattern: new RegExp(
                    `(\\.getByPlaceholder\\s*\\(\\s*["''][^"'']*${identifier}[^"'']*["'']\\s*\\)\\.fill\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            }
        ];
    }

    /**
     * Get masking value based on strategy
     * DEFAULT: Uses asterisks for masking
     */
    private static getMaskValue(config: LocatorRuleConfig): string {
        switch (config.maskingStrategy) {
            case 'asterisks':
                return '********';
            case 'placeholder':
                return '[MASKED]';
            case 'custom':
                return config.customMask || '********';
            default:
                return '********'; // DEFAULT fallback
        }
    }

    /**
     * Create rules for specific Playwright methods beyond fill()
     * ASSUMPTION: Other methods like type(), selectOption() may also contain sensitive data
     */
    static createExtendedLocatorRules(config: Partial<LocatorRuleConfig> = {}): ScrubbingRule[] {
        const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
        const rules: ScrubbingRule[] = [];

        const methods = ['fill', 'type', 'selectOption', 'setInputFiles'];

        for (const identifier of finalConfig.sensitiveIdentifiers) {
            for (const method of methods) {
                rules.push(...this.createMethodRulesForIdentifier(identifier, method, finalConfig));
            }
        }

        return rules;
    }

    /**
     * Create rules for specific method and identifier combination
     */
    private static createMethodRulesForIdentifier(
        identifier: string,
        method: string,
        config: LocatorRuleConfig
    ): ScrubbingRule[] {
        const flags = config.caseSensitive ? 'g' : 'gi';
        const mask = this.getMaskValue(config);

        return [
            // Generic locator pattern for any method
            {
                pattern: new RegExp(
                    `(\\.locator\\s*\\([^\\)]*${identifier}[^\\)]*\\)\\.${method}\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            },

            // getBy* methods
            {
                pattern: new RegExp(
                    `(\\.getBy\\w+\\s*\\([^\\)]*${identifier}[^\\)]*\\)\\.${method}\\s*\\(\\s*["''])([^"'']*)((["'']\\s*\\)))`,
                    flags
                ),
                replacement: `$1${mask}$3`
            }
        ];
    }

    /**
     * Create custom rules for specific patterns
     * Allows for project-specific customization
     */
    static createCustomRules(patterns: Array<{
        locatorPattern: string;
        replacement: string;
        caseSensitive?: boolean;
    }>): ScrubbingRule[] {
        return patterns.map(({ locatorPattern, replacement, caseSensitive = false }) => ({
            pattern: new RegExp(locatorPattern, caseSensitive ? 'g' : 'gi'),
            replacement
        }));
    }

    /**
     * Get comprehensive rules combining all strategies
     * DEFAULT: Includes all locator rules and extended method rules
     */
    static getAllRules(config: Partial<LocatorRuleConfig> = {}): ScrubbingRule[] {
        return [
            ...this.createLocatorRules(config),
            ...this.createExtendedLocatorRules(config)
        ];
    }
}

export { LocatorRuleConfig };

