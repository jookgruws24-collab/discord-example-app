# Tasks: Button UI Enhancement

**Branch**: `002-button-ui-enhancement`  
**Date**: 2025-12-22  
**Status**: Ready for Execution  
**Parent Spec**: [spec.md](./spec.md) | [plan.md](./plan.md)

---

## Task Organization

Tasks are split into **Phase 1** (add buttons) and **Phase 2** (remove commands).

**Phase 1** is non-breaking - commands continue to work.  
**Phase 2** is breaking - removes slash commands.

**Recommendation**: Complete Phase 1, test for 1-2 weeks, then do Phase 2.

---

## Format: `[ID] [Phase] Description`

- **[P1]**: Phase 1 - Add buttons (keep commands)
- **[P2]**: Phase 2 - Remove commands (breaking)
- **[T]**: Can run automated tests

**Estimated Total Time**: 3-4 hours (Phase 1: 2.5-3.5 hours, Phase 2: 0.5 hours)

---

## Phase 1: Add Buttons (Non-Breaking)

**Goal**: Add Close Event and Export CSV buttons while keeping slash commands functional  
**Duration**: 2.5-3.5 hours  
**Breaking Changes**: None  
**Can Rollback**: Yes (easily)

### Update createEvent.js (30 minutes)

- [ ] T001 [P1] Import ButtonStyle and create Close Event button component
- [ ] T002 [P1] Create Export CSV button component (initially hidden/disabled)
- [ ] T003 [P1] Create second ActionRow for admin buttons
- [ ] T004 [P1] Add both ActionRows to initial event message
- [ ] T005 [P1] Set Close Event button to disabled initially (pending state)
- [ ] T006 [P1] Set Export button to disabled initially (pending state)
- [ ] T007 [P1] Test: Create event and verify both buttons appear (disabled/gray)

**Files**: `src/commands/createEvent.js`

---

### Update buttonHandler.js (60 minutes)

#### Add Close Event Button Handler

- [ ] T008 [P1] Import isAdmin from permissions.js
- [ ] T009 [P1] Import closeEvent from eventService.js
- [ ] T010 [P1] Import getEventByChannelId from eventService.js
- [ ] T011 [P1] Create handleCloseEventButton() async function
- [ ] T012 [P1] Extract eventId from button customId (split by '_')
- [ ] T013 [P1] Defer reply (ephemeral: true)
- [ ] T014 [P1] Check if user isAdmin() - return error if not
- [ ] T015 [P1] Fetch event from database by eventId
- [ ] T016 [P1] Check if event status is 'active' - return error if not
- [ ] T017 [P1] Call closeEvent(eventId) to update database
- [ ] T018 [P1] Call updateChannelButtonsOnClose() to update message buttons
- [ ] T019 [P1] Post "Event Closed" announcement in channel
- [ ] T020 [P1] Send ephemeral confirmation to admin
- [ ] T021 [P1] Add error handling with try-catch
- [ ] T022 [P1] Test: Click Close Event button as admin (should work)
- [ ] T023 [P1] Test: Click Close Event button as non-admin (should fail)

#### Add Export Event Button Handler

- [ ] T024 [P1] Import generateExportData and formatAsCSV from exportService.js
- [ ] T025 [P1] Create handleExportEventButton() async function
- [ ] T026 [P1] Extract eventId from button customId
- [ ] T027 [P1] Defer reply (ephemeral: true)
- [ ] T028 [P1] Check if user isAdmin() - return error if not
- [ ] T029 [P1] Fetch event from database by eventId
- [ ] T030 [P1] Check if event status is 'closed' - return error if not
- [ ] T031 [P1] Call generateExportData(eventId)
- [ ] T032 [P1] Check if data exists - return error if empty
- [ ] T033 [P1] Call formatAsCSV(data)
- [ ] T034 [P1] Create Buffer and AttachmentBuilder
- [ ] T035 [P1] Send ephemeral reply with CSV attachment
- [ ] T036 [P1] Add error handling with try-catch
- [ ] T037 [P1] Test: Click Export button as admin (should work)
- [ ] T038 [P1] Test: Click Export button as non-admin (should fail)

#### Update Button Router

- [ ] T039 [P1] Add else-if for customId.startsWith('close_event_')
- [ ] T040 [P1] Call handleCloseEventButton(interaction)
- [ ] T041 [P1] Add else-if for customId.startsWith('export_event_')
- [ ] T042 [P1] Call handleExportEventButton(interaction)

**Files**: `src/handlers/buttonHandler.js`

---

### Update eventScheduler.js (45 minutes)

#### Update enableCheckInButton()

- [ ] T043 [P1] Create Close Event button component in enableCheckInButton()
- [ ] T044 [P1] Set Close Event button to enabled (Danger style)
- [ ] T045 [P1] Add Close Event button to second ActionRow
- [ ] T046 [P1] Update message with both ActionRows
- [ ] T047 [P1] Test: Wait for event start time, verify Close Event button appears

#### Update disableCheckOutButton()

- [ ] T048 [P1] Ensure Export button remains in message after 15 minutes
- [ ] T049 [P1] Set Export button to enabled (Secondary style)
- [ ] T050 [P1] Keep Export button in ActionRow after check-out disables
- [ ] T051 [P1] Test: Wait 15 minutes after close, verify Export button still visible

#### Create Helper Function for Button Updates

- [ ] T052 [P1] Create updateEventMessageButtons() helper function
- [ ] T053 [P1] Accept parameters: channel, eventId, status
- [ ] T054 [P1] Build appropriate button layout based on status
- [ ] T055 [P1] Reuse in enableCheckInButton(), updateChannelButtonsOnClose(), etc.

**Files**: `src/handlers/eventScheduler.js`

---

### Testing Phase 1 (30 minutes)

- [ ] T056 [P1] [T] Create test event with start time 2 minutes in future
- [ ] T057 [P1] [T] Verify initial buttons: Check-in (disabled), Close Event (disabled), Export (disabled)
- [ ] T058 [P1] [T] Wait for start time, verify Close Event button enables
- [ ] T059 [P1] [T] Admin clicks Close Event button
- [ ] T060 [P1] [T] Verify event closes, check-out enables, Export button appears
- [ ] T061 [P1] [T] Admin clicks Export CSV button
- [ ] T062 [P1] [T] Verify CSV file sent as ephemeral message
- [ ] T063 [P1] [T] Click Export button again, verify works multiple times
- [ ] T064 [P1] [T] Non-admin clicks Close Event button, verify error
- [ ] T065 [P1] [T] Non-admin clicks Export button, verify error
- [ ] T066 [P1] [T] Test slash commands still work (/close-event, /export-event)
- [ ] T067 [P1] [T] Wait 15 minutes after close, verify Export button still visible

**Checkpoint**: Phase 1 complete - buttons and commands both work ✅

---

## Phase 2: Remove Commands (Breaking Change)

**Goal**: Remove slash commands, make buttons the only way to close/export  
**Duration**: 30 minutes  
**Breaking Changes**: YES - removes `/close-event` and `/export-event`  
**Can Rollback**: Yes (but requires re-registering commands)

**⚠️ IMPORTANT**: Only do Phase 2 after testing Phase 1 for 1-2 weeks!

### Update commands.js (5 minutes)

- [ ] T068 [P2] Remove 'close-event' command object from commands array
- [ ] T069 [P2] Remove 'export-event' command object from commands array
- [ ] T070 [P2] Verify only 'create-event' command remains
- [ ] T071 [P2] Run `npm run register` to update Discord

**Files**: `commands.js`

---

### Update app.js (5 minutes)

- [ ] T072 [P2] Remove 'close-event' case block from interaction handler
- [ ] T073 [P2] Remove 'export-event' case block from interaction handler
- [ ] T074 [P2] Remove import for handleCloseEventCommand
- [ ] T075 [P2] Remove import for handleExportEventCommand
- [ ] T076 [P2] Verify app.js still runs without errors

**Files**: `app.js`

---

### Delete Deprecated Files (5 minutes)

- [ ] T077 [P2] Delete src/commands/closeEvent.js file
- [ ] T078 [P2] Delete src/commands/exportEvent.js file
- [ ] T079 [P2] Verify no other files import from deleted files
- [ ] T080 [P2] Restart bot and verify no import errors

**Files**: Delete `src/commands/closeEvent.js`, `src/commands/exportEvent.js`

---

### Update Documentation (15 minutes)

- [ ] T081 [P2] Update README.md "For Admins" section
- [ ] T082 [P2] Replace /close-event instructions with button instructions
- [ ] T083 [P2] Replace /export-event instructions with button instructions
- [ ] T084 [P2] Update command list to show only /create-event
- [ ] T085 [P2] Add note about button-based admin controls
- [ ] T086 [P2] Update specs/001-event-checkin/spec.md with Phase 2 note
- [ ] T087 [P2] Update IMPLEMENTATION-COMPLETE.md with Phase 2 status

**Files**: `README.md`, `specs/001-event-checkin/spec.md`, `IMPLEMENTATION-COMPLETE.md`

---

### Testing Phase 2 (10 minutes)

- [ ] T088 [P2] [T] Verify /close-event command no longer appears in Discord
- [ ] T089 [P2] [T] Verify /export-event command no longer appears in Discord
- [ ] T090 [P2] [T] Verify /create-event command still works
- [ ] T091 [P2] [T] Create event, verify all buttons work
- [ ] T092 [P2] [T] Close event with button (not command)
- [ ] T093 [P2] [T] Export with button (not command)
- [ ] T094 [P2] [T] Verify no errors in console

**Checkpoint**: Phase 2 complete - commands removed, buttons only ✅

---

## Task Summary

| Phase | Tasks | Duration | Status |
|-------|-------|----------|--------|
| Phase 1: Add Buttons | T001-T067 (67 tasks) | 2.5-3.5 hours | ✅ **COMPLETE** |
| Phase 2: Remove Commands | T068-T094 (27 tasks) | 30 minutes | ⏳ Blocked by P1 |
| **Total** | **94 tasks** | **3-4 hours** | **71% Complete** |

---

## Dependencies

### Phase 1 Dependencies
- ✅ Phase 1 of 001-event-checkin complete
- ✅ All existing services functional
- ✅ Discord.js v14 installed
- ✅ Event scheduler working

### Phase 2 Dependencies
- ⏳ Phase 1 complete and tested
- ⏳ User feedback positive
- ⏳ No critical bugs in buttons
- ⏳ 1-2 weeks of production use

---

## Execution Order

### Recommended Approach

1. **Complete Phase 1** (T001-T067)
   - Deploy to production
   - Monitor for 1-2 weeks
   - Gather user feedback
   - Fix any button-related bugs

2. **Evaluate Phase 2** (After 1-2 weeks)
   - Are buttons working well?
   - Do users prefer buttons over commands?
   - Any issues reported?

3. **Complete Phase 2** (T068-T094) - OPTIONAL
   - Only if buttons proven stable
   - Communicate change to users
   - Deploy during low-usage time

### Alternative: Phase 1 Only

If buttons work well but users also like commands:
- **Keep both buttons AND commands**
- Skip Phase 2 entirely
- Users can choose their preference

---

## Rollback Procedures

### Rollback Phase 1
```bash
# If buttons don't work, revert commits
git revert <commit-hash>
npm start
# Commands still work, no user impact
```

### Rollback Phase 2
```bash
# If need to restore commands:
git revert <commit-hash>
npm run register
npm start
# Commands restored within 1 hour
```

---

## Testing Checklist

### Phase 1 Testing
- [ ] Close Event button appears at correct times
- [ ] Close Event button has correct color (red/danger)
- [ ] Export button appears at correct times
- [ ] Export button has correct color (gray/secondary)
- [ ] Admin can click Close Event button
- [ ] Admin can click Export button
- [ ] Non-admin gets error on Close Event button
- [ ] Non-admin gets error on Export button
- [ ] Close Event button closes event correctly
- [ ] Export button generates CSV correctly
- [ ] Export sent as ephemeral (only admin sees)
- [ ] Export button works multiple times
- [ ] Slash commands still work
- [ ] Event scheduler updates buttons correctly
- [ ] No console errors

### Phase 2 Testing
- [ ] /close-event command removed from Discord
- [ ] /export-event command removed from Discord
- [ ] /create-event still works
- [ ] All buttons functional without commands
- [ ] Documentation updated
- [ ] No import errors
- [ ] No console errors

---

## Manual Test Script

### Phase 1 Test (15 minutes)

```
1. npm start
2. /create-event name:"Button Test" start-time:"[2 min from now]"
3. Verify buttons: Check-in (gray), Close Event (gray), Export (gray)
4. Wait 2 minutes
5. Verify buttons: Check-in (green), Close Event (red)
6. Admin clicks "Close Event" button
7. Verify event closes, announcement posted
8. Verify buttons: Check-in (gray), Check-out (blue), Export (gray)
9. Admin clicks "Export CSV" button
10. Verify CSV file sent (ephemeral - only admin sees)
11. Click "Export CSV" again - verify works
12. Non-admin clicks any admin button - verify error
13. Test /close-event command - should still work
14. Test /export-event command - should still work
```

### Phase 2 Test (5 minutes)

```
1. npm run register
2. npm start
3. Verify only /create-event shows in Discord
4. Create event with /create-event
5. Close with button (not command)
6. Export with button (not command)
7. Verify all works without commands
```

---

## Success Criteria

**Phase 1 Complete When:**
- [x] All 67 Phase 1 tasks complete
- [ ] All Phase 1 tests pass
- [ ] Buttons and commands both work
- [ ] No console errors
- [ ] Deployed to production
- [ ] Monitored for 1-2 weeks

**Phase 2 Complete When:**
- [x] All 27 Phase 2 tasks complete
- [ ] All Phase 2 tests pass
- [ ] Commands removed from Discord
- [ ] Buttons work without commands
- [ ] Documentation updated
- [ ] No user complaints

---

## Files Modified Summary

### Phase 1
- Modified: `src/commands/createEvent.js`
- Modified: `src/handlers/buttonHandler.js`
- Modified: `src/handlers/eventScheduler.js`

### Phase 2
- Modified: `commands.js`
- Modified: `app.js`
- Modified: `README.md`
- Deleted: `src/commands/closeEvent.js`
- Deleted: `src/commands/exportEvent.js`

---

## Quick Reference

### Button Custom IDs
```javascript
`checkin_${eventId}`       // Existing
`checkout_${eventId}`      // Existing
`close_event_${eventId}`   // NEW - Phase 1
`export_event_${eventId}`  // NEW - Phase 1
```

### Button Styles
```javascript
ButtonStyle.Success    // Check In (green)
ButtonStyle.Primary    // Check Out (blue)
ButtonStyle.Danger     // Close Event (red)
ButtonStyle.Secondary  // Export CSV (gray)
```

### Button States by Event Status
| Status | Check-in | Check-out | Close Event | Export CSV |
|--------|----------|-----------|-------------|------------|
| pending | Disabled | Hidden | Disabled | Disabled |
| active | Enabled | Hidden | Enabled | Hidden |
| closed | Disabled | Enabled | Hidden | Enabled |
| closed+15min | Disabled | Disabled | Hidden | Enabled |

---

**Last Updated**: 2025-12-22  
**Status**: Ready for Execution  
**Next Action**: Begin Phase 1 - Task T001

---

## Notes

- Phase 1 is safe to deploy (non-breaking)
- Phase 2 should wait for user feedback
- Consider keeping commands permanently if users prefer choice
- Export button stays visible forever after close (by design)
- Export can be clicked multiple times (by design)
- Admin buttons shown to everyone, permission checked on click
