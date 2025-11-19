module.exports = {
  // File type specific linting rules
  '*.{js,jsx,ts,tsx}': [
    // ESLint with auto-fix (faster when run first)
    'eslint --fix --max-warnings=0 --quiet',
    // Prettier formatting
    'prettier --write',
  ],

  // Style and configuration files
  '*.{json,md,yml,yaml,css,scss}': 'prettier --write',

  // Package files (special handling)
  'package.json': [
    // Validate package.json format
    'prettier --write',
    // Check for potential issues
    'npm ls --depth=0 >/dev/null || true',
  ],
}
