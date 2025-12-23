# Tasks: In-Game Name Management

**Feature**: IGN Management for Discord Event Check-In Bot  
**Branch**: `001-ign-management`  
**Input**: Design documents from `/specs/001-ign-management/`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3) - only for user story phases
- Include exact file paths in descriptions

## Path Conventions

Single project structure:
- Commands: `src/commands/`
- Services: `src/services/`
- Database: `src/database/`
- Handlers: `src/handlers/`

---

## Phase 1: Setup (Database Schema)

**Purpose**: Database schema setup for IGN management tables

- [X] T001 Create database migration script for user_igns table in src/database/migrations/001_create_user_igns.sql
- [X] T002 Create database migration script to add ign column to checkins table in src/database/migrations/002_add_ign_to_checkins.sql
- [X] T003 Run migrations to create user_igns table and extend checkins table

---

## Phase 2: Foundational (IGN Service Layer)

**Purpose**: Core IGN service that ALL user stories depend on

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

- [X] T004 Create ignService.js with validateIgn() function in src/services/ignService.js
- [X] T005 Implement setIgn() function with UPSERT logic and error handling in src/services/ignService.js
- [X] T006 Implement getIgn() function with database query in src/services/ignService.js
- [X] T007 Implement removeIgn() function with DELETE query in src/services/ignService.js

**Checkpoint**: IGN service ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Set In-Game Name (Priority: P1) 🎯 MVP

**Goal**: Users can set or update their server-specific IGN with validation and duplicate checking

**Independent Test**: Execute /set-ign command with valid name, verify IGN is saved in database and confirmation displayed

### Implementation for User Story 1

- [X] T008 [US1] Create setIgn.js command handler with interaction parsing in src/commands/setIgn.js
- [X] T009 [US1] Implement command logic calling ignService.setIgn() with validation in src/commands/setIgn.js
- [X] T010 [US1] Add error response handling for validation, duplicate, and database errors in src/commands/setIgn.js
- [X] T011 [US1] Register /set-ign slash command in Discord API via commands.js
- [X] T012 [US1] Add command routing for /set-ign in app.js to call handleSetIgnCommand

**Checkpoint**: User Story 1 is fully functional - users can set/update IGN with proper validation

---

## Phase 4: User Story 2 - Check-In with IGN (Priority: P1) 🎯 MVP

**Goal**: IGN validation before check-ins and display IGN in announcements (MANDATORY - blocking without IGN)

**Independent Test**: User with IGN checks into event and IGN appears in announcement; user without IGN is blocked with error message

### Implementation for User Story 2

- [X] T013 [US2] Modify createCheckIn() to query user_igns before allowing check-in in src/services/checkinService.js
- [X] T014 [US2] Add IGN validation logic that prevents check-in if IGN not found with error message in src/services/checkinService.js
- [X] T015 [US2] Update check-in INSERT to include ign field from query result in src/services/checkinService.js
- [X] T016 [US2] Return displayName (IGN) from createCheckIn() for announcement in src/services/checkinService.js
- [X] T017 [US2] Update postCheckInAnnouncement() to use displayName parameter in src/services/checkinService.js
- [X] T018 [US2] Update button handler to pass displayName to announcement function in src/handlers/buttonHandler.js
- [X] T019 [US2] Add error handling in button handler for no_ign error with user guidance in src/handlers/buttonHandler.js

**Checkpoint**: User Story 2 is fully functional - check-ins require IGN and display IGN in announcements

---

## Phase 5: User Story 3 - View Current IGN (Priority: P2)

**Goal**: Users can view their current IGN for the server

**Independent Test**: Execute /view-ign command, verify correct IGN displayed or "not set" message if no IGN

### Implementation for User Story 3

- [X] T020 [US3] Create viewIgn.js command handler with interaction parsing in src/commands/viewIgn.js
- [X] T021 [US3] Implement command logic calling ignService.getIgn() in src/commands/viewIgn.js
- [X] T022 [US3] Add response handling for success (display IGN) and not_found (helpful message) in src/commands/viewIgn.js
- [X] T023 [US3] Register /view-ign slash command in Discord API via commands.js
- [X] T024 [US3] Add command routing for /view-ign in app.js to call handleViewIgnCommand

**Checkpoint**: User Story 3 is fully functional - users can view their current IGN

---

## Phase 6: User Story 4 - Remove IGN (Priority: P4)

**Goal**: Users can remove their IGN completely (low priority since UPSERT allows direct updates)

**Independent Test**: Execute /remove-ign command, verify IGN deleted from database and user cannot check in without setting new IGN

### Implementation for User Story 4

- [X] T025 [US4] Create removeIgn.js command handler with interaction parsing in src/commands/removeIgn.js
- [X] T026 [US4] Implement command logic calling ignService.removeIgn() in src/commands/removeIgn.js
- [X] T027 [US4] Add response handling for success and not_found cases in src/commands/removeIgn.js
- [X] T028 [US4] Register /remove-ign slash command in Discord API via commands.js
- [X] T029 [US4] Add command routing for /remove-ign in app.js to call handleRemoveIgnCommand

**Checkpoint**: User Story 4 is fully functional - users can remove their IGN

---

## Phase 7: Export Enhancement

**Purpose**: Include IGN in event CSV exports with backward compatibility

- [X] T030 Update generateCsv() to query ign field from checkins table in src/services/exportService.js
- [X] T031 Add IGN column to CSV header and data rows in src/services/exportService.js
- [X] T032 Handle NULL IGN values for backward compatibility with empty string in src/services/exportService.js
- [X] T033 Add CSV escaping for IGN values containing commas or quotes in src/services/exportService.js

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and final testing

- [X] T034 [P] Create manual test scenarios document in tests/manual/ign-checkin-flow.md
- [X] T035 [P] Add structured logging with context for all IGN operations
- [X] T036 Test complete check-in flow with IGN validation and announcements
- [X] T037 Test IGN uniqueness enforcement across multiple users
- [X] T038 Test backward compatibility with existing check-in records
- [X] T039 Test CSV export with mixed IGN and non-IGN check-ins
- [X] T040 Verify all error messages match contracts and are user-friendly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - can start after Phase 2
- **User Story 2 (Phase 4)**: Depends on Foundational - can start after Phase 2 (independent of US1)
- **User Story 3 (Phase 5)**: Depends on Foundational - can start after Phase 2 (independent of US1, US2)
- **User Story 4 (Phase 6)**: Depends on Foundational - can start after Phase 2 (independent of other stories)
- **Export (Phase 7)**: Depends on User Story 2 (check-ins must include IGN field)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - can start after Foundational (Phase 2)
- **User Story 2 (P1)**: Independent - can start after Foundational (Phase 2)
- **User Story 3 (P2)**: Independent - can start after Foundational (Phase 2)
- **User Story 4 (P4)**: Independent - can start after Foundational (Phase 2)

All user stories are independently testable and can be completed in parallel by different developers.

### Within Each User Story

- Command handler before command registration
- Command registration before routing in app.js
- Service calls before response handling
- Error handling as final step in each command

### Parallel Opportunities

- Phase 1: All migration tasks can run sequentially (database operations)
- Phase 2: All service functions can be implemented in parallel (T004-T007 are independent functions)
- User Stories: After Phase 2, all user story phases (3-6) can run in parallel
- Phase 8: Manual test document (T034) and logging (T035) can run in parallel

---

## Parallel Example: After Foundational Phase

```bash
# Multiple developers can work simultaneously:
Developer A: User Story 1 (T008-T012) - /set-ign command
Developer B: User Story 2 (T013-T019) - Check-in integration
Developer C: User Story 3 (T020-T024) - /view-ign command
Developer D: User Story 4 (T025-T029) - /remove-ign command
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (database schema)
2. Complete Phase 2: Foundational (IGN service - CRITICAL)
3. Complete Phase 3: User Story 1 (/set-ign command)
4. Complete Phase 4: User Story 2 (check-in with IGN - mandatory)
5. **STOP and VALIDATE**: Test complete flow: set IGN → check in → see IGN in announcement
6. Deploy/demo MVP

**MVP Scope**: Users can set IGN and must use it for check-ins (core functionality)

### Incremental Delivery

1. MVP (US1 + US2) → Test → Deploy
2. Add User Story 3 (/view-ign) → Test → Deploy
3. Add User Story 4 (/remove-ign) → Test → Deploy
4. Add Export Enhancement (Phase 7) → Test → Deploy
5. Polish & Testing (Phase 8) → Final validation

### Parallel Team Strategy

With 2-3 developers:

1. All: Complete Setup + Foundational together (critical path)
2. Once Foundational is done:
   - Developer 1: User Story 1 (/set-ign)
   - Developer 2: User Story 2 (check-in integration)
   - Developer 3: User Story 3 (/view-ign) or User Story 4 (/remove-ign)
3. Merge and validate stories independently
4. Complete Export Enhancement
5. Final polish together

---

## Task Summary

**Total Tasks**: 40
- Phase 1 (Setup): 3 tasks
- Phase 2 (Foundational): 4 tasks
- Phase 3 (US1 - Set IGN): 5 tasks
- Phase 4 (US2 - Check-in): 7 tasks
- Phase 5 (US3 - View IGN): 5 tasks
- Phase 6 (US4 - Remove IGN): 5 tasks
- Phase 7 (Export): 4 tasks
- Phase 8 (Polish): 7 tasks

**Parallel Opportunities**: 2 tasks can run in parallel (Phase 2: service functions, Phase 8: documentation + logging)

**Independent Test Criteria**:
- US1: Can set/update IGN with validation
- US2: Check-ins require IGN and display it
- US3: Can view current IGN or get "not set" message
- US4: Can remove IGN and must set new one before checking in

**MVP Scope**: User Stories 1 + 2 (set IGN + mandatory check-in with IGN)

---

## Format Validation

✅ All tasks follow checklist format: `- [ ] [ID] [P?] [Story?] Description`
✅ All task IDs sequential (T001-T040)
✅ All user story tasks labeled ([US1], [US2], [US3], [US4])
✅ Setup and Foundational phases have NO story labels
✅ All parallelizable tasks marked with [P]
✅ All task descriptions include specific file paths
✅ Each user story phase has independent test criteria
✅ Dependencies clearly documented
✅ MVP scope identified (US1 + US2)
