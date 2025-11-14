# Development Workflow

## Getting Started

1. Install dependencies: `npm install`
2. Copy environment template: `cp .env.local.example .env.local`
3. Set up your environment variables
4. Run development server: `npm run dev`

## Code Quality

### Linting

- **Check**: `npm run lint:check`
- **Fix**: `npm run lint`

### Formatting

- **Check**: `npm run format:check`
- **Fix**: `npm run format`

### Type Checking

- **Check**: `npm run type-check`

## Testing

### Run Tests

- **Watch mode**: `npm run test`
- **Single run**: `npm run test:run`
- **With coverage**: `npm run test:coverage`

### Writing Tests

- Unit tests for utilities in `src/lib/__tests__/`
- Component tests in `src/components/__tests__/`
- Integration tests for API routes in `src/app/api/__tests__/`

## Git Workflow

### Pre-commit Hooks

- Automatic linting and formatting
- Fast execution (<30 seconds)

### Pre-push Hooks

- Full test suite execution
- Type checking
- Coverage verification

### Branch Naming

- `feature/description` for new features
- `fix/description` for bug fixes
- `docs/description` for documentation

## Performance Guidelines

- Build time: <1 minute
- Hot reload: <200ms
- Test suite: <2 minutes
- Pre-commit hooks: <30 seconds

## Development Tools

### ESLint Configuration

- Next.js core web vitals preset
- Prettier integration to avoid conflicts
- Custom rules for DMM project conventions
- TypeScript support with proper error handling

### Prettier Configuration

- 2-space indentation
- Single quotes
- No semicolons
- Tailwind CSS class sorting
- 80 character line width

### Testing Framework

- Vitest for fast unit testing
- React Testing Library for component testing
- jsdom environment for DOM testing
- 80% minimum code coverage requirement

### Git Hooks

- Husky for git hook management
- lint-staged for efficient pre-commit processing
- Pre-commit: lint and format staged files
- Pre-push: run full test suite

## Quality Gates

### Before Committing

1. Code must pass ESLint checks
2. Code must be properly formatted
3. TypeScript compilation must succeed

### Before Pushing

1. All tests must pass
2. Code coverage must meet minimum requirements
3. Build must complete successfully

### Before Merging

1. Full quality check must pass: `npm run quality-check`
2. All automated checks must be green
3. Code review must be completed

## IDE Configuration

### VS Code Recommended Extensions

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Auto Rename Tag
- Bracket Pair Colorizer
- GitLens

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Troubleshooting

### Common Issues

**Husky hooks not working**

- Run `npm run prepare` to reinstall hooks
- Ensure `.git` directory exists
- Check file permissions on `.husky/*` files

**Tests failing in CI**

- Ensure all dependencies are installed
- Check environment variables are set
- Verify test files are properly named

**ESLint and Prettier conflicts**

- Run `npm run lint` first, then `npm run format`
- Check `.eslintrc.json` extends configuration includes "prettier"
- Review custom rules for conflicts

**Slow pre-commit hooks**

- Reduce test files in pre-commit
- Use `lint-staged` for efficient processing
- Consider moving some checks to pre-push

## Environment Variables

### Required Variables

See `.env.local.example` for complete list of required environment variables.

### Development vs Production

- Development: Detailed logging, debug information
- Production: Optimized logging, error reporting only
- Use `NODE_ENV` to control behavior
