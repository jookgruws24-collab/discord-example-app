-- Migration: Add IGN column to checkins table
-- Purpose: Store IGN snapshot at time of check-in for historical accuracy
-- Features:
--   - IGN field captures user's display name at check-in time
--   - NULLABLE for backward compatibility with pre-IGN records
--   - Application enforces IGN requirement for all new check-ins
--   - No JOIN needed at export time (performance optimization)

-- Add ign column to existing checkins table
ALTER TABLE checkins 
ADD COLUMN IF NOT EXISTS ign TEXT NULL;

-- Optional: Add index for export queries that filter by IGN
CREATE INDEX IF NOT EXISTS idx_checkins_ign 
ON checkins (event_id, ign) 
WHERE ign IS NOT NULL;

-- Comments for database documentation
COMMENT ON COLUMN checkins.ign IS 'Snapshot of user IGN at check-in time (NULL for pre-IGN records)';
