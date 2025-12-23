# Data Model: In-Game Name Management

**Feature**: IGN Management for Discord Event Check-In Bot  
**Date**: 2025-12-23  
**Version**: 1.0

## Overview

This document defines the data entities, relationships, validation rules, and state transitions for the In-Game Name (IGN) management feature. The data model introduces one new table (`user_igns`) and extends an existing table (`checkins`) to support server-specific gaming identities.

---

## Entities

### Entity 1: UserIgn (NEW)

**Table Name**: `user_igns`

**Purpose**: Store user in-game names with per-server scoping. Each user can have at most one IGN per Discord server (guild).

**Lifecycle**:
- **Created**: When user executes `/set-ign` command for the first time in a server
- **Updated**: When user executes `/set-ign` again with a different name
- **Deleted**: When user executes `/remove-ign` command

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `user_id` | TEXT | NOT NULL, PK (part 1) | Discord user ID (snowflake as string, e.g., "123456789012345678") |
| `guild_id` | TEXT | NOT NULL, PK (part 2) | Discord guild/server ID (snowflake as string) |
| `ign` | TEXT | NOT NULL, CHECK length, CHECK pattern | In-game name (1-32 characters, alphanumeric + spaces + ._-) |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp (automatically set on INSERT/UPDATE) |

**Constraints**:

1. **Primary Key**: `(user_id, guild_id)`
   - Ensures one IGN per user per server
   - Automatically indexed for efficient lookups

2. **Unique Constraint**: `UNIQUE (LOWER(ign), guild_id)`
   - Case-insensitive uniqueness within a server
   - Prevents "Player" and "player" in the same server
   - Implemented via unique index

3. **Check Constraint**: `LENGTH(ign) BETWEEN 1 AND 32`
   - Enforces 32-character limit at database level
   - Prevents empty strings

4. **Check Constraint**: `ign ~ '^[a-zA-Z0-9\s._-]+$'`
   - PostgreSQL regex pattern for character validation
   - Allows: letters (a-z, A-Z), numbers (0-9), spaces, periods, underscores, hyphens
   - Blocks: emoji, control characters, special symbols

**Indexes**:

```sql
-- Primary key index (automatic)
PRIMARY KEY (user_id, guild_id)

-- Case-insensitive uniqueness index
CREATE UNIQUE INDEX idx_user_igns_ign_guild 
ON user_igns (LOWER(ign), guild_id);

-- Optional: Performance optimization for lookups
CREATE INDEX idx_user_igns_lookup 
ON user_igns (user_id, guild_id);
```

**Example Records**:

```sql
-- User "123" has different IGNs in different servers
INSERT INTO user_igns VALUES 
  ('123456789012345678', '111111111111111111', 'ProGamer', '2025-12-23 10:00:00'),
  ('123456789012345678', '222222222222222222', 'CasualPlayer', '2025-12-23 11:00:00');

-- Multiple users in same server with different IGNs
INSERT INTO user_igns VALUES 
  ('123456789012345678', '111111111111111111', 'ProGamer', '2025-12-23 10:00:00'),
  ('987654321098765432', '111111111111111111', 'Dark_Knight', '2025-12-23 10:30:00');
```

**Validation Rules**:

| Rule | Enforced By | Error Message |
|------|-------------|---------------|
| Length 1-32 chars | CHECK constraint | "IGN too long: {actual}/32 characters" |
| Allowed characters only | CHECK constraint | "IGN contains invalid characters. Allowed: letters, numbers, spaces, and ._- symbols" |
| No leading/trailing whitespace | Application (before INSERT) | "IGN cannot be empty or only whitespace" |
| Unique per server (case-insensitive) | UNIQUE index | "The IGN '{ign}' is already taken in this server" |

---

### Entity 2: CheckIn (EXTENDED)

**Table Name**: `checkins`

**Purpose**: Record user check-ins to events. **Extended** to include IGN snapshot at check-in time.

**Existing Fields** (unchanged):
- `checkin_id` (UUID, PK)
- `event_id` (UUID, FK to events)
- `user_id` (TEXT, Discord user ID)
- `username` (TEXT, Discord username)
- `discriminator` (TEXT, Discord discriminator)
- `timestamp` (TIMESTAMP, check-in time)

**New Field**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `ign` | TEXT | NOT NULL for new records* | Snapshot of user's IGN at check-in time (required for all new check-ins) |

*Note: For backward compatibility with pre-existing records, the database column is NULLABLE. However, application logic enforces IGN requirement (FR-005, FR-028, FR-029) - all new check-ins after deployment must have IGN set.

**Rationale for Extension**:

1. **Historical Accuracy**: Preserves the IGN as it was during the event, even if the user changes their IGN later
2. **Export Integrity**: CSV exports show the correct IGN that was displayed during the event
3. **Backward Compatibility**: Column is NULLABLE in database to support existing pre-IGN records, but application enforces requirement for new check-ins
4. **Query Performance**: No JOIN required at export time (IGN already in checkins table)

**Migration**:

```sql
-- Add ign column to existing checkins table
ALTER TABLE checkins 
ADD COLUMN ign TEXT NULL;

-- Optional: Add index for export queries that filter by IGN
CREATE INDEX idx_checkins_ign 
ON checkins (event_id, ign) 
WHERE ign IS NOT NULL;
```

**Example Records**:

```sql
-- Old record (before IGN feature) - ign is NULL (backward compatibility)
INSERT INTO checkins (checkin_id, event_id, user_id, username, discriminator, ign, timestamp)
VALUES ('a1b2c3...', 'event-123', '123456...', 'JohnDoe', '1234', NULL, '2025-12-20 14:00:00');

-- New record with IGN (after deployment - IGN required)
INSERT INTO checkins (checkin_id, event_id, user_id, username, discriminator, ign, timestamp)
VALUES ('d4e5f6...', 'event-456', '123456...', 'JohnDoe', '1234', 'ProGamer', '2025-12-23 15:00:00');

-- User without IGN cannot check in (application prevents this)
-- This INSERT would not be attempted - user gets error before reaching database
```

**Backward Compatibility**:

- Existing queries: `SELECT * FROM checkins WHERE event_id = ?` → Works unchanged (ign column appears as NULL for old records)
- Export queries: `SELECT username, ign, timestamp FROM checkins` → Works, ign is empty string for old records
- Analytics: Can distinguish pre-IGN vs post-IGN records with `WHERE ign IS NOT NULL`
- New check-ins: All require IGN set (enforced by application logic before INSERT)

---

## Relationships

### UserIgn ↔ CheckIn (Logical, No FK)

**Type**: Logical relationship (not enforced by foreign key)

**Reason**: Discord `user_id` is an external identifier (Discord API), not a table in our database. No user table exists to reference.

**Relationship**:
- One UserIgn can correspond to many CheckIns (user checks in to multiple events)
- CheckIn.ign is a **snapshot** of UserIgn.ign at check-in time
- CheckIn requires UserIgn to exist (enforced by application logic - FR-005, FR-028, FR-029)
- If user updates UserIgn.ign after check-in, CheckIn.ign remains unchanged (historical accuracy)

**Query Pattern**:

```sql
-- During check-in: First verify IGN exists for current user
SELECT ign FROM user_igns 
WHERE user_id = '123456789012345678' 
  AND guild_id = '111111111111111111';

-- If IGN not found: Return error to user (FR-028, FR-029)
-- "You must set your in-game name first. Use /set-ign to set your IGN before checking in."

-- If IGN found: Insert check-in with IGN snapshot
INSERT INTO checkins (event_id, user_id, username, discriminator, ign, timestamp)
VALUES ('event-123', '123456789012345678', 'JohnDoe', '1234', 'ProGamer', NOW());

-- Export: No JOIN needed (IGN already in checkins)
SELECT username, ign, timestamp FROM checkins WHERE event_id = 'event-123';
```

---

## State Transitions

### UserIgn Lifecycle

```
[Does Not Exist]
      |
      | /set-ign (first time)
      v
  [IGN Set] ─────────────────┐
      |                      |
      | /set-ign (update)    |
      v                      |
  [IGN Updated] ─────────────┘
      |
      | /remove-ign
      v
[Does Not Exist]
```

**State Definitions**:

1. **Does Not Exist**: No row in `user_igns` for (user_id, guild_id)
   - User has never set IGN in this server
   - `/view-ign` returns "not set" message
   - Check-in is **prevented** with error message (FR-005, FR-028, FR-029)

2. **IGN Set**: Row exists in `user_igns`
   - User has active IGN in this server
   - `/view-ign` displays the IGN
   - Check-in uses IGN instead of username

3. **IGN Updated**: Same state as "IGN Set", but `updated_at` timestamp changes
   - User changed their IGN
   - Old check-ins retain old IGN (historical accuracy)
   - New check-ins use new IGN

**Transition Actions**:

| From State | Command | To State | Database Operation |
|------------|---------|----------|-------------------|
| Does Not Exist | `/set-ign` | IGN Set | INSERT INTO user_igns |
| IGN Set | `/set-ign` | IGN Updated | UPDATE user_igns SET ign = ?, updated_at = NOW() |
| IGN Set | `/remove-ign` | Does Not Exist | DELETE FROM user_igns |
| IGN Updated | `/set-ign` | IGN Updated | UPDATE user_igns SET ign = ?, updated_at = NOW() |
| IGN Updated | `/remove-ign` | Does Not Exist | DELETE FROM user_igns |
| Does Not Exist | `/remove-ign` | Does Not Exist | No-op (return "not set" message) |

### Check-In with IGN Flow

```
[User Clicks Check-In Button]
        |
        v
[Query user_igns for (user_id, guild_id)]
        |
        ├─── IGN Found ─────> [Use IGN as displayName]
        |                            |
        |                            v
        |               [Insert checkin with ign field]
        |                            |
        |                            v
        |               [Post announcement: "{displayName} checked in"]
        |
        └─── IGN Not Found ──> [Return error to user (FR-028, FR-029)]
                                     |
                                     v
                    ["You must set your in-game name first. Use /set-ign..."]
```

**State Considerations**:

- **IGN Found**: `user_igns` query returns a row → CheckIn.ign = UserIgn.ign
- **IGN Not Found**: `user_igns` query returns no rows → Check-in prevented, error returned (FR-005, FR-028, FR-029)
- **Database Error**: IGN query fails → Check-in prevented, error returned (maintain data integrity)

---

## Validation Rules

### IGN Validation (Application Layer)

**Rule 1: Character Whitelist**

```javascript
const VALID_IGN_PATTERN = /^[a-zA-Z0-9\s._-]+$/;

function validateCharacters(ign) {
  if (!VALID_IGN_PATTERN.test(ign)) {
    return {
      valid: false,
      error: 'IGN contains invalid characters. Allowed: letters, numbers, spaces, and ._- symbols'
    };
  }
  return { valid: true };
}
```

**Allowed**:
- Letters: a-z, A-Z
- Numbers: 0-9
- Spaces: ` `
- Special symbols: `.`, `_`, `-`

**Blocked**:
- Emoji: 🎮, 😀, etc.
- Special characters: #, @, $, %, &, *, +, =, etc.
- Control characters: \n, \r, \t, etc.
- Unicode exploits: RTL override, zero-width characters

**Rule 2: Length Constraint**

```javascript
function validateLength(ign) {
  if (ign.length === 0) {
    return {
      valid: false,
      error: 'IGN cannot be empty or only whitespace'
    };
  }
  
  if (ign.length > 32) {
    return {
      valid: false,
      error: `IGN too long: ${ign.length}/32 characters`
    };
  }
  
  return { valid: true };
}
```

**Rule 3: Whitespace Trimming**

```javascript
function trimIgn(ign) {
  return ign.trim();
}

// Usage:
const userInput = "  ProGamer  ";
const trimmedIgn = trimIgn(userInput); // "ProGamer"
```

**Rule 4: Complete Validation Flow**

```javascript
export function validateIgn(ign) {
  // Step 1: Trim whitespace
  const trimmedIgn = ign.trim();
  
  // Step 2: Check length
  const lengthCheck = validateLength(trimmedIgn);
  if (!lengthCheck.valid) {
    return lengthCheck;
  }
  
  // Step 3: Check characters
  const charCheck = validateCharacters(trimmedIgn);
  if (!charCheck.valid) {
    return charCheck;
  }
  
  // All checks passed
  return {
    valid: true,
    ign: trimmedIgn
  };
}
```

### Uniqueness Validation (Database Layer)

**Enforced by**: UNIQUE constraint on `(LOWER(ign), guild_id)`

**Behavior**:
- Database automatically rejects duplicate IGNs (case-insensitive)
- Application receives error code `23505` (unique_violation)
- Application translates to user-friendly message

**Example Scenarios**:

| Existing IGN | New IGN Attempt | Result |
|--------------|-----------------|--------|
| "ProGamer" | "ProGamer" | ❌ Rejected (exact match) |
| "ProGamer" | "progamer" | ❌ Rejected (case-insensitive) |
| "ProGamer" | "ProGamer123" | ✅ Accepted (different name) |
| "ProGamer" (server A) | "ProGamer" (server B) | ✅ Accepted (different servers) |

---

## Query Patterns

### Query 1: Set IGN (Upsert)

```sql
-- Insert new IGN or update existing
INSERT INTO user_igns (user_id, guild_id, ign, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (user_id, guild_id) 
DO UPDATE SET 
  ign = EXCLUDED.ign,
  updated_at = NOW()
RETURNING *;
```

**Usage**: `/set-ign` command (handles both first-time set and updates)

**Performance**: O(log n) - uses PK index

### Query 2: Get IGN

```sql
-- Lookup IGN for user in specific server
SELECT ign FROM user_igns
WHERE user_id = $1 AND guild_id = $2;
```

**Usage**: 
- `/view-ign` command
- Check-in flow (before inserting checkin record)

**Performance**: O(log n) - uses PK index

### Query 3: Remove IGN

```sql
-- Delete user's IGN in specific server
DELETE FROM user_igns
WHERE user_id = $1 AND guild_id = $2
RETURNING ign;
```

**Usage**: `/remove-ign` command

**Performance**: O(log n) - uses PK index

**Note**: RETURNING clause allows showing which IGN was removed in success message

### Query 4: Check-In with IGN

```sql
-- Step 1: Validate IGN exists (MANDATORY)
SELECT ign FROM user_igns
WHERE user_id = $1 AND guild_id = $2;

-- If no result: Return error to user (FR-028, FR-029)
-- "You must set your in-game name first. Use /set-ign to set your IGN before checking in."

-- Step 2: If IGN found, insert check-in with IGN
INSERT INTO checkins (event_id, user_id, username, discriminator, ign, timestamp)
VALUES ($1, $2, $3, $4, $5, NOW())
RETURNING *;
```

**Usage**: Check-in button handler → checkinService.createCheckIn()

**Performance**: Two queries, both O(log n) - total ~100ms typical

**Note**: Check-in is prevented if IGN not found (mandatory requirement)

### Query 5: Export with IGN

```sql
-- Get all check-ins for event (IGN already included)
SELECT 
  username,
  ign,
  timestamp AS checkin_time,
  (SELECT timestamp FROM checkouts WHERE checkouts.checkin_id = checkins.checkin_id) AS checkout_time
FROM checkins
WHERE event_id = $1
ORDER BY timestamp ASC;
```

**Usage**: `/export-event` command → exportService.generateCsv()

**Performance**: Single query, no JOIN needed

---

## Data Integrity Constraints

### Constraint 1: One IGN Per User Per Server

**Enforced by**: Primary key `(user_id, guild_id)`

**Prevents**:
- Same user having multiple IGNs in same server
- Data inconsistency (which IGN to use?)

**Example Violation Attempt**:

```sql
-- First insert succeeds
INSERT INTO user_igns VALUES ('user1', 'guild1', 'ProGamer', NOW());

-- Second insert fails (duplicate PK)
INSERT INTO user_igns VALUES ('user1', 'guild1', 'CasualPlayer', NOW());
-- ERROR: duplicate key value violates unique constraint "user_igns_pkey"
```

### Constraint 2: Unique IGN Per Server (Case-Insensitive)

**Enforced by**: UNIQUE index on `(LOWER(ign), guild_id)`

**Prevents**:
- Two users having same IGN in same server
- Case-variant duplicates ("Player" vs "player")

**Example Violation Attempt**:

```sql
-- First insert succeeds
INSERT INTO user_igns VALUES ('user1', 'guild1', 'ProGamer', NOW());

-- Second insert fails (duplicate IGN, different case)
INSERT INTO user_igns VALUES ('user2', 'guild1', 'progamer', NOW());
-- ERROR: duplicate key value violates unique constraint "idx_user_igns_ign_guild"
```

### Constraint 3: IGN Length Bounds

**Enforced by**: CHECK constraint `LENGTH(ign) BETWEEN 1 AND 32`

**Prevents**:
- Empty string IGNs
- Excessively long IGNs (UI overflow, database issues)

**Example Violation Attempt**:

```sql
-- Insert fails (empty string)
INSERT INTO user_igns VALUES ('user1', 'guild1', '', NOW());
-- ERROR: new row violates check constraint

-- Insert fails (too long)
INSERT INTO user_igns VALUES ('user1', 'guild1', 'A' * 50, NOW());
-- ERROR: new row violates check constraint
```

### Constraint 4: IGN Character Validation

**Enforced by**: CHECK constraint `ign ~ '^[a-zA-Z0-9\s._-]+$'`

**Prevents**:
- Emoji and special characters
- XSS attempts (e.g., `<script>`)
- Control characters

**Example Violation Attempt**:

```sql
-- Insert fails (contains emoji)
INSERT INTO user_igns VALUES ('user1', 'guild1', 'Pro🎮Gamer', NOW());
-- ERROR: new row violates check constraint

-- Insert fails (contains HTML)
INSERT INTO user_igns VALUES ('user1', 'guild1', '<script>alert(1)</script>', NOW());
-- ERROR: new row violates check constraint
```

---

## Backward Compatibility

### Existing CheckIn Records

**Scenario**: Database contains check-in records created before IGN feature was deployed.

**Behavior**:
- Old records have `ign = NULL` (column added with NULLABLE constraint for backward compatibility)
- Queries selecting `ign` column work unchanged
- CSV exports display empty string for NULL IGN values
- Analytics can filter: `WHERE ign IS NOT NULL` (only records with IGN)
- **All new check-ins** after deployment require IGN (enforced by application - FR-005, FR-028, FR-029)

**Example**:

```sql
-- Old record (before migration)
SELECT username, ign, timestamp FROM checkins WHERE checkin_id = 'old-record-1';
-- Result: ('JohnDoe', NULL, '2025-12-20 14:00:00')

-- New record (after migration)
SELECT username, ign, timestamp FROM checkins WHERE checkin_id = 'new-record-1';
-- Result: ('JohnDoe', 'ProGamer', '2025-12-23 15:00:00')
```

### Existing Export Functionality

**Scenario**: Admin exports an event created before IGN feature.

**Behavior**:
- Export query includes `ign` column
- All records in that event have `ign = NULL`
- CSV shows empty IGN column for all rows
- No errors, no breaking changes
- Events created after deployment will have IGN populated (all users required to have IGN set)

**Example CSV**:

```csv
Username,IGN,Check-In Time,Check-Out Time
JohnDoe#1234,,12/20/2025 2:00:00 PM,12/20/2025 5:00:00 PM
JaneSmith#5678,,12/20/2025 2:05:00 PM,12/20/2025 5:10:00 PM
```

---

## Summary

### New Table: `user_igns`
- **Composite PK**: (user_id, guild_id)
- **Unique constraint**: Case-insensitive IGN per server
- **Validation**: Length (1-32), character whitelist, no leading/trailing whitespace

### Extended Table: `checkins`
- **New column**: `ign` (NULLABLE in database for backward compatibility)
- **Purpose**: Historical snapshot of IGN at check-in time
- **Enforcement**: Application logic prevents check-in without IGN (FR-005, FR-028, FR-029)
- **Backward compatible**: Existing pre-IGN records unaffected (ign = NULL)

### Key Design Decisions
- **Per-server scoping**: Same user can have different IGNs in different servers
- **Historical accuracy**: IGN stored in checkins table (not JOINed at export time)
- **Atomic uniqueness**: Database constraint prevents race conditions
- **Mandatory IGN for check-in**: Application validates IGN exists before allowing check-in (FR-005, FR-028, FR-029)
- **Clear error messages**: Users without IGN receive helpful guidance to set IGN first

### Next Steps
- **Phase 1**: Create API contracts (slash command definitions)
- **Phase 1**: Write quickstart.md (setup and migration guide)
- **Phase 2**: Implement services, commands, and integration
