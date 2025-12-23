# Research: In-Game Name Management

**Feature**: IGN Management for Discord Event Check-In Bot  
**Date**: 2025-12-23  
**Status**: Completed

## Overview

This document consolidates technical research and design decisions for adding in-game name (IGN) functionality to the Discord Event Check-In Bot. All "NEEDS CLARIFICATION" items from the Technical Context have been resolved through spec clarification sessions and architectural analysis.

---

## Research Question 1: Database Schema Design

### Question
How should IGN data be stored to support per-server uniqueness, efficient lookups during check-in, and prevent race conditions?

### Decision
Use composite primary key (user_id, guild_id) in `user_igns` table with additional UNIQUE constraint on (LOWER(ign), guild_id).

### Rationale
1. **Composite PK enforces one-IGN-per-server**: Database-level constraint prevents multiple IGN entries for same user in same server
2. **Efficient lookups**: Both columns indexed as part of PK, optimizing the check-in query `WHERE user_id = ? AND guild_id = ?`
3. **Case-insensitive uniqueness**: Separate UNIQUE index on `LOWER(ign)` prevents "Player" and "player" in same server
4. **Race condition prevention**: UNIQUE constraint handles concurrent INSERT attempts atomically at database level

### Schema Definition

```sql
CREATE TABLE user_igns (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  ign TEXT NOT NULL CHECK (LENGTH(ign) BETWEEN 1 AND 32),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, guild_id)
);

-- Case-insensitive uniqueness per server
CREATE UNIQUE INDEX idx_user_igns_ign_guild 
ON user_igns (LOWER(ign), guild_id);

-- Lookup performance optimization
CREATE INDEX idx_user_igns_lookup 
ON user_igns (user_id, guild_id);
```

### Alternatives Considered

**Option A: Single user_id PK with guild_id as regular column**
- ❌ Rejected: Doesn't enforce one-IGN-per-server constraint
- Would allow multiple rows with same user_id but different guild_ids (correct)
- BUT wouldn't prevent multiple rows with same (user_id, guild_id) pair

**Option B: UUID primary key with UNIQUE constraint on (user_id, guild_id)**
- ❌ Rejected: Adds unnecessary complexity
- UUID primary key serves no purpose (no external references)
- UNIQUE constraint achieves same goal as composite PK
- Extra column wastes storage and index space

**Option C: Global IGN table (no guild_id)**
- ❌ Rejected: Violates requirement for per-server IGNs
- Users want different IGNs in different servers (gaming communities)
- Spec explicitly requires server-specific storage (FR-002)

### Performance Implications

- **Check-in query**: Single index lookup on (user_id, guild_id) - O(log n) with B-tree index
- **IGN uniqueness check**: Handled by database during INSERT/UPDATE - no application logic needed
- **Expected dataset**: 100-500 users per server × 10 servers = 5,000 rows typical
- **Query time**: <10ms for lookup on indexed composite key

---

## Research Question 2: IGN Validation Strategy

### Question
What validation rules ensure IGN quality while preventing exploits (emoji, control characters, excessive length)?

### Decision
Server-side validation using regex pattern `/^[a-zA-Z0-9\s._-]+$/` with 32-character limit and automatic whitespace trimming.

### Rationale
1. **Character whitelist prevents exploits**: Regex explicitly allows only safe characters
2. **Blocks emoji/Unicode**: Pattern rejects emoji, RTL overrides, zero-width characters
3. **Industry-standard length**: 32 characters matches common gaming platforms (Steam, Battle.net)
4. **Whitespace handling**: Trim before validation (FR-009), reject if empty after trim
5. **Clear error messages**: Validation failure explains allowed characters with examples

### Validation Implementation

```javascript
// src/services/ignService.js

export function validateIgn(ign) {
  // Trim leading/trailing whitespace (FR-009)
  const trimmedIgn = ign.trim();
  
  // Check empty after trim
  if (trimmedIgn.length === 0) {
    return {
      valid: false,
      error: 'IGN cannot be empty or only whitespace',
    };
  }
  
  // Check length (FR-008)
  if (trimmedIgn.length > 32) {
    return {
      valid: false,
      error: `IGN too long: ${trimmedIgn.length}/32 characters`,
    };
  }
  
  // Check character types (FR-008a)
  const validPattern = /^[a-zA-Z0-9\s._-]+$/;
  if (!validPattern.test(trimmedIgn)) {
    return {
      valid: false,
      error: 'IGN contains invalid characters. Allowed: letters, numbers, spaces, and ._- symbols',
    };
  }
  
  return {
    valid: true,
    ign: trimmedIgn, // Return trimmed version
  };
}
```

### Validation Test Cases

| Input | Expected | Reason |
|-------|----------|--------|
| `"Player123"` | ✅ Valid | Standard alphanumeric |
| `"Pro_Gamer"` | ✅ Valid | Underscore allowed |
| `"Mr. Smith"` | ✅ Valid | Period and space allowed |
| `"Dark-Knight"` | ✅ Valid | Hyphen allowed |
| `"  SpaceGuy  "` | ✅ Valid (trimmed to "SpaceGuy") | Whitespace trimmed |
| `"🎮Player"` | ❌ Invalid | Emoji blocked |
| `"Player#123"` | ❌ Invalid | Hash symbol blocked |
| `"A".repeat(50)` | ❌ Invalid | Exceeds 32 chars |
| `"   "` | ❌ Invalid | Empty after trim |
| `"Player<script>"` | ❌ Invalid | XSS attempt blocked |

### Alternatives Considered

**Option A: Discord.js built-in string validators**
- ❌ Rejected: Discord only validates max_length, doesn't filter character types
- Would allow emoji and special characters through
- Still need custom validation for character types

**Option B: Comprehensive Unicode allowlist (accented characters, CJK)**
- ⚠️ Deferred: Adds complexity without clear user demand
- Current pattern handles English gaming names (primary use case)
- Can extend pattern in future if international users request it
- Avoiding premature optimization

**Option C: No validation (trust users)**
- ❌ Rejected: Violates FR-008 and FR-008a
- Opens door to display issues (emoji rendering, RTL override)
- Increases support burden (users confused by weird characters)
- Database length constraint insufficient (doesn't prevent emoji)

### Security Considerations

- **XSS Prevention**: Validation blocks `<`, `>`, `/`, `\` and other HTML/script characters
- **SQL Injection**: N/A - using parameterized queries via Supabase client
- **Unicode Exploits**: Pattern blocks RTL override (U+202E), zero-width characters, emoji variants
- **Display Issues**: Allowed characters render consistently in Discord, CSV exports, databases

---

## Research Question 3: IGN Uniqueness Enforcement

### Question
Should IGNs be unique per server? How to prevent duplicate IGNs and race conditions?

### Decision
Enforce case-insensitive uniqueness per server using database UNIQUE constraint with LOWER() function index.

### Rationale
1. **User expectation**: Gaming communities expect unique identifiers (prevents confusion)
2. **Database-level enforcement**: Handles race conditions atomically, no application logic needed
3. **Case-insensitive**: "Player" and "player" considered duplicates (prevents confusion)
4. **Clear error handling**: Unique constraint violation returns specific error code (23505) for user-friendly message

### Implementation

```sql
-- Unique constraint on lowercase IGN + guild_id
CREATE UNIQUE INDEX idx_user_igns_ign_guild 
ON user_igns (LOWER(ign), guild_id);
```

```javascript
// src/services/ignService.js

export async function setIgn(userId, guildId, ign) {
  try {
    // Validate first
    const validation = validateIgn(ign);
    if (!validation.valid) {
      return {
        success: false,
        error: 'validation',
        message: validation.error,
      };
    }
    
    // Upsert (insert or update)
    const { data, error } = await supabase
      .from('user_igns')
      .upsert({
        user_id: userId,
        guild_id: guildId,
        ign: validation.ign, // Use trimmed version
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,guild_id', // Update if user already has IGN
      })
      .select()
      .single();
    
    if (error) {
      // Check for duplicate IGN (different user, same guild)
      if (error.code === '23505' && error.message.includes('idx_user_igns_ign_guild')) {
        return {
          success: false,
          error: 'duplicate',
          message: `The IGN "${validation.ign}" is already taken in this server`,
        };
      }
      
      console.error('❌ Database error setting IGN:', error);
      return {
        success: false,
        error: 'database',
        message: 'Failed to save your IGN. Please try again.',
      };
    }
    
    console.log(`✅ IGN set: ${userId} in ${guildId} -> "${validation.ign}"`);
    return {
      success: true,
      data,
    };
  } catch (err) {
    console.error('❌ Unexpected error setting IGN:', err);
    return {
      success: false,
      error: 'unexpected',
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}
```

### Race Condition Handling

**Scenario**: Two users simultaneously try to set IGN to "Player" in same server

1. User A: `setIgn('userA', 'guild1', 'Player')` - starts transaction
2. User B: `setIgn('userB', 'guild1', 'Player')` - starts transaction
3. User A's INSERT/UPDATE completes first
4. User B's INSERT/UPDATE hits UNIQUE constraint
5. User B receives error code 23505
6. Application returns user-friendly message: "The IGN 'Player' is already taken"

**Result**: Atomic database constraint prevents duplicate, no application-level locks needed.

### Alternatives Considered

**Option A: Application-level duplicate check (SELECT then INSERT)**
- ❌ Rejected: Race condition vulnerable
- SELECT might not see concurrent INSERT in progress
- Time window between SELECT and INSERT allows duplicates
- Requires application-level locking (complex, error-prone)

**Option B: No uniqueness enforcement**
- ❌ Rejected: Violates clarified requirements
- Multiple users with same IGN confuses event organizers
- Defeats purpose of IGN (unique identification in gaming context)

**Option C: Global uniqueness (across all servers)**
- ❌ Rejected: Too restrictive
- Users may want same IGN in different servers (different gaming communities)
- Reduces IGN availability (10 servers × 500 users = 5000 unique names needed)
- Violates per-server design principle

### Edge Cases

| Scenario | Behavior | Handled By |
|----------|----------|------------|
| User A sets "Player", User B tries "player" | User B gets duplicate error | LOWER() index |
| User A sets "Player", User A updates to "Gamer" | Success, updated_at changes | Upsert on PK |
| User A sets "Player", User B sets "Player123" | Both succeed | Different IGNs |
| User sets "Player" in server 1, "Player" in server 2 | Both succeed | guild_id separates |
| Concurrent same-user updates | Last write wins | PK ensures single row |

---

## Research Question 4: Check-In Integration Approach

### Question
How should IGN lookup integrate into the existing check-in flow without breaking backward compatibility or degrading performance?

### Decision
Modify `checkinService.createCheckIn()` to query `user_igns` before allowing check-in, blocking the check-in with an error message if IGN is not set.

### Rationale
1. **Single query overhead**: Add one SELECT to check-in flow (~50ms typical)
2. **Mandatory IGN enforcement**: Validates IGN exists before allowing check-in (FR-005, FR-028, FR-029)
3. **Historical accuracy**: Store IGN snapshot in checkins record (preserves if user changes IGN later)
4. **Clear error messages**: Prevents check-in with helpful error directing users to /set-ign (FR-029)
5. **Minimal code changes**: Only modify createCheckIn() and announcement message logic

### Implementation

```javascript
// src/services/checkinService.js (MODIFIED)

import { supabase } from '../database/supabase.js';

export async function createCheckIn(eventId, user, guildId) {
  try {
    console.log(`📝 Creating check-in for user ${user.username} (${user.id}) at event ${eventId}`);
    
    // STEP 1: Query IGN (NEW - MANDATORY)
    let userIgn = null;
    try {
      const { data: ignData, error: ignError } = await supabase
        .from('user_igns')
        .select('ign')
        .eq('user_id', user.id)
        .eq('guild_id', guildId)
        .maybeSingle(); // Returns null if not found, no error
      
      if (ignError) {
        console.error('❌ Error fetching IGN:', ignError);
        return {
          success: false,
          error: 'database',
          message: 'Failed to verify your IGN. Please try again.',
        };
      } else if (!ignData) {
        console.log(`⚠️ No IGN set for user ${user.id} in guild ${guildId}`);
        return {
          success: false,
          error: 'no_ign',
          message: 'You must set your in-game name first. Use /set-ign to set your IGN before checking in.',
        };
      }
      
      userIgn = ignData.ign;
      console.log(`🎮 IGN found: ${userIgn}`);
    } catch (ignErr) {
      console.error('❌ Unexpected error fetching IGN:', ignErr);
      return {
        success: false,
        error: 'unexpected',
        message: 'An unexpected error occurred. Please try again.',
      };
    }
    
    // STEP 2: Insert check-in record with IGN (MODIFIED)
    const { data, error } = await supabase
      .from('checkins')
      .insert({
        event_id: eventId,
        user_id: user.id,
        username: user.username,
        discriminator: user.discriminator === '0' ? null : user.discriminator,
        ign: userIgn, // NEW FIELD - null if not set
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      // Existing error handling unchanged
      if (error.code === '23505') {
        console.log(`⚠️ Duplicate check-in attempt by ${user.username}`);
        return {
          success: false,
          error: 'duplicate',
          message: 'You have already checked in to this event!',
        };
      }
      
      console.error('❌ Database error creating check-in:', error);
      return {
        success: false,
        error: 'database',
        message: 'Failed to record check-in. Please try again.',
      };
    }
    
    console.log(`✅ Check-in created successfully: ${data.checkin_id}`);
    return {
      success: true,
      data,
      displayName: userIgn, // NEW - for announcement (always set)
    };
  } catch (err) {
    console.error('❌ Unexpected error creating check-in:', err);
    return {
      success: false,
      error: 'unexpected',
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}

export async function postCheckInAnnouncement(channel, user, timestamp, displayName) {
  try {
    console.log(`📢 Posting check-in announcement for ${displayName} in channel ${channel.id}`);
    
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    
    // MODIFIED: Use displayName (IGN or username)
    await channel.send({
      content: `✅ **${displayName}** checked in at **${timeString}**`,
    });
    
    console.log(`✅ Check-in announcement posted successfully`);
    return true;
  } catch (err) {
    console.error('❌ Error posting check-in announcement:', err);
    return false;
  }
}
```

### Performance Analysis

**Baseline Check-In Flow** (before IGN):
- INSERT into checkins: ~50ms
- Send Discord message: ~100ms
- Total: ~150ms

**New Check-In Flow** (with mandatory IGN):
- SELECT from user_igns: ~50ms (indexed lookup)
- Validation: <1ms (check if IGN exists)
- INSERT into checkins: ~50ms
- Send Discord message: ~100ms
- Total: ~200ms

**Impact**: +50ms per check-in (33% increase), well within 500ms target

### Alternatives Considered

**Option A: Lookup IGN in button handler**
- ❌ Rejected: Mixes presentation logic with data fetching
- Button handler should remain thin (interaction routing only)
- Violates separation of concerns

**Option B: Eager load all IGNs at event start**
- ❌ Rejected: Memory overhead, stale data
- Would need to cache 100-500 IGNs in memory per event
- Cache invalidation if user updates IGN during event
- Adds complexity without significant performance gain

**Option C: JOIN query at export time only**
- ❌ Rejected: Loses historical accuracy
- If user changes IGN after event, export shows new IGN not the one used during event
- Violates FR-010 (store IGN in checkin record)

**Option D: Fail check-in if IGN not set**
- ✅ **SELECTED**: Enforces mandatory IGN requirement (FR-005, FR-028, FR-029)
- Database errors still block check-ins (maintain data integrity)
- Users must set IGN before checking in (intentional requirement)
- Clear error message guides users to /set-ign command

### Error Handling Strategy

| Error Scenario | Behavior | User Impact |
|----------------|----------|-------------|
| IGN not found (user never set) | Return error, prevent check-in | High (intentional requirement, clear error message) |
| Database timeout on IGN query | Return error, prevent check-in | High (maintains data integrity) |
| Database error on checkin INSERT | Return error, prevent checkin | High (but correct per FR-013) |
| Discord API error on announcement | Log error, checkin still saved | Minimal (data persisted) |

---

## Research Question 5: Export Enhancement Strategy

### Question
How should the CSV export include IGN data while maintaining backward compatibility with existing event exports?

### Decision
Add "IGN" column to CSV export, populated from `checkins.ign` field (required for all new check-ins).

### Rationale
1. **Historical accuracy**: Export shows IGN as it was during event, not current IGN
2. **Simple query**: No JOIN needed (IGN already in checkins table)
3. **Backward compatible**: Existing events have ign=NULL, displays as empty string in CSV (pre-IGN feature records)
4. **Column ordering**: Username, IGN, Check-In Time, Check-Out Time (logical grouping)

### Implementation

```javascript
// src/services/exportService.js (MODIFIED)

export async function generateCsv(eventId) {
  try {
    console.log(`📊 Generating CSV export for event ${eventId}`);
    
    // Fetch event data
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .single();
    
    if (eventError || !event) {
      return {
        success: false,
        error: 'event_not_found',
        message: 'Event not found',
      };
    }
    
    // Fetch check-ins and check-outs (MODIFIED QUERY)
    const { data: checkins, error: checkinsError } = await supabase
      .from('checkins')
      .select(`
        user_id,
        username,
        ign,
        timestamp,
        checkouts (
          timestamp
        )
      `)
      .eq('event_id', eventId)
      .order('timestamp', { ascending: true });
    
    if (checkinsError) {
      console.error('❌ Error fetching check-ins:', checkinsError);
      return {
        success: false,
        error: 'database',
        message: 'Failed to fetch attendance data',
      };
    }
    
    // Build CSV (MODIFIED COLUMNS)
    let csv = 'Username,IGN,Check-In Time,Check-Out Time\n';
    
    for (const checkin of checkins) {
      const username = checkin.username;
      const ign = checkin.ign || ''; // NEW - empty string if null
      const checkinTime = new Date(checkin.timestamp).toLocaleString();
      const checkoutTime = checkin.checkouts?.[0]?.timestamp 
        ? new Date(checkin.checkouts[0].timestamp).toLocaleString()
        : '';
      
      // Escape commas and quotes in names (CSV standard)
      const escapeCSV = (str) => {
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      csv += `${escapeCSV(username)},${escapeCSV(ign)},${checkinTime},${checkoutTime}\n`;
    }
    
    console.log(`✅ CSV generated successfully (${checkins.length} rows)`);
    return {
      success: true,
      csv,
      filename: `${event.event_name.replace(/\s+/g, '-')}-attendance.csv`,
    };
  } catch (err) {
    console.error('❌ Unexpected error generating CSV:', err);
    return {
      success: false,
      error: 'unexpected',
      message: 'An unexpected error occurred',
    };
  }
}
```

### Example CSV Output

**Event with mixed IGN/non-IGN users:**

```csv
Username,IGN,Check-In Time,Check-Out Time
JohnDoe#1234,ProGamer,12/23/2025 2:00:00 PM,12/23/2025 5:00:00 PM
JaneSmith#5678,,12/23/2025 2:05:00 PM,12/23/2025 5:10:00 PM
PlayerOne#9999,Dark_Knight,12/23/2025 2:10:00 PM,
```

**Interpretation**:
- JohnDoe checked in as "ProGamer" (has IGN)
- JaneSmith has empty IGN (legacy check-in from before IGN was mandatory)
- PlayerOne checked in as "Dark_Knight" but hasn't checked out yet

### Backward Compatibility Testing

| Scenario | Expected CSV | Test Status |
|----------|--------------|-------------|
| Old event (created before IGN feature) | IGN column present but empty for all rows | ✅ Must verify |
| New event, all users have IGN | IGN column populated for all rows | ✅ Must verify |
| Mixed: old check-ins without IGN + new check-ins with IGN | IGN column populated for new, empty for old | ✅ Must verify |

### Alternatives Considered

**Option A: Separate IGN export command**
- ❌ Rejected: Fragments user experience
- Admins expect single export with all relevant data
- Increases complexity (two export commands to maintain)

**Option B: JOIN with user_igns at export time**
- ❌ Rejected: Shows current IGN, not historical
- User might change IGN after event
- Export would show wrong IGN for historical events
- Violates FR-010 (historical tracking requirement)

**Option C: Make IGN optional column (flag in command)**
- ❌ Rejected: Unnecessary complexity
- IGN column presence doesn't harm backward compatibility
- Empty strings in CSV are standard for missing optional data

---

## Best Practices & Patterns

### Supabase PostgreSQL Patterns

1. **Composite Primary Keys**: Use for natural multi-column uniqueness (user_id, guild_id)
2. **UNIQUE Indexes with Functions**: `LOWER(ign)` for case-insensitive uniqueness
3. **NULLABLE Columns**: For backward compatibility (ign column in checkins)
4. **Timestamps with NOW()**: For automatic timestamp management (updated_at)
5. **maybeSingle()**: For queries that might return 0 rows (IGN lookup)

### discord.js v14 Command Patterns

1. **Ephemeral Responses**: Use for user-specific data (IGN view, errors)
   ```javascript
   await interaction.reply({ content: '...', ephemeral: true });
   ```

2. **Deferred Replies**: For operations >3s (database writes)
   ```javascript
   await interaction.deferReply({ ephemeral: true });
   // ... database operation ...
   await interaction.editReply({ content: '...' });
   ```

3. **Command Descriptions**: Clear, concise, with examples
   ```javascript
   description: 'Set your in-game name (max 32 chars, letters/numbers/spaces/._- only)'
   ```

4. **Parameter Constraints**: Use Discord's built-in validation
   ```javascript
   max_length: 32,
   min_length: 1,
   required: true
   ```

### Node.js Error Handling Patterns

1. **Typed Error Responses**: Return structured error objects
   ```javascript
   return {
     success: false,
     error: 'duplicate', // Machine-readable code
     message: 'User-friendly explanation',
   };
   ```

2. **Graceful Degradation**: Continue on non-critical errors
   ```javascript
   // Only applies to non-IGN errors (e.g., Discord API failures)
   if (announcementError) {
     console.error('⚠️ Announcement failed, but check-in saved');
   }
   ```

3. **Structured Logging**: Include context in every log
   ```javascript
   console.log(`✅ IGN set: ${userId} in ${guildId} -> "${ign}"`);
   ```

4. **Try-Catch Boundaries**: Wrap all async operations
   ```javascript
   try {
     // ... database operations ...
   } catch (err) {
     console.error('❌ Unexpected error:', err);
     return { success: false, error: 'unexpected', message: '...' };
   }
   ```

### Performance Best Practices

1. **Index Critical Queries**: Composite PK automatically indexed
2. **Single Round-Trips**: Query IGN and insert checkin sequentially (can't parallelize due to dependency)
3. **Avoid N+1 Queries**: Store IGN in checkins table (no JOIN at export time)
4. **Measure in Production**: Log query times for IGN lookups
   ```javascript
   const start = Date.now();
   const { data } = await supabase.from('user_igns').select(...);
   console.log(`IGN lookup: ${Date.now() - start}ms`);
   ```

---

## Technology Stack Decisions

### Database: Supabase (PostgreSQL)

**Why Supabase**:
- Already in use (existing infrastructure)
- PostgreSQL supports advanced constraints (UNIQUE with LOWER())
- Real-time capabilities (future: live IGN updates)
- Easy migration path (SQL DDL)

**Key Features Used**:
- Composite primary keys
- Function-based unique indexes
- CHECK constraints
- Timestamps with defaults

### Discord.js v14

**Why discord.js v14**:
- Already in use (existing bot framework)
- Mature slash command support
- Active community, good documentation
- Handles Discord API rate limits automatically

**Key Features Used**:
- Slash command registration
- Interaction.reply() / editReply()
- Ephemeral messages
- Guild context (guildId)

### Node.js 18+ (ES Modules)

**Why Node.js 18+**:
- Already in use (existing runtime)
- Native ES modules (import/export)
- Top-level await
- Stable long-term support (LTS)

**Key Features Used**:
- async/await
- ES6 modules
- Template literals
- Destructuring

---

## Summary of Key Decisions

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Database Schema** | Composite PK (user_id, guild_id) | Enforces per-server uniqueness, efficient lookups |
| **IGN Validation** | Regex + 32-char limit | Blocks exploits, industry standard length |
| **Uniqueness** | DB UNIQUE constraint with LOWER() | Atomic, case-insensitive, prevents races |
| **Check-In Integration** | Validate IGN exists before allowing check-in | Enforces mandatory IGN requirement (FR-005, FR-028, FR-029) |
| **Historical Tracking** | Store IGN in checkins table | Preserves accuracy even if user changes IGN |
| **Export Format** | Add IGN column to existing CSV | Backward compatible, no JOIN needed |
| **Error Handling** | Prevent check-in if IGN not set | Clear user guidance, enforces feature requirement |
| **Command UX** | Ephemeral responses for privacy | User-specific data not visible to others |

---

## Next Steps

1. **Phase 1**: Generate data-model.md with detailed entity definitions
2. **Phase 1**: Create contracts/ with JSON command definitions
3. **Phase 1**: Write quickstart.md with setup instructions
4. **Phase 2**: Break down implementation into atomic tasks (via /speckit.tasks)

---

**Research Status**: ✅ COMPLETE  
**All Unknowns Resolved**: Yes  
**Ready for Design Phase**: Yes
