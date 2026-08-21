# Contributing to Capital-OS

Thank you for your interest in contributing to Capital-OS. This document provides guidelines and instructions for contributing.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Code Standards](#code-standards)
5. [Commit Convention](#commit-convention)
6. [Pull Request Process](#pull-request-process)
7. [Testing Requirements](#testing-requirements)
8. [Documentation](#documentation)

---

## Code of Conduct

- Be respectful and professional
- Focus on constructive feedback
- Help create a welcoming environment for all contributors

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Supabase CLI
- Git
- NVIDIA API key (for AI features; use `AI_MOCK_MODE=true` to develop without it)

### Setup

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/yourusername/CapitalOS.git
cd CapitalOS

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local

# Start Supabase
supabase start
supabase db reset

# Start development
pnpm dev
```

---

## Development Workflow

### Branch Strategy

```
main          — Production-ready code
develop       — Integration branch
feature/*     — New features
fix/*         — Bug fixes
docs/*        — Documentation changes
refactor/*    — Code refactoring
```

### Creating a Branch

```bash
# Feature
git checkout -b feature/investor-matching

# Bug fix
git checkout -b fix/email-thread-dedup

# Documentation
git checkout -b docs/update-api-reference
```

### Working on a Feature

1. Create a feature branch from `develop`
2. Make your changes
3. Write tests for new functionality
4. Run `pnpm lint && pnpm typecheck && pnpm test`
5. Commit with a descriptive message
6. Push and create a pull request

---

## Code Standards

### TypeScript

- **Strict mode** is enabled — no `any` types
- Use interfaces for object shapes, types for unions/intersections
- Prefer `unknown` over `any` when type is uncertain
- Use Zod for runtime validation of external data

```typescript
// ✅ Good
interface InvestorScore {
  score: number;
  priority: "A+" | "A" | "B" | "C" | "D";
  reasons: string[];
}

// ❌ Bad
const score: any = { ... };
```

### React / Next.js

- Use Server Components by default
- Add `"use client"` only when the component needs interactivity
- Keep server-side logic on the server
- Never expose secrets in client components

```typescript
// ✅ Server Component (default)
export default async function InvestorsPage() {
  const investors = await getInvestors();
  return <InvestorList investors={investors} />;
}

// ✅ Client Component (when needed)
"use client";
export function InvestorFilter({ onChange }: Props) {
  // interactive UI logic
}
```

### Styling

- Use Tailwind CSS utility classes
- Follow Trezo's design tokens and color palette
- Maintain consistent spacing and typography
- Ensure responsive design for all breakpoints
- Meet WCAG 2.1 AA contrast requirements

### Database

- All queries go through Supabase client (never raw SQL in app code unless necessary)
- Use RLS policies for all data access
- Validate all inputs before database writes
- Use transactions for multi-step operations

---

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code restructuring |
| `test` | Adding/updating tests |
| `chore` | Build, tooling, dependencies |
| `perf` | Performance improvement |

### Scopes

| Scope | Description |
|-------|-------------|
| `auth` | Authentication |
| `startup` | Startup module |
| `investor` | Investor module |
| `campaign` | Campaign module |
| `outreach` | Email outreach |
| `copilot` | AI Copilot |
| `agent` | AI agent system |
| `matching` | Investor matching |
| `db` | Database schema/migrations |
| `ui` | UI components |
| `api` | API routes |
| `security` | Security-related |

### Examples

```
feat(investor): add semantic matching with pgvector embeddings

fix(outlook): handle email thread deduplication edge case

docs(api): update investor endpoints documentation

chore(deps): upgrade supabase-js to v2.45
```

---

## Pull Request Process

### Before Submitting

- [ ] Code compiles without errors (`pnpm build`)
- [ ] No lint errors (`pnpm lint`)
- [ ] No type errors (`pnpm typecheck`)
- [ ] Tests pass (`pnpm test`)
- [ ] New features have tests
- [ ] Documentation is updated if needed
- [ ] No secrets or API keys in code
- [ ] RLS policies cover new tables/columns

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe tests you ran and how to verify.

## Checklist
- [ ] Self-reviewed code
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No console.logs or debug code
- [ ] RLS policies updated (if applicable)
```

### Review Process

1. All PRs require at least one review
2. CI must pass (lint, typecheck, tests, build)
3. Address review feedback
4. Squash and merge to `develop`

---

## Testing Requirements

### Unit Tests

- All utility functions
- Zod schemas
- Matching/scoring logic
- Agent task state transitions

### Integration Tests

- Supabase operations (use test database)
- API routes
- Server actions
- Edge functions

### What to Test

```typescript
// ✅ Test business logic
describe("investorScore", () => {
  it("should rank stage-compatible investors higher", () => {
    const score = calculateFitScore(startup, investor);
    expect(score).toBeGreaterThan(70);
  });
});

// ✅ Test schemas
describe("startupProfileSchema", () => {
  it("should reject empty names", () => {
    const result = startupProfileSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
```

---

## Documentation

- All public functions must have JSDoc comments
- Complex algorithms must have inline comments explaining the approach
- API routes must document request/response shapes
- New features must update the relevant doc in `docs/`
- Database changes must update `docs/DATABASE_SCHEMA.md`

---

## Questions?

Open a GitHub issue or start a discussion.
