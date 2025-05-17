# Playwright Result Scrubber

A tool for scrubbing sensitive information from Playwright HTML reports and trace files.

## Features

- Scrubs sensitive information (passwords, emails, tokens, etc.) from Playwright HTML reports and trace files
- Automatically locates reports and trace files based on your Playwright configuration
- Customizable scrubbing rules via JSON or JS files
- Can be used as a CLI tool or as a library
- Can be integrated with Playwright's global teardown

## Installation

```bash
npm install --save-dev playwright-result-scrubber
```

## Usage

### Command Line Interface

```bash
# Using default settings
npx playwright-scrub

# With custom configuration
npx playwright-scrub --config=./tests/playwright.config.ts --rules=./scrub-rules.json

# Output to a different directory
npx playwright-scrub --output=./sanitized-reports

# Add inline scrubbing rules
npx playwright-scrub --pattern "password['\"]?\\s*[=:]\\s*['\"]([^'\"]+)['\"]" "password=\\\"********\\\""
```

### API Usage

```typescript
import { scrubPlaywrightResult } from 'playwright-result-scrubber';

await scrubPlaywrightResult('./playwright.config.ts', {
  rules: [
    { pattern: /password["']?\s*[=:]\s*["']([^"']+)["']/gi, replacement: 'password="********"' },
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: 'user@example.com' },
  ],
  outputDir: './sanitized-reports', // Optional
  preserveOriginals: true,          // Optional
  verbose: true                     // Optional
});
```

### Integration with Playwright's Global Teardown

Create a teardown file, for example `global-teardown.ts`:

```typescript
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
```

Then, update your `playwright.config.ts` to use this teardown:

```typescript
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  // Your existing config...
  
  // Add the global teardown
  globalTeardown: path.join(__dirname, 'global-teardown.ts'),
});
```

## Creating Scrubbing Rules

Rules can be defined in several ways:

### Inline in Code

```typescript
const rules = [
  // Password in HTML attributes or JSON
  { pattern: /password["']?\s*[=:]\s*["']([^"']+)["']/gi, replacement: 'password="********"' },
  
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: 'user@example.com' },
  
  // Credit card numbers
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '****-****-****-****' },
];
```

### JSON File

Create a `playwright-scrub-rules.json` file:

```json
[
  {
    "pattern": "password['\"]?\\s*[=:]\\s*['\"]([^'\"]+)['\"]",
    "replacement": "password=\"********\""
  },
  {
    "pattern": "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    "replacement": "user@example.com"
  }
]
```

### JavaScript File

Create a `playwright-scrub-rules.js` file:

```javascript
module.exports = [
  // Password in HTML attributes or JSON
  { pattern: /password["']?\s*[=:]\s*["']([^"']+)["']/gi, replacement: 'password="********"' },
  
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: 'user@example.com' },
];
```

## Default Rules

If no rules are provided, the tool includes default rules to scrub:

- Passwords and authentication credentials
- Email addresses
- Credit card numbers
- API keys and tokens
- JWT tokens

## Advanced Usage

### Handling Trace Files

Trace files are ZIP archives containing multiple files. The scrubber unzips the trace file, processes all text-based files inside, and then rezips the contents.

### Customizing Output

By default, the scrubber overwrites the original files. Use the `outputDir` option to save scrubbed files to a different location.

## Options

| Option | CLI Flag | Description |
|--------|----------|-------------|
| `configPath` | `--config`, `-c` | Path to Playwright config file (default: `./playwright.config.ts`) |
| `rules` | `--rules`, `-r` | Path to rules file or array of rules |
| `outputDir` | `--output`, `-o` | Output directory for scrubbed files |
| `preserveOriginals` | `--preserve`, `-p` | Keep original files when using `outputDir` |
| `verbose` | `--verbose`, `-v` | Enable detailed logging |

## License

MIT
