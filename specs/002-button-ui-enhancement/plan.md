# Implementation Plan: Button UI Enhancement

**Branch**: `002-button-ui-enhancement`  
**Date**: 2025-12-22  
**Status**: Draft - Planning Phase  
**Parent Spec**: [spec.md](./spec.md)

---

## Summary

Convert `/close-event` and `/export-event` slash commands to Discord buttons that appear contextually in event channels. The Close Event button appears when event starts (active state), and the Export CSV button appears after event closes.

---

## Technical Context

**Language/Version**: Node.js 18.x (ES Modules)  
**Primary Dependencies**: discord.js v14.x (already installed)  
**Database**: No schema changes required  
**Existing Files to Modify**: 7 files  
**New Files**: None  
**Testing**: Manual testing via Discord client

---

## Project Structure

```
discord-example-app/
├── src/
│   ├── commands/
│   │   ├── createEvent.js         # UPDATE: Add Close/Export buttons
│   │   ├── closeEvent.js          # DEPRECATE: Move logic to buttonHandler
│   │   └── exportEvent.js         # DEPRECATE: Move logic to buttonHandler
│   ├── handlers/
│   │   ├── buttonHandler.js       # UPDATE: Add close/export handlers
│   │   └── eventScheduler.js      # UPDATE: Show/hide admin buttons
│   └── config/
│       └── permissions.js         # NO CHANGE: Reuse existing
├── app.js                         # UPDATE: Remove command routing
├── commands.js                    # UPDATE: Remove command registration
└── specs/
    └── 002-button-ui-enhancement/
        ├── spec.md                # ✅ Complete
        ├── plan.md                # 📝 This file
        └── tasks.md               # 📋 Next to create
```

---

## Implementation Strategy

### Approach: Incremental Migration

**Phase 1**: Add buttons alongside existing commands (non-breaking)  
**Phase 2**: Remove slash commands (breaking change)

This allows testing buttons before removing commands.

---

## Technical Design

### Button Custom IDs

```javascript
// Format: <action>_<eventId>
checkin_<uuid>        // Existing
checkout_<uuid>       // Existing
close_event_<uuid>    // NEW
export_event_<uuid>   // NEW
```

### Button Layouts by State

#### State 1: Pending (Before Start)
```javascript
// ActionRow 1
[Button: Check In (disabled)]
```

#### State 2: Active (After Start)
```javascript
// ActionRow 1
[Button: Check In (enabled)]
// ActionRow 2 (admin only)
[Button: Close Event (danger)]
```

#### State 3: Closed (Admin Closed)
```javascript
// ActionRow 1
[Button: Check In (disabled)]
[Button: Check Out (primary)]
// ActionRow 2 (admin only)
[Button: Export CSV (secondary)]
```

#### State 4: Check-out Window Closed (15 min elapsed)
```javascript
// ActionRow 1
[Button: Check In (disabled)]
[Button: Check Out (disabled)]
// ActionRow 2 (admin only)
[Button: Export CSV (secondary)]
```

### Permission Checking Strategy

**Option 1: Client-side (Recommended)**
- Show admin buttons to everyone
- Check permissions on click
- Show error if non-admin clicks

**Pros**: Simpler implementation, Discord handles button visibility  
**Cons**: Non-admins see buttons they can't use

**Option 2: Message-level permissions**
- Discord doesn't support per-button permissions
- Would require separate messages for admin-only buttons
- More complex to maintain

**Decision**: Use Option 1 - validate on click

---

## Key Changes by File

### 1. src/commands/createEvent.js

**Changes:**
- Add Close Event button to initial message (disabled)
- Add Export button to initial message (hidden)
- Both buttons in a second ActionRow

**Before:**
```javascript
const row = new ActionRowBuilder().addComponents(checkInButton);
await channel.send({ content: '...', components: [row] });
```

**After:**
```javascript
const row1 = new ActionRowBuilder().addComponents(checkInButton);
const row2 = new ActionRowBuilder().addComponents(closeButton, exportButton);
await channel.send({ content: '...', components: [row1, row2] });
```

---

### 2. src/handlers/buttonHandler.js

**New Functions:**

```javascript
async function handleCloseEventButton(interaction) {
  // 1. Check admin permissions
  // 2. Get event from database
  // 3. Verify event is active
  // 4. Close event (update status)
  // 5. Update message buttons
  // 6. Post announcement
  // 7. Send confirmation
}

async function handleExportEventButton(interaction) {
  // 1. Check admin permissions
  // 2. Get event from database
  // 3. Verify event is closed
  // 4. Generate CSV data
  // 5. Send ephemeral message with file
}
```

**Router Update:**
```javascript
export async function handleButtonInteraction(interaction) {
  const { customId } = interaction;
  
  if (customId.startsWith('checkin_')) {
    await handleCheckInButton(interaction);
  } else if (customId.startsWith('checkout_')) {
    await handleCheckOutButton(interaction);
  } else if (customId.startsWith('close_event_')) {
    await handleCloseEventButton(interaction);
  } else if (customId.startsWith('export_event_')) {
    await handleExportEventButton(interaction);
  }
}
```

---

### 3. src/handlers/eventScheduler.js

**Changes to `enableCheckInButton()`:**
```javascript
async function enableCheckInButton(channel, eventId) {
  // Find event message
  // Update to:
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`checkin_${eventId}`)
      .setLabel('Check In')
      .setStyle(ButtonStyle.Success)
      .setDisabled(false)
  );
  
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`close_event_${eventId}`)
      .setLabel('🚪 Close Event')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(false)
  );
  
  await eventMessage.edit({ components: [row1, row2] });
}
```

**Changes to `disableCheckOutButton()`:**
```javascript
async function disableCheckOutButton(channel, eventId) {
  // Keep export button enabled
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`export_event_${eventId}`)
      .setLabel('📊 Export CSV')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false) // Still enabled
  );
}
```

---

### 4. app.js

**Phase 1 (Keep Commands):**
- No changes required
- Commands and buttons coexist

**Phase 2 (Remove Commands):**
```javascript
// DELETE these case blocks:
case 'close-event':
  await handleCloseEventCommand(interaction);
  break;

case 'export-event':
  await handleExportEventCommand(interaction);
  break;
```

---

### 5. commands.js

**Phase 1 (Keep Commands):**
- No changes required

**Phase 2 (Remove Commands):**
```javascript
const commands = [
  {
    name: 'create-event',
    description: 'Create a new event with check-in tracking (Admin only)',
    options: [...],
  },
  // DELETE close-event command object
  // DELETE export-event command object
];
```

---

## Code Reuse Strategy

### Close Event Logic

**Source**: `src/commands/closeEvent.js`  
**Target**: `src/handlers/buttonHandler.js`

**Reusable Functions:**
- `closeEvent()` from eventService - already exists ✅
- `updateChannelButtonsOnClose()` - move to shared utility
- Admin permission check - use existing `isAdmin()` ✅

### Export Event Logic

**Source**: `src/commands/exportEvent.js`  
**Target**: `src/handlers/buttonHandler.js`

**Reusable Functions:**
- `generateExportData()` from exportService - already exists ✅
- `formatAsCSV()` from exportService - already exists ✅
- `getEventByChannelId()` from eventService - already exists ✅
- Admin permission check - use existing `isAdmin()` ✅

**Key Change**: Send CSV as **ephemeral** instead of regular reply:
```javascript
await interaction.reply({
  content: '✅ Export complete!',
  files: [attachment],
  ephemeral: true, // Only admin sees this
});
```

---

## Migration Path

### Phase 1: Add Buttons (Breaking: No)

**Duration**: 2-3 hours  
**Testing**: Can test buttons while commands still work  
**Rollback**: Easy - just revert commits

**Steps:**
1. Update createEvent.js to include new buttons
2. Add button handlers to buttonHandler.js
3. Update eventScheduler to show/hide buttons
4. Test with commands still working
5. Get user feedback

### Phase 2: Remove Commands (Breaking: Yes)

**Duration**: 30 minutes  
**Testing**: Verify buttons work without commands  
**Rollback**: Harder - commands removed from Discord

**Steps:**
1. Remove command registration from commands.js
2. Remove command handlers from app.js
3. Run `npm run register` to update Discord
4. Delete closeEvent.js and exportEvent.js files
5. Update README.md documentation

**Recommendation**: Wait 1-2 weeks between Phase 1 and Phase 2 to ensure buttons work correctly.

---

## Testing Strategy

### Unit Testing (Manual)

**Test 1: Close Event Button Visibility**
- Create event with future start time
- Verify Close Event button is hidden/disabled
- Wait for start time
- Verify Close Event button appears and is enabled
- Admin closes event
- Verify Close Event button disappears

**Test 2: Export Button Visibility**
- Create event
- Verify Export button is hidden
- Close event
- Verify Export button appears
- Wait 15 minutes
- Verify Export button still visible

**Test 3: Close Event Functionality**
- Create active event
- Admin clicks Close Event button
- Verify event closes
- Verify check-out enables
- Verify announcement posted
- Verify database updated

**Test 4: Export Functionality**
- Create event with attendance data
- Close event
- Admin clicks Export CSV button
- Verify CSV file sent as ephemeral message
- Verify only admin sees the file
- Click button again - verify works multiple times

**Test 5: Non-Admin Protection**
- Create active event
- Non-admin clicks Close Event button
- Verify error message shown
- Non-admin clicks Export button
- Verify error message shown

---

## Edge Cases to Handle

1. **Bot restart during active event**
   - Event scheduler should restore button states
   - Test: Restart bot, verify buttons correct

2. **Admin clicks Close Event twice**
   - Should show "already closed" error
   - Should not duplicate database entries

3. **Export with no attendance data**
   - Should show "no data to export" message
   - Should not create empty CSV

4. **Event message deleted**
   - Buttons won't work (expected)
   - Document this limitation

5. **Multiple admins clicking simultaneously**
   - Database handles concurrent updates
   - Test: Two admins click Close Event at same time

---

## Performance Considerations

### Button Updates
- Each state change requires message edit
- Discord API rate limit: 5 updates per 5 seconds per channel
- Current design: ~3-4 updates per event lifecycle
- **No performance issues expected**

### Export Button Spam
- Admin could click Export button repeatedly
- Each click generates CSV and sends file
- **Mitigation**: Add cooldown or show warning
- **Decision**: Allow multiple exports (use case: re-download)

---

## Rollback Plan

### If Phase 1 Fails (Buttons Don't Work)
1. Revert commits
2. Commands still work
3. No user impact

### If Phase 2 Fails (After Removing Commands)
1. Re-add commands to commands.js
2. Re-add handlers to app.js
3. Run `npm run register`
4. Redeploy
5. Commands restored within 1 hour (Discord cache)

---

## Success Metrics

- [ ] Close Event button appears at correct times
- [ ] Export button appears at correct times
- [ ] Non-admins cannot use admin buttons
- [ ] Close Event button closes events correctly
- [ ] Export button generates CSV correctly
- [ ] Export CSV sent as ephemeral (private to admin)
- [ ] Export button works multiple times
- [ ] Event scheduler updates buttons correctly
- [ ] No console errors
- [ ] User feedback positive

---

## Documentation Updates Required

1. **README.md**
   - Update "For Admins" section
   - Replace command instructions with button instructions
   - Add screenshots (optional)

2. **specs/001-event-checkin/spec.md**
   - Add note about Phase 2 enhancement
   - Link to 002-button-ui-enhancement

3. **IMPLEMENTATION-COMPLETE.md**
   - Add Phase 2 completion status (after implementation)

---

## Dependencies

**Required:**
- Phase 1 of 001-event-checkin must be complete ✅
- All existing services functional ✅
- Discord.js v14 installed ✅

**No New Dependencies Required**

---

## Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Button state desync after bot restart | Medium | Low | Event scheduler recovers state on startup |
| Non-admin sees admin buttons | Low | High | Expected - validate on click |
| Discord API rate limit | Low | Low | Few updates per event |
| Users prefer slash commands | Medium | Low | Keep commands in Phase 1, gather feedback |

---

## Timeline

**Phase 1: Add Buttons**
- Development: 2-3 hours
- Testing: 1 hour
- Deploy & Monitor: 1-2 days

**Phase 2: Remove Commands** (Optional)
- Wait period: 1-2 weeks (gather feedback)
- Development: 30 minutes
- Testing: 30 minutes
- Deploy: 1 day

**Total**: 3-4 hours development, 2+ weeks total timeline

---

## Next Steps

1. ✅ Create spec.md - COMPLETE
2. ✅ Create plan.md - COMPLETE (this file)
3. 📋 Create tasks.md - NEXT
4. 🔨 Implement Phase 1
5. 🧪 Test Phase 1
6. 📊 Gather feedback (1-2 weeks)
7. 🔨 Implement Phase 2 (if approved)

---

**Status**: Ready for task breakdown  
**Estimated Effort**: 3-4 hours development  
**Breaking Changes**: Phase 2 only (removable of commands)  
**Database Changes**: None
