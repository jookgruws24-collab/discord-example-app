# Feature Specification: Replace Slash Commands with Buttons

**Feature**: Convert `/close-event` and `/export-event` from slash commands to buttons  
**Date**: 2025-12-22  
**Status**: Draft  
**Priority**: Enhancement  

---

## Summary

Replace the slash commands `/close-event` and `/export-event` with Discord buttons that appear automatically in event channels. The buttons will have visibility rules based on event state.

---

## Current Behavior

**Close Event:**
- Admin runs `/close-event` slash command in event channel
- Event closes, check-in disables, check-out enables

**Export Event:**
- Admin runs `/export-event` slash command in event channel
- CSV file is generated and sent as attachment

---

## New Behavior

### Close Event Button

**Button Appearance:**
- Button label: "🚪 Close Event"
- Button style: Red/Danger
- Button position: Below check-in button in event message

**Visibility Rules:**
- **Show when:** Event status is "active" (event has started)
- **Hide when:** Event status is "pending" or "closed"
- **Permission:** Admin only (non-admins cannot see or click)

**Behavior:**
- Admin clicks "🚪 Close Event" button
- Event status changes to "closed"
- Check-in button disables
- Check-out button enables
- Close Event button disappears
- Export button appears
- Bot posts "Event Closed" announcement

---

### Export Event Button

**Button Appearance:**
- Button label: "📊 Export CSV"
- Button style: Gray/Secondary
- Button position: Below check-out button in event message

**Visibility Rules:**
- **Show when:** Event status is "closed" (after admin closes event)
- **Hide when:** Event status is "pending" or "active"
- **Permission:** Admin only (non-admins cannot see or click)

**Behavior:**
- Admin clicks "📊 Export CSV" button
- CSV file is generated
- File is sent as ephemeral message (only admin sees it)
- Button remains visible for future exports
- Can be clicked multiple times

---

## Button Layout Examples

### When Event is Pending (Before Start Time)
```
┌─────────────────────────────────┐
│ Event: Team Meeting             │
│ Starts in 5 minutes             │
│                                 │
│ [ Check In ] (disabled/gray)    │
└─────────────────────────────────┘
```

### When Event is Active (After Start Time)
```
┌─────────────────────────────────┐
│ Event: Team Meeting             │
│ Check-in is now available!      │
│                                 │
│ [ Check In ] (green/enabled)    │
│ [ 🚪 Close Event ] (red/admin)  │
└─────────────────────────────────┘
```

### When Event is Closed
```
┌─────────────────────────────────┐
│ Event: Team Meeting             │
│ Event has been closed           │
│                                 │
│ [ Check In ] (gray/disabled)    │
│ [ Check Out ] (blue/enabled)    │
│ [ 📊 Export CSV ] (gray/admin)  │
└─────────────────────────────────┘
```

### After 15 Minutes (Check-out Closed)
```
┌─────────────────────────────────┐
│ Event: Team Meeting             │
│ Check-out window has closed     │
│                                 │
│ [ Check In ] (gray/disabled)    │
│ [ Check Out ] (gray/disabled)   │
│ [ 📊 Export CSV ] (gray/admin)  │
└─────────────────────────────────┘
```

---

## Technical Changes Required

### Files to Modify

1. **src/commands/createEvent.js**
   - Add "Close Event" button to initial message (disabled)
   - Button: `close_event_{eventId}`

2. **src/commands/closeEvent.js**
   - Convert to button handler function
   - Move logic to `src/handlers/buttonHandler.js`
   - Keep admin permission check

3. **src/commands/exportEvent.js**
   - Convert to button handler function  
   - Move logic to `src/handlers/buttonHandler.js`
   - Keep admin permission check
   - Send CSV as ephemeral message

4. **src/handlers/buttonHandler.js**
   - Add `handleCloseEventButton()` function
   - Add `handleExportEventButton()` function
   - Add button routing for `close_event_` and `export_event_`

5. **src/handlers/eventScheduler.js**
   - When enabling check-in (event starts):
     - Show "Close Event" button
   - When disabling check-out (15 min elapsed):
     - Keep "Export" button visible

6. **commands.js**
   - Remove `/close-event` command registration
   - Remove `/export-event` command registration
   - Keep only `/create-event`

7. **app.js**
   - Remove `/close-event` command handler routing
   - Remove `/export-event` command handler routing

---

## Button Permissions

### Admin Detection
- Use existing `isAdmin()` function from `src/config/permissions.js`
- Check on button click, not on button display
- If non-admin clicks admin button → error message

### Non-Admin Experience
- Non-admins see only: Check In, Check Out buttons
- Admin buttons are visible but **disabled** for non-admins
- OR admin buttons are completely hidden (recommend hidden)

**Recommended:** Hide admin buttons completely from non-admins using Discord's permission system isn't possible, so validate on click and show error.

---

## Button States

### Close Event Button States
| Event Status | Button State | Visible To |
|-------------|--------------|------------|
| pending     | Hidden       | -          |
| active      | Enabled/Red  | Admins     |
| closed      | Hidden       | -          |

### Export Button States
| Event Status | Button State | Visible To |
|-------------|--------------|------------|
| pending     | Hidden       | -          |
| active      | Hidden       | -          |
| closed      | Enabled/Gray | Admins     |

---

## Error Handling

### Close Event Button Errors
- Non-admin clicks: "❌ Only admins can close events"
- Event already closed: "⚠️ This event is already closed"
- Database error: "❌ Failed to close event. Please try again."

### Export Button Errors
- Non-admin clicks: "❌ Only admins can export data"
- No attendance data: "⚠️ No data to export yet"
- Database error: "❌ Failed to generate export. Please try again."

---

## Benefits

✅ **Better UX:** No need to remember slash commands  
✅ **Contextual:** Buttons appear when relevant  
✅ **Clearer:** Visual state shows what actions are available  
✅ **Safer:** Admins can't accidentally close wrong event  
✅ **Simpler:** Fewer commands to manage  

---

## Migration Notes

- Existing slash commands remain functional during transition
- Can deploy buttons first, remove commands later
- Update README.md and documentation
- No database schema changes needed

---

## Acceptance Criteria

- [ ] Close Event button appears when event starts (status: active)
- [ ] Close Event button disappears after event closed
- [ ] Export button appears after event closed
- [ ] Export button remains visible permanently after close
- [ ] Non-admins cannot click admin buttons (error message shown)
- [ ] Close Event button closes event and updates all button states
- [ ] Export button generates CSV and sends as ephemeral message
- [ ] Export button can be clicked multiple times
- [ ] All button interactions work without slash commands
- [ ] Slash commands removed from Discord (commands.js updated)

---

## User Stories

### US: Admin Closes Event with Button
**As an** admin  
**I want to** click a "Close Event" button in the event channel  
**So that** I can quickly close the event without typing a command

**Acceptance:**
- Button visible when event is active
- Button closes event on click
- Check-out becomes available
- Export button appears

### US: Admin Exports Data with Button
**As an** admin  
**I want to** click an "Export CSV" button in the event channel  
**So that** I can download attendance data without typing a command

**Acceptance:**
- Button visible after event closed
- Button generates CSV on click
- CSV sent as private message (ephemeral)
- Button remains clickable for re-export

---

## Implementation Plan

### Phase 1: Add Buttons (Keep Commands)
1. Add Close Event button to initial message (hidden/disabled)
2. Add Export button to initial message (hidden)
3. Implement button handlers in buttonHandler.js
4. Update eventScheduler to show/hide buttons
5. Test buttons work alongside commands

### Phase 2: Remove Commands (After Testing)
1. Remove command registrations from commands.js
2. Remove command handlers from app.js
3. Delete closeEvent.js and exportEvent.js files
4. Update README.md documentation
5. Run `npm run register` to update Discord

---

**Status**: Ready for implementation  
**Estimated Time**: 2-3 hours  
**Breaking Changes**: Yes - removes two slash commands
