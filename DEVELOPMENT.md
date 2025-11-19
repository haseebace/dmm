# DMM Development Guide

Welcome to the DMM development guide! This comprehensive resource covers everything from initial setup to advanced development workflows for team members at all levels.

## 🚀 Quick Start (15 minutes)

### 1. Repository Setup

```bash
# Clone the repository
git clone <repository-url>
cd dmm

# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your local configuration

# Install git hooks
npm run prepare

# Start development server
npm run dev
```

### 2. Verify Your Setup

```bash
# Run all quality checks to ensure everything is working
npm run quality-check

# Your development environment is ready if:
# ✅ ESLint passes
# ✅ Prettier formatting is correct
# ✅ TypeScript compiles without errors
# ✅ Tests pass
```

## 🛠️ Development Workflow

### Daily Development

1. **Start your day**: Pull latest changes

   ```bash
   git pull origin main
   npm install  # Update dependencies if needed
   npm run dev   # Start dev server
   ```

2. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes**:
   - Write code following our style guide
   - Tests should run automatically in watch mode
   - Git hooks will validate your code before commits

4. **Commit your work**:

   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

   - Pre-commit hooks will run automatically
   - If hooks fail, fix the issues and retry

5. **Push and create PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

## 📋 Available Scripts

### Development

- `npm run dev` - Start development server
- `npm run dev:inspect` - Dev server with Node debugging
- `npm run build` - Production build
- `npm run start` - Start production server

### Quality Checks

- `npm run lint` - Fix ESLint issues
- `npm run lint:check` - Check ESLint without fixing
- `npm run format` - Fix Prettier formatting
- `npm run format:check` - Check formatting without fixing
- `npm run type-check` - TypeScript compilation check
- `npm run quality-check` - Run all quality checks

### Testing

- `npm run test` - Tests in watch mode
- `npm run test:run` - Single test run
- `npm run test:coverage` - Tests with coverage report
- `npm run test:watch` - Watch mode (alternative)
- `npm run test:ui` - Interactive test UI

### Utilities

- `npm run clean` - Clean build artifacts
- `npm run clean:all` - Full clean and reinstall
- `npm run analyze` - Bundle analyzer
- `npm run prepare-release` - Prepare for release deployment

## Code Quality Gates

### Pre-commit Hooks

- Automatic linting and formatting
- Fast execution (<30 seconds)
- Processes only staged files for efficiency

### Pre-push Hooks

- Full test suite execution
- Type checking
- Coverage verification
- Production build validation

### Before Committing

1. Code must pass ESLint checks
2. Code must be properly formatted
3. TypeScript compilation must succeed

### Before Pushing

1. All tests must pass
2. Code coverage must meet minimum requirements (80% global)
3. Build must complete successfully

### Before Merging

1. Full quality check must pass: `npm run quality-check`
2. All automated checks must be green
3. Code review must be completed

## 🎯 Code Standards

### Naming Conventions

**Files and Folders**:

- ✅ `user-authentication.tsx` (kebab-case)
- ✅ `OAuth2Provider.ts` (PascalCase for classes/types)
- ❌ `userAuthentication.tsx` (camelCase)
- ❌ `user_auth.tsx` (snake_case)

**Variables and Functions**:

- ✅ `const userName = '...'` (camelCase)
- ✅ `function getUserData()` (camelCase)
- ❌ `const user_name = '...'` (snake_case)

**Components**:

- ✅ `UserProfile.tsx` (PascalCase)
- ✅ `const UserProfile: React.FC = () => {}` (PascalCase)

### Code Style

We use automated tools to maintain consistency:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Line width**: 100 characters
- **Import order**: External → Internal → Relative

### Testing Standards

**Test Structure**:

```typescript
describe('Component/Function', () => {
  it('should do X when Y', () => {
    // Arrange
    const input = createTestData()

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toEqual(expectedOutput)
  })
})
```

**Coverage Requirements**:

- 🎯 Global minimum: 80%
- 🎯 Business logic: 95%
- 🎯 Components: 85%
- 🎯 Utilities: 100%

## Git Workflow

### Branch Naming

- `feature/description` for new features
- `fix/description` for bug fixes
- `docs/description` for documentation

### Commit Message Convention

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for code style changes
- `refactor:` for code refactoring
- `test:` for adding or updating tests
- `chore:` for maintenance tasks

## 🔧 Development Tools

### ESLint Configuration

- Next.js core web vitals preset
- Prettier integration to avoid conflicts
- Custom rules for DMM project conventions
- TypeScript support with proper error handling

### Prettier Configuration

- 2-space indentation
- Single quotes
- Required semicolons
- Tailwind CSS class sorting
- 100 character line width

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

## Performance Guidelines

- Build time: <1 minute
- Hot reload: <200ms
- Test suite: <2 minutes
- Pre-commit hooks: <30 seconds
- Bundle size: <200KB (gzipped)

## 🔧 Environment Setup

### Required Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Real-Debrid OAuth2
REAL_DEBRID_CLIENT_ID=your_client_id
REAL_DEBRID_CLIENT_SECRET=your_client_secret
REAL_DEBRID_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
```

### Development vs Production

- Development: Detailed logging, debug information
- Production: Optimized logging, error reporting only
- Use `NODE_ENV` to control behavior

## 🖥️ IDE Configuration

### VS Code Recommended Extensions

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Auto Rename Tag
- Bracket Pair Colorizer
- GitLens
- TypeScript Importer

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

## 🐛 Troubleshooting

### Common Issues

**Husky hooks not working:**

```bash
npm run prepare
```

**"Module not found" errors:**

```bash
npm run clean:all
npm install
```

**TypeScript errors after npm install:**

```bash
rm -rf node_modules package-lock.json
npm install
```

**Tests failing with missing modules:**

```bash
npm install  # Ensure all dev dependencies are installed
```

**ESLint and Prettier conflicts:**

- Run `npm run lint` first, then `npm run format`
- Check `.eslintrc.json` extends configuration includes "prettier"
- Review custom rules for conflicts

**Slow pre-commit hooks:**

- Reduce test files in pre-commit
- Use `lint-staged` for efficient processing
- Consider moving some checks to pre-push

### Getting Help

1. **Check the logs**: Read error messages carefully
2. **Search the codebase**: Use `git grep` to find similar patterns
3. **Ask the team**: Share error logs and steps to reproduce
4. **Check documentation**: Review this guide and project documentation

## 📚 Learning Resources

### Project-Specific

- **Architecture**: Read `docs/technical/architecture.md`
- **API Documentation**: Check `docs/api/` directory
- **Database Schema**: Review Supabase migrations
- **Tech Stack**: Review `Tech-Stack-and-Feature-Components.md`

### Technology Stack

- **Next.js 16**: [Official Documentation](https://nextjs.org/docs)
- **React 19**: [React Documentation](https://react.dev)
- **TypeScript**: [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- **Supabase**: [Supabase Docs](https://supabase.com/docs)
- **Tailwind CSS**: [Tailwind Documentation](https://tailwindcss.com/docs)

### Development Practices

- **Testing with Vitest**: [Vitest Guide](https://vitest.dev/guide/)
- **Git Hooks**: [Husky Documentation](https://typicode.github.io/husky/)
- **Code Quality**: [ESLint Rules](https://eslint.org/docs/rules/)

## 🎉 Next Steps for New Team Members

1. **Complete the setup** above
2. **Explore the codebase**: Start with `src/app/page.tsx`
3. **Make a small change**: Try fixing a minor issue or adding a test
4. **Create your first PR**: Follow the workflow and submit for review
5. **Join team discussions**: Ask questions and share insights

## 🤝 Team Communication

- **Code Reviews**: All changes require review
- **Questions**: Use team channels for technical discussions
- **Updates**: Share progress and blockers regularly
- **Documentation**: Help improve this guide for future team members

---

## 🚀 Advanced Development

### Bundle Analysis

```bash
npm run analyze
```

This opens an interactive bundle analyzer to help optimize your application size.

### Release Preparation

```bash
npm run prepare-release
```

This script performs final checks before creating a release:

- Runs full test suite
- Validates production build
- Checks for any breaking changes
- Updates version numbers if needed

### Performance Monitoring

- Use React DevTools Profiler for component performance
- Monitor Core Web Vitals in production
- Check bundle size impact with each feature addition

Welcome aboard! We're excited to have you on the team. 🚀
