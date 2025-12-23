-- Migration 003: Add status tracking to checkins table
-- Purpose: Track completion status of check-ins for better monitoring and reporting
-- Status values:
--   - 'checked-in': User has checked in (default state)
--   - 'completed': User has both check-in and check-out records
--   - 'incomplete': Event closed but user never checked out

-- Add status column with default value
ALTER TABLE checkins 
ADD COLUMN status TEXT NOT NULL DEFAULT 'checked-in';

-- Add CHECK constraint for allowed status values
ALTER TABLE checkins
ADD CONSTRAINT checkins_status_check 
CHECK (status IN ('checked-in', 'completed', 'incomplete'));

-- Create index on status column for faster queries
CREATE INDEX idx_checkins_status ON checkins(status);

-- Update existing records based on checkout existence
-- Set status to 'completed' for check-ins that have corresponding check-outs
UPDATE checkins
SET status = 'completed'
WHERE EXISTS (
  SELECT 1 FROM checkouts
  WHERE checkouts.user_id = checkins.user_id
  AND checkouts.event_id = checkins.event_id
);

-- Set status to 'incomplete' for check-ins without check-outs in closed events
UPDATE checkins
SET status = 'incomplete'
WHERE status = 'checked-in'
AND EXISTS (
  SELECT 1 FROM events
  WHERE events.event_id = checkins.event_id
  AND events.status = 'closed'
);

-- Add comment to explain the column
COMMENT ON COLUMN checkins.status IS 'Check-in completion status: checked-in (active), completed (has check-out), incomplete (event closed without check-out)';
