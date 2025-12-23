# Feature Specification: In-Game Name Management

**Feature Branch**: `001-ign-management`  
**Created**: 2025-12-23  
**Status**: Draft  
**Input**: User description: "Add in-game name/nickname functionality to Discord Event Check-In Bot"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set In-Game Name (Priority: P1)

A Discord server member wants to set their in-game name so it appears when they check into events instead of their Discord username.

**Why this priority**: This is the core functionality that enables all other features. Without the ability to set an IGN, the feature has no value.

**Independent Test**: Can be fully tested by executing the set-IGN command and verifying the name is saved. Delivers immediate value by allowing users to associate their gaming identity with their Discord account.

**Acceptance Scenarios**:

1. **Given** a user has not set an IGN before, **When** they use the set-IGN command with a valid name, **Then** the system saves their IGN and confirms it was set successfully
2. **Given** a user has previously set an IGN, **When** they use the set-IGN command with a new name, **Then** the system updates their IGN and confirms the update
3. **Given** a user provides an IGN, **When** the name is saved, **Then** it is associated with both their Discord user ID and the specific server (guild)
4. **Given** a user wants to change their IGN, **When** they use /set-ign with a new name, **Then** the system updates their existing IGN without requiring /remove-ign first

---

### User Story 2 - Check-In with IGN (Priority: P1)

When a member checks into an event, the system displays their in-game name. Users must have an IGN set before they can check in.

**Why this priority**: This is the primary use case and reason for the feature. IGN is now mandatory for all check-ins to ensure consistent gaming identity tracking.

**Independent Test**: Can be fully tested by having users with IGNs check into an event and verifying the IGN appears in announcements and database records. Delivers value by showing recognizable gaming identities during events.

**Acceptance Scenarios**:

1. **Given** a user has set an IGN, **When** they check into an event, **Then** their IGN is displayed in the check-in announcement
2. **Given** a user has NOT set an IGN, **When** they attempt to check in, **Then** the system prevents the check-in and displays: 'You must set your in-game name first. Use /set-ign to set your IGN before checking in.'
3. **Given** a user checks into an event, **When** the check-in is recorded, **Then** their IGN is stored in the database alongside their Discord user ID

---

### User Story 3 - View Current IGN (Priority: P2)

A user wants to check what their current in-game name is set to in the server.

**Why this priority**: This is a helpful utility feature but not critical for core functionality. Users can function without it by simply setting their IGN again.

**Independent Test**: Can be fully tested by executing the view-IGN command and verifying it displays the correct stored name or a message indicating no IGN is set.

**Acceptance Scenarios**:

1. **Given** a user has set an IGN, **When** they use the view-IGN command, **Then** the system displays their current IGN
2. **Given** a user has not set an IGN, **When** they use the view-IGN command, **Then** the system informs them that no IGN is currently set
3. **Given** a user is in a specific server, **When** they view their IGN, **Then** they see the IGN specific to that server, not IGNs from other servers

---

### User Story 4 - Remove IGN (Priority: P4)

A user wants to remove their in-game name completely.

**Why this priority**: This is now a low-priority feature since users can simply use /set-ign to update their IGN. The remove command is only needed if users want to completely unset their IGN, which is rarely needed given IGN is now mandatory for check-ins.

**Independent Test**: Can be fully tested by executing the remove-IGN command and verifying subsequent check-ins use the Discord username.

**Acceptance Scenarios**:

1. **Given** a user has set an IGN, **When** they use the remove-IGN command, **Then** the system deletes their IGN and confirms removal
2. **Given** a user has removed their IGN, **When** they attempt to check into an event, **Then** they are prevented from checking in until they set a new IGN
3. **Given** a user has not set an IGN, **When** they attempt to remove their IGN, **Then** the system informs them that no IGN is currently set

---

### Edge Cases

- **RESOLVED**: When a user attempts to set an IGN with invalid characters (emojis, special symbols beyond hyphens/underscores/periods, control characters), the system rejects it with a clear error message explaining allowed characters
- **RESOLVED**: When a user attempts to set an IGN exceeding 32 characters, the system rejects it with a detailed error message showing character count (e.g., "IGN too long: 45/32 characters")
- **RESOLVED**: When two different users in the same server attempt to set the same IGN, the second user receives an error message stating the IGN is already taken
- How does the system handle users who are in multiple servers with different IGNs per server?
- What happens if a user sets their IGN in one server but checks into an event in a different server where they haven't set an IGN?
- ~~How does the system handle database unavailability when retrieving IGN during check-in?~~ **RESOLVED**: Check-in fails with user-visible error; no fallback to Discord username
- What happens if a user sets an IGN with leading/trailing whitespace?
- What happens if database query to retrieve IGN fails during check-in validation?

## Clarifications

### Session 2025-12-23

- Q: How should IGN data be stored in the database schema? → A: Dedicated `user_igns` table with (user_id, guild_id) composite key
- Q: When database is unavailable and IGN retrieval fails during check-in, should the check-in proceed using Discord username as fallback or fail completely? → A: Check-in fails with user-visible error message
- Q: What character types should be allowed in IGN validation? → A: Allow alphanumeric, spaces, and common symbols (hyphens, underscores, periods) while blocking emojis and control characters
- Q: How should the system handle IGNs that exceed the 32-character limit? → A: Reject with detailed error showing character count (e.g., "IGN too long: 45/32 characters")
- Q: What happens if two different users in the same server try to set the same IGN? → A: Reject duplicate IGNs and enforce uniqueness per server with clear error message

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a slash command for users to set their in-game name within a server
- **FR-002**: System MUST store in-game names in a way that associates them with both the user's Discord ID and the specific server (guild ID)
- **FR-003**: System MUST allow users to update their in-game name at any time by using /set-ign command again with a new name (UPSERT behavior - no need to remove first)
- **FR-004**: System MUST retrieve and use the stored in-game name during event check-ins
- **FR-005**: System MUST prevent users from checking in if they have not set an in-game name, and display a helpful error message directing them to use /set-ign first
- **FR-006**: System MUST provide a slash command for users to view their current in-game name
- **FR-007**: System MUST provide a slash command for users to remove their in-game name
- **FR-008**: System MUST validate that in-game names do not exceed a reasonable character limit (32 characters), rejecting with detailed error message showing actual vs. maximum character count (e.g., "IGN too long: 45/32 characters")
- **FR-008a**: System MUST validate that in-game names contain only alphanumeric characters (a-z, A-Z, 0-9), spaces, hyphens, underscores, and periods, rejecting emojis and control characters
- **FR-009**: System MUST trim leading and trailing whitespace from in-game names before storing
- **FR-010**: System MUST store the in-game name in the check-ins database record for historical tracking and event exports
- **FR-011**: System MUST maintain backward compatibility with existing check-in records that only have Discord usernames
- **FR-012**: System MUST handle database errors gracefully when storing in-game names
- **FR-013**: System MUST fail check-in operations with a user-visible error message when the database is unavailable and IGN retrieval cannot be completed
- **FR-028**: System MUST validate that a user has an IGN set before allowing check-in operations
- **FR-029**: System MUST provide a clear error message when a user without an IGN attempts to check in, instructing them to set their IGN using /set-ign command first

### Data Model

**`user_igns` table**:
- Primary key: composite of (`user_id`, `guild_id`)
- Attributes:
  - `user_id` (TEXT, part of PK): Discord user ID
  - `guild_id` (TEXT, part of PK): Server/guild ID
  - `ign` (TEXT, NOT NULL): The in-game name (max 32 characters)
  - `updated_at` (TIMESTAMP): Last update timestamp

**`check-ins` table extension**:
- Add `ign` (TEXT, NOT NULL): The in-game name used at check-in time (required)
- Preserves historical accuracy even if user changes IGN later

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can set their in-game name in under 30 seconds using a single command
- **SC-002**: When a user with an IGN checks into an event, their IGN is displayed in the check-in announcement 100% of the time
- **SC-003**: Users without an IGN are prevented from checking in with a clear, actionable error message
- **SC-004**: The system handles IGN storage and retrieval for at least 1000 unique users per server without performance degradation
- **SC-005**: Event exports include the in-game name for all check-ins, maintaining data consistency
- **SC-006**: 95% of users successfully set their IGN on the first attempt without encountering errors

## Assumptions

- IGN character limit of 32 characters is sufficient for most gaming names (industry standard)
- Users want server-specific IGNs rather than a global IGN across all servers
- Existing check-in records do not need to be retroactively updated with IGNs
- No moderation or filtering of IGN content is required (server administrators handle community standards)
- Users can change their IGN as frequently as they want without restrictions or cooldowns
- The database can handle an additional table or columns without infrastructure changes

## Dependencies

- Access to modify the existing Supabase database schema
- Ability to create new slash commands in the Discord bot's command registration
- Existing check-in flow must remain functional during and after implementation
- Database must support atomic operations for IGN updates to prevent race conditions

## Out of Scope

- Cross-server IGN synchronization or global IGN profiles
- IGN verification or validation against actual game accounts
- Moderation tools for inappropriate IGN content
- Bulk import/export of IGN data
- Admin commands to view or modify other users' IGNs
- IGN change history or audit logs
- Integration with external gaming platforms or APIs
- Automatic IGN detection from linked game accounts
