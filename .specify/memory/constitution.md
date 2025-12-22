<!--
SYNC IMPACT REPORT - Constitution Version 1.0.0
===============================================
Version Change: INITIAL → 1.0.0 (Initial ratification)

Established Principles:
- I. Event-Driven Architecture (NEW)
- II. Data Integrity & Tracking (NEW)
- III. Time-Based Automation (NEW)
- IV. Discord API Best Practices (NEW)
- V. Observability & Debugging (NEW)

Added Sections:
- Core Principles (5 principles)
- Technical Constraints
- Development Standards
- Governance

Templates Status:
- ✅ plan-template.md (reviewed - Constitution Check section compatible)
- ✅ spec-template.md (reviewed - requirements structure compatible)
- ✅ tasks-template.md (reviewed - phase structure compatible)

Follow-up Items: None - all placeholders filled

Commit Message: docs: ratify Discord Check-In/Check-Out App constitution v1.0.0
-->

# Discord Check-In/Check-Out App Constitution

## Core Principles

### I. Event-Driven Architecture
All check-in/check-out operations MUST be triggered by user interactions or time-based events. Each event check-in MUST create an isolated text channel. Events MUST track their start time independently from channel creation time to enable accurate auto-close scheduling.

**Rationale**: Event isolation prevents cross-contamination of user data. Independent start time tracking ensures the 15-minute auto-close timer is based on event semantics, not implementation details. 

### II. Data Integrity & Tracking
Every user interaction MUST capture Discord user information (user ID, username, discriminator) and precise timestamps (ISO 8601 format with timezone). Check-in and check-out records MUST be immutable once created. All data MUST persist reliably to prevent loss during bot restarts or crashes.

**Rationale**: User accountability and audit trails require immutable, timestamped records. Discord user IDs ensure accurate tracking even when usernames change.

### III. Time-Based Automation
Auto-close functionality MUST trigger exactly 15 minutes after the event start time, not channel creation time. Admin manual close MUST override auto-close timers. All scheduled tasks MUST be resilient to bot restarts and recoverable from persistent storage.

**Rationale**: Predictable event lifecycles based on domain time (event start) rather than technical time (channel creation) provide better user experience. Persistence ensures reliability.

### IV. Discord API Best Practices
All Discord API interactions MUST handle rate limits gracefully with exponential backoff. Channel creation, permission management, and message operations MUST validate responses and handle failures. Bot MUST request only minimum required permissions (Manage Channels, Send Messages, Read Message History).

**Rationale**: Discord API reliability requires defensive programming. Minimal permissions reduce security risk and simplify bot approval process.

### V. Observability & Debugging
All state transitions (check-in, check-out, event start, auto-close, manual close) MUST emit structured logs with timestamps, user IDs, and event context. Errors MUST log full context including Discord API responses. Logs MUST be queryable by event ID, user ID, and timestamp range.

**Rationale**: Structured logging enables debugging production issues, auditing user actions, and monitoring system health without code changes.

## Technical Constraints

**Technology Stack**: Node.js (>=18.x) with discord.js library for Discord Bot API integration. Express.js for interaction endpoints (if webhook-based). Environment variables for configuration (.env file, never commit secrets).

**Data Storage**: Persistent storage required (file-based JSON, SQLite, or external database). MUST survive bot restarts. MUST support atomic writes to prevent corruption during concurrent operations.

**Performance Standards**: Check-in/check-out operations MUST respond within 3 seconds. Channel creation MUST complete within 5 seconds. Auto-close timer precision within ±30 seconds acceptable.

**Deployment**: Bot MUST run as long-lived process (not serverless). MUST support graceful shutdown (cleanup pending timers, close connections). MUST restart automatically on crashes.

## Development Standards

**Error Handling**: All Discord API calls MUST be wrapped in try-catch blocks. User-facing errors MUST provide actionable messages. Internal errors MUST log full stack traces without exposing to users.

**Code Organization**: Separate concerns: Discord interaction handling, business logic (event management, user tracking), data persistence, scheduled tasks. Each module MUST be independently testable.

**Testing Requirements**: Critical paths (check-in, check-out, auto-close trigger, manual close) MUST have integration tests. Discord API interactions MUST be mockable. Edge cases (concurrent check-ins, restart during auto-close) MUST be tested.

**Documentation**: All slash commands MUST have clear descriptions and parameter help text. README MUST include setup instructions (Discord app creation, environment variables, permissions). Data schemas MUST be documented (event structure, user record format).

## Governance

This constitution supersedes all ad-hoc decisions. All feature changes MUST align with core principles or propose amendments with rationale. Complexity not justified by principles MUST be rejected in favor of simpler alternatives.

**Amendment Process**: Proposed amendments MUST document: (1) principle/section being changed, (2) justification with concrete examples, (3) impact on existing features, (4) migration plan if breaking changes required. Amendments MUST increment version (MAJOR for principle removal/redefinition, MINOR for new principles, PATCH for clarifications).

**Compliance Review**: All pull requests MUST verify adherence to principles. Code reviews MUST check: data persistence implementation, timestamp handling, error handling coverage, structured logging presence. Violations require justification or rework.

**Development Guidance**: Use this constitution to evaluate design decisions. When uncertain, prefer solutions that maximize observability, data integrity, and user clarity over implementation convenience.

**Version**: 1.0.0 | **Ratified**: 2025-12-22 | **Last Amended**: 2025-12-22
