# Manual Test Scenarios: IGN Management & Check-In Flow

**Feature**: In-Game Name (IGN) Management  
**Test Date**: To be completed during deployment  
**Tester**: [Your Name]

## Test Environment Setup

**Prerequisites**:
1. Bot deployed and connected to Discord server
2. Database migrations completed (user_igns table exists, checkins has ign column)
3. Slash commands registered (`/set-ign`, `/view-ign`, `/remove-ign`)
4. Admin permissions configured
5. Test Discord server with multiple test users

## Test Scenario 1: Set IGN (User Story 1)

**Goal**: Verify users can set and update their IGN with proper validation

### Test Case 1.1: First-Time IGN Setup
**Steps**:
1. As test user, run `/set-ign name:ProGamer`
2. Verify response: "Your in-game name has been set! Your IGN: **ProGamer**"
3. Check database: Query `user_igns` table for user record
4. Verify `updated_at` timestamp is recent

**Expected Result**: ✅ IGN saved successfully with success message

### Test Case 1.2: Update Existing IGN (UPSERT)
**Steps**:
1. User already has IGN "ProGamer" set
2. Run `/set-ign name:ElitePlayer`
3. Verify response: "Your in-game name has been set! Your IGN: **ElitePlayer**"
4. Check database: Same user record updated, not duplicate created
5. Verify `updated_at` timestamp is newer

**Expected Result**: ✅ IGN updated in place (no duplicate records)

### Test Case 1.3: Validation - Empty String
**Steps**:
1. Run `/set-ign name:` (empty)
2. Verify error: "IGN cannot be empty or only whitespace"

**Expected Result**: ✅ Validation error with helpful message

### Test Case 1.4: Validation - Too Long (>32 chars)
**Steps**:
1. Run `/set-ign name:ThisIsAVeryLongInGameNameThatExceedsTheLimit`
2. Verify error: "IGN too long: XX/32 characters"

**Expected Result**: ✅ Length validation enforced

### Test Case 1.5: Validation - Invalid Characters
**Steps**:
1. Run `/set-ign name:Pro🎮Gamer` (emoji)
2. Verify error: "IGN contains invalid characters. Allowed: letters, numbers, spaces, and ._- symbols"
3. Try `/set-ign name:<script>test</script>` (XSS attempt)
4. Verify same error

**Expected Result**: ✅ Character whitelist enforced

### Test Case 1.6: Duplicate IGN (Case-Insensitive)
**Steps**:
1. User A sets IGN "ProGamer"
2. User B tries to set IGN "progamer" (different case)
3. Verify error: "The IGN 'progamer' is already taken in this server"
4. User B tries "ProGamer123" (different name)
5. Verify success

**Expected Result**: ✅ Uniqueness enforced case-insensitively

### Test Case 1.7: Server-Specific IGNs
**Steps**:
1. User sets IGN "ProGamer" in Server A
2. Same user sets IGN "CasualPlayer" in Server B
3. Check database: Two records exist for same user_id, different guild_ids
4. Run `/view-ign` in Server A: Shows "ProGamer"
5. Run `/view-ign` in Server B: Shows "CasualPlayer"

**Expected Result**: ✅ IGNs are isolated per server

---

## Test Scenario 2: Check-In with Mandatory IGN (User Story 2)

**Goal**: Verify IGN is mandatory for check-ins and displayed in announcements

### Test Case 2.1: Check-In Without IGN (BLOCKING)
**Steps**:
1. New user (no IGN set) clicks "Check In" button on active event
2. Verify error: "You must set your in-game name first. Use `/set-ign` to set your IGN before checking in."
3. Check database: No check-in record created
4. Verify no announcement posted in channel

**Expected Result**: ✅ Check-in blocked with helpful guidance

### Test Case 2.2: Check-In With IGN (Success)
**Steps**:
1. User sets IGN "ProGamer" with `/set-ign`
2. Create event with `/create-event`
3. User clicks "Check In" button
4. Verify private response: "Successfully checked in as **ProGamer**! Your attendance has been recorded."
5. Verify public announcement: "✅ **ProGamer** checked in at **[time]**"
6. Check database: `checkins` table has record with `ign='ProGamer'`

**Expected Result**: ✅ Check-in succeeds, IGN displayed in announcement

### Test Case 2.3: IGN Snapshot (Historical Accuracy)
**Steps**:
1. User checks in with IGN "ProGamer"
2. User updates IGN to "ElitePlayer" with `/set-ign`
3. Check database: `checkins` record still shows `ign='ProGamer'`
4. User checks in to new event
5. Check database: New checkin record shows `ign='ElitePlayer'`

**Expected Result**: ✅ IGN captured at check-in time, not updated retroactively

### Test Case 2.4: Duplicate Check-In Prevention
**Steps**:
1. User checks in to event
2. User tries to check in again to same event
3. Verify message: "You have already checked in to this event!"

**Expected Result**: ✅ Duplicate check-in prevented (existing functionality still works)

---

## Test Scenario 3: View IGN (User Story 3)

**Goal**: Verify users can view their current IGN

### Test Case 3.1: View Existing IGN
**Steps**:
1. User has IGN "ProGamer" set
2. Run `/view-ign`
3. Verify response: "Your current IGN: **ProGamer**"
4. Verify message includes update tip

**Expected Result**: ✅ IGN displayed correctly

### Test Case 3.2: View When No IGN Set
**Steps**:
1. New user (no IGN) runs `/view-ign`
2. Verify response: "You have not set your in-game name for this server yet."
3. Verify message includes setup instructions

**Expected Result**: ✅ Helpful "not set" message with guidance

---

## Test Scenario 4: Remove IGN (User Story 4)

**Goal**: Verify users can remove their IGN

### Test Case 4.1: Remove Existing IGN
**Steps**:
1. User has IGN "ProGamer" set
2. Run `/remove-ign`
3. Verify response: "Your IGN '**ProGamer**' has been removed from this server."
4. Verify warning: "You will not be able to check in to events until you set a new IGN"
5. Check database: Record deleted from `user_igns`
6. Try to check in: Verify blocked with error

**Expected Result**: ✅ IGN removed, check-in blocked

### Test Case 4.2: Remove When No IGN Set
**Steps**:
1. User has no IGN
2. Run `/remove-ign`
3. Verify response: "You do not have an in-game name set in this server."

**Expected Result**: ✅ Graceful handling of "not found" case

---

## Test Scenario 5: Export with IGN

**Goal**: Verify CSV exports include IGN column

### Test Case 5.1: Export Event with IGNs
**Steps**:
1. Create event
2. User A (IGN: "ProGamer") checks in
3. User B (IGN: "ElitePlayer") checks in
4. Close event
5. Export CSV
6. Verify CSV headers: `User ID, Username, Discriminator, IGN, Check-In Time, Check-Out Time`
7. Verify row 1: IGN column shows "ProGamer"
8. Verify row 2: IGN column shows "ElitePlayer"

**Expected Result**: ✅ IGN column present and populated

### Test Case 5.2: Backward Compatibility (Pre-IGN Records)
**Steps**:
1. Database has old check-in records with `ign=NULL`
2. Export event that has mix of old and new records
3. Verify old records: IGN column is empty (not "NULL")
4. Verify new records: IGN column populated
5. Verify CSV structure intact (no errors)

**Expected Result**: ✅ Backward compatible, empty string for NULL IGNs

### Test Case 5.3: CSV Escaping (IGN with Comma)
**Steps**:
1. User sets IGN "Player, Pro" (contains comma)
2. User checks in
3. Export CSV
4. Verify IGN field is quoted: `"Player, Pro"`
5. Open CSV in Excel/Google Sheets
6. Verify IGN displays correctly as one field

**Expected Result**: ✅ CSV escaping handles special characters

---

## Test Scenario 6: Edge Cases & Error Handling

### Test Case 6.1: Database Connection Failure
**Steps**:
1. Temporarily disable Supabase connection
2. Try `/set-ign`
3. Verify error: "Failed to save IGN. Please try again."
4. Verify structured log with error context

**Expected Result**: ✅ Graceful error handling with user-friendly message

### Test Case 6.2: Concurrent IGN Updates (Race Condition)
**Steps**:
1. User A and User B simultaneously try to set IGN "ProGamer"
2. Verify only one succeeds
3. Verify the other gets "IGN already taken" error
4. No duplicate records in database

**Expected Result**: ✅ Database constraint prevents race condition

### Test Case 6.3: Whitespace Trimming
**Steps**:
1. Run `/set-ign name:  ProGamer  ` (leading/trailing spaces)
2. Verify IGN saved as "ProGamer" (trimmed)
3. Verify response shows trimmed version

**Expected Result**: ✅ Whitespace trimmed automatically

### Test Case 6.4: Performance (<3 seconds)
**Steps**:
1. Run `/set-ign name:ProGamer`
2. Measure response time from command to confirmation
3. Verify <3 seconds (Constitution requirement)

**Expected Result**: ✅ Response within 3 seconds

---

## Test Scenario 7: Cross-Cutting Concerns

### Test Case 7.1: Structured Logging
**Steps**:
1. Run IGN operations (set, view, remove)
2. Check application logs
3. Verify logs include:
   - Timestamp
   - User ID
   - Guild ID
   - Operation type (set/view/remove)
   - Result (success/error)
   - Error details if failed

**Expected Result**: ✅ Comprehensive structured logging

### Test Case 7.2: Ephemeral Responses (Privacy)
**Steps**:
1. Run `/set-ign`, `/view-ign`, `/remove-ign`
2. Verify all responses are ephemeral (only user sees them)
3. Verify no IGN management messages visible to other users
4. Check-in announcement is public (expected)

**Expected Result**: ✅ All IGN commands are private except check-in announcement

---

## Regression Testing

### Test Case R.1: Existing Event Functionality
**Steps**:
1. Create event (verify no impact)
2. Close event (verify no impact)
3. Export event (verify IGN column added, otherwise functional)
4. Check-out (verify no impact)

**Expected Result**: ✅ Existing features work as before

### Test Case R.2: Admin Permissions
**Steps**:
1. Non-admin tries to create event
2. Verify admin-only error (no regression)

**Expected Result**: ✅ Admin permissions unchanged

---

## Test Results Summary

| Test Scenario | Total Cases | Passed | Failed | Notes |
|---------------|-------------|--------|--------|-------|
| 1. Set IGN | 7 | ___ | ___ | |
| 2. Check-In with IGN | 4 | ___ | ___ | |
| 3. View IGN | 2 | ___ | ___ | |
| 4. Remove IGN | 2 | ___ | ___ | |
| 5. Export with IGN | 3 | ___ | ___ | |
| 6. Edge Cases | 4 | ___ | ___ | |
| 7. Cross-Cutting | 2 | ___ | ___ | |
| Regression | 2 | ___ | ___ | |
| **TOTAL** | **26** | ___ | ___ | |

---

## Sign-Off

**Tester**: _______________  
**Date**: _______________  
**Status**: ⬜ PASS / ⬜ FAIL  
**Notes**: _______________________________________________
