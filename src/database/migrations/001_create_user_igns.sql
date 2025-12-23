-- Migration: Create user_igns table
-- Purpose: Store user in-game names (IGN) with server-specific scoping
-- Features:
--   - Composite PK (user_id, guild_id) ensures one IGN per user per server
--   - Case-insensitive uniqueness constraint per server
--   - Character validation and length constraints
--   - Automatic timestamp tracking

CREATE TABLE IF NOT EXISTS user_igns (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  ign TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Composite primary key: one IGN per user per server
  PRIMARY KEY (user_id, guild_id),
  
  -- Validation constraints
  CHECK (LENGTH(ign) BETWEEN 1 AND 32),
  CHECK (ign ~ '^[a-zA-Z0-9\s._-]+$')
);

-- Case-insensitive uniqueness index per server
-- Prevents "Player" and "player" from both existing in the same server
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_igns_ign_guild 
ON user_igns (LOWER(ign), guild_id);

-- Performance optimization for lookups
CREATE INDEX IF NOT EXISTS idx_user_igns_lookup 
ON user_igns (user_id, guild_id);

-- Comments for database documentation
COMMENT ON TABLE user_igns IS 'User in-game names (IGN) scoped per Discord server';
COMMENT ON COLUMN user_igns.user_id IS 'Discord user ID (snowflake as string)';
COMMENT ON COLUMN user_igns.guild_id IS 'Discord guild/server ID (snowflake as string)';
COMMENT ON COLUMN user_igns.ign IS 'In-game name (1-32 characters, alphanumeric + spaces + ._-)';
COMMENT ON COLUMN user_igns.updated_at IS 'Last update timestamp (automatically set on INSERT/UPDATE)';
