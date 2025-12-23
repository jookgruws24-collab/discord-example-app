# Implementation Plan: In-Game Name Management

**Branch**: `001-ign-management` | **Date**: 2025-12-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ign-management/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add in-game name (IGN) management to Discord Event Check-In Bot. Users must set a server-specific IGN before checking into events. IGN is now MANDATORY - check-ins without IGN are blocked with a helpful error message. The feature includes commands to set, view, and remove IGNs, with UPSERT behavior for updates (no need to remove before updating). All backward compatibility with username fallback has been removed. Check-in records store the IGN at time of check-in for historical accuracy.

## Technical Context

**Language/Version**: Node.js 18+ with ES modules  
**Primary Dependencies**: discord.js v14, @supabase/supabase-js v2, express v4  
**Storage**: Supabase (PostgreSQL) - existing database connection configured  
**Testing**: Manual testing via Discord slash commands (no test framework currently in project)  
**Target Platform**: Long-lived Node.js server process  
**Project Type**: Single project - Discord bot application  
**Performance Goals**: Command responses <3 seconds per Constitution principle IV  
**Constraints**: Discord API rate limits, 32 character IGN limit, server-specific IGN isolation  
**Scale/Scope**: 3 new slash commands, 2 new database tables (user_igns, checkins extension), ~500 LOC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Event-Driven Architecture
**Status**: ✅ PASS  
**Analysis**: IGN management is triggered by user slash commands (/set-ign, /view-ign, /remove-ign). Check-in validation triggers IGN lookup before allowing event participation. No violations of event isolation or time-tracking principles.

### Principle II: Data Integrity & Tracking
**Status**: ✅ PASS  
**Analysis**: IGN records capture Discord user ID, guild ID, IGN value, and updated_at timestamp. Check-in records store IGN at time of check-in (immutable historical record). Aligns with immutability and precise timestamping requirements.

### Principle III: Time-Based Automation
**Status**: ✅ PASS (Not Applicable)  
**Analysis**: IGN management does not involve time-based automation or scheduled tasks. No impact on auto-close functionality or event lifecycle.

### Principle IV: Discord API Best Practices
**Status**: ✅ PASS  
**Analysis**: Slash commands use existing interaction patterns. No new permission requirements beyond existing bot setup. Error handling follows established patterns with user-friendly messages.

### Principle V: Observability & Debugging
**Status**: ✅ PASS  
**Analysis**: All state transitions (set IGN, check-in validation) will emit structured logs with timestamps, user IDs, and context. Database errors will log full context. Follows existing logging patterns in codebase.

### Technical Constraints Check
**Status**: ✅ PASS  
**Analysis**: 
- Uses existing Node.js + discord.js + Supabase stack
- Persistent storage via Supabase (atomic UPSERT operations supported)
- Command responses <3 seconds achievable (simple DB queries)
- No changes to deployment model (long-lived process)

### Conclusion
**GATE RESULT**: ✅ APPROVED - No constitutional violations. Feature aligns with all core principles and technical constraints.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── commands/
│   ├── createEvent.js
│   ├── closeEvent.js
│   ├── exportEvent.js
│   ├── setIgn.js           # NEW: Set/update IGN command
│   ├── viewIgn.js          # NEW: View current IGN command
│   └── removeIgn.js        # NEW: Remove IGN command
├── services/
│   ├── checkinService.js   # MODIFIED: Add IGN validation before check-in
│   ├── checkoutService.js
│   ├── eventService.js
│   ├── exportService.js    # MODIFIED: Include IGN in exports
│   └── ignService.js       # NEW: IGN CRUD operations
├── database/
│   └── supabase.js
├── handlers/
│   ├── buttonHandler.js    # MODIFIED: Handle IGN errors in check-in flow
│   └── eventScheduler.js
└── config/
    └── permissions.js

commands.js                  # MODIFIED: Register 3 new slash commands
app.js                       # MODIFIED: Route new slash commands

tests/
└── manual/
    └── ign-checkin-flow.md  # NEW: Manual test scenarios
```

**Structure Decision**: Single project structure maintained. Feature adds 3 new command files, 1 new service file, and modifies 4 existing files. Follows existing patterns for command registration and service layer separation.

## Complexity Tracking

> **No violations - this section left empty per instructions**
