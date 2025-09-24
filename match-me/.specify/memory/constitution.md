<!--
Sync Impact Report - Constitution v1.0.0
Version change: Initial → v1.0.0
Added sections:
- Core Principles (5 principles: Code Quality First, TDD, UX Consistency, Performance Standards, Security & Privacy First)
- Development Standards (Code Architecture, Testing Requirements, Visual Quality Gates)
- Quality Assurance (Pre-Commit Requirements, Performance Monitoring, Error Handling Standards)
- Governance (Amendment procedures, versioning policy, compliance review)
Templates requiring updates:
- plan-template.md (✅ updated): Constitution Check section updated with specific compliance gates, version reference updated
- spec-template.md (✅ validated): No constitutional references found
- tasks-template.md (✅ validated): No constitutional references found
- agent-file-template.md (✅ validated): No constitutional references found
Follow-up TODOs: None
-->

# Match Me App Constitution

## Core Principles

### I. Code Quality First
All code must adhere to strict quality standards with zero tolerance for shortcuts that compromise maintainability. TypeScript strict mode is mandatory. ESLint rules are non-negotiable. Code reviews must verify type safety, error handling, and adherence to established patterns. Zod schemas required for all API boundaries and form validation. React Hook Form with proper validation for all user inputs.

**Rationale**: A dating application handles sensitive user data and requires absolute reliability. Quality code prevents security vulnerabilities and ensures user trust.

### II. Test-Driven Development (NON-NEGOTIABLE)
Tests must be written before implementation using Red-Green-Refactor cycle. Jest with React Testing Library for component tests. Integration tests required for all user workflows. Contract tests for API endpoints. Manual testing scenarios documented and verified. No feature ships without passing test coverage.

**Rationale**: Dating apps require flawless user experiences. Broken features directly impact user matching and relationships.

### III. User Experience Consistency
All UI components must follow the S-Tier SaaS design principles documented in `/context/design-principles.md`. NextUI design system enforced throughout. Components wrapped in ErrorBoundary to prevent crashes. Responsive design mandatory (mobile-first). Accessibility compliance (WCAG 2.1 AA) required.

**Rationale**: Consistent, polished UI builds user trust and engagement - critical for a social platform's success.

### IV. Performance Standards
Page load times under 2 seconds. Component render times under 200ms. Database queries optimized with Prisma. Image optimization through Cloudinary. Real-time messaging with minimal latency via Pusher. Bundle size monitoring and code splitting implemented.

**Rationale**: Dating apps compete on user experience. Slow performance leads to user abandonment and poor matching outcomes.

### V. Security & Privacy First
NextAuth v5 with JWT tokens and proper session management. All user data encrypted at rest. Role-based access control enforced. Photo approval workflow prevents inappropriate content. Input validation at all boundaries using Zod schemas. No secrets in client-side code.

**Rationale**: Dating applications handle highly sensitive personal data requiring maximum security and privacy protection.

## Development Standards

### Code Architecture
Next.js 14 App Router with TypeScript. Server Actions for all data mutations returning `ActionResult<T>` type. Zustand for client-side state management. Prisma ORM with PostgreSQL. Middleware-based route protection. Centralized error handling with ErrorBoundary components.

### Testing Requirements
Unit tests for utilities and pure functions. Component tests for all UI components. Integration tests for complete user workflows. Contract tests for API endpoints. Performance tests for critical paths. All tests must pass before deployment.

### Visual Quality Gates
Every frontend change requires immediate visual verification using Playwright MCP integration. Desktop viewport (1440px) screenshots mandatory. Design review agent validation for significant changes. Compliance with design principles checklist verified.

## Quality Assurance

### Pre-Commit Requirements
ESLint checks must pass. TypeScript compilation without errors. Jest test suite passes. Prisma schema validation. Build process completes successfully. No console errors in development.

### Performance Monitoring
Database query performance tracking. Real-time messaging latency monitoring. Image loading optimization verification. Bundle size limits enforced. Core Web Vitals targets met.

### Error Handling Standards
All components wrapped in ErrorBoundary. Graceful fallbacks for all error states. User-friendly error messages. Comprehensive logging for debugging. Toast notifications for user feedback.

## Governance

Constitution supersedes all other development practices. All pull requests must demonstrate constitutional compliance. Complexity that violates principles requires explicit justification and approval. Architecture decisions documented and reviewed against constitutional principles.

Version control follows semantic versioning. Breaking changes require major version increment. All team members responsible for constitutional adherence. Regular constitutional review and updates as project evolves.

**Version**: 1.0.0 | **Ratified**: 2025-09-24 | **Last Amended**: 2025-09-24