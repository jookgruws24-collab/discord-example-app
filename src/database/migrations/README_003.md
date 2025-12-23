# Migration 003: Check-in Status Tracking

## Overview
Adds status tracking to check-in records for better completion monitoring and reporting.

## Database Changes

### New Column: `checkins.status`
- **Type**: `TEXT NOT NULL`
- **Default**: `'checked-in'`
- **Constraint**: CHECK constraint for allowed values
- **Index**: Created on `status` column for performance

### Status Values
| Status | Description | When Set |
|--------|-------------|----------|
| `checked-in` | User has checked in (default) | When user first checks in |
| `completed` | User has both check-in and check-out | When user checks out |
| `incomplete` | Event closed but user never checked out | When admin closes event |

## Code Changes

### 1. Check-in Creation (checkinService.js)
- Sets `status = 'checked-in'` when user checks in
- Default status for all new check-ins

### 2. Check-out Creation (checkoutService.js)
- Updates corresponding check-in `status = 'completed'` when user checks out
- Ensures completion tracking

### 3. Event Closure (eventService.js)
- Updates all check-ins with `status = 'checked-in'` to `'incomplete'`
- Only affects users who never checked out
- Returns count of incomplete check-ins

### 4. Export (exportService.js)
- Adds "Status" column to CSV export
- Shows status for each check-in record
- Empty for check-out-only records

### 5. Close Event UI (closeEvent.js)
- Shows attendance summary with status counts
- Calculates completion rate: `completed / (completed + incomplete) × 100%`
- Displays in admin confirmation message

## Migration Steps

1. **Run Migration SQL**:
   ```bash
   node src/database/runMigrations.js
   ```

2. **Verify Schema**:
   - Check `checkins` table has `status` column
   - Verify CHECK constraint exists
   - Confirm index created

3. **Verify Data**:
   - Existing records updated based on checkout existence
   - Records with checkouts marked as `'completed'`
   - Records in closed events without checkouts marked as `'incomplete'`
   - New records default to `'checked-in'`

## Example Output

### Close Event Summary
```
✅ Event "Team Meeting" has been closed!

📋 Check-in is now disabled
🚪 Check-out is now enabled for the next 15 minutes
⏰ Check-out will automatically disable after 15 minutes

📊 Attendance Summary:
• Total Check-ins: 25
• Completed (with check-out): 22
• Incomplete (no check-out): 3
• Completion Rate: 88.0%
```

### CSV Export
```csv
User ID,Username,Discriminator,IGN,Status,Check-In Time,Check-Out Time
123456789,JohnDoe,0,ProGamer,completed,2025-12-23 10:00:00,2025-12-23 12:00:00
987654321,JaneSmith,0,ElitePlayer,incomplete,2025-12-23 10:05:00,
```

## Benefits

1. **Completion Monitoring**: Track which users completed their check-in/check-out cycle
2. **Data Quality**: Identify incomplete records for follow-up
3. **Reporting**: Calculate attendance completion rates
4. **Analytics**: Better insights into user behavior
5. **Audit Trail**: Historical status preserved in exports

## Backwards Compatibility

- ✅ Existing check-ins automatically updated during migration
- ✅ No breaking changes to existing functionality
- ✅ Default value ensures new records always have status
- ✅ Migration handles both active and closed events

## Testing Checklist

- [ ] New check-ins have status `'checked-in'`
- [ ] Check-out updates status to `'completed'`
- [ ] Event closure marks remaining as `'incomplete'`
- [ ] CSV export includes Status column
- [ ] Close event shows attendance summary
- [ ] Completion rate calculates correctly
- [ ] Migration updates existing records properly

## Rollback

If needed, to rollback:
```sql
-- Remove index
DROP INDEX IF EXISTS idx_checkins_status;

-- Remove constraint
ALTER TABLE checkins DROP CONSTRAINT IF EXISTS checkins_status_check;

-- Remove column
ALTER TABLE checkins DROP COLUMN IF EXISTS status;
```

⚠️ **Warning**: Rollback will lose all status data.
