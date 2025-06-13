# Contributing to Shopify Bulk-Tagger

Thank you for your interest in contributing to Shopify Bulk-Tagger! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm 8+
- Git
- A Shopify development store (for testing)

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/shopify-bulk-tagger.git`
3. Install dependencies: `pnpm install`
4. Start development server: `pnpm dev`
5. Open http://localhost:5173

## 📝 Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow the existing code style and patterns
- Use meaningful variable and function names
- Add JSDoc comments for complex functions
- Keep functions small and focused

### Commit Messages
Follow conventional commits format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding tests
- `chore:` for maintenance tasks

Example: `feat: add webhook support for real-time updates`

### Testing
- Test your changes thoroughly
- Use the dry run mode for testing rules
- Test with different Shopify store configurations
- Verify error handling works correctly

## 🐛 Bug Reports

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, Node.js version)
- Screenshots if applicable
- Shopify store details if relevant

## 💡 Feature Requests

When suggesting features, please include:
- Clear description of the feature
- Use case and problem it solves
- Alternative solutions considered
- Impact on existing functionality

## 🔧 Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the guidelines above
3. Test your changes thoroughly
4. Update documentation if needed
5. Submit a pull request with a clear description
6. Ensure all CI checks pass
7. Request review from maintainers

### PR Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code is commented where necessary
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or clearly documented)

## 🏗 Architecture Overview

### Key Components
- `src/lib/shopify-api.ts` - Shopify API integration
- `src/lib/rule-executor.ts` - Rule execution engine
- `src/lib/auth-service.ts` - OAuth authentication
- `src/components/` - React components
- `docs/` - Documentation

### Adding New Features
1. Understand the existing architecture
2. Follow the established patterns
3. Update relevant documentation
4. Add tests for new functionality
5. Consider backward compatibility

## 🔒 Security

- Never commit API keys or secrets
- Use environment variables for configuration
- Follow OAuth 2.0 best practices
- Validate all user inputs
- Handle errors gracefully without exposing sensitive information

## 📚 Resources

- [Shopify API Documentation](https://shopify.dev/api)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🤝 Questions?

If you have questions about contributing:
- Open an issue for general questions
- Check existing issues for similar questions
- Review the documentation in `docs/`

Thank you for contributing to Shopify Bulk-Tagger! 🚀 