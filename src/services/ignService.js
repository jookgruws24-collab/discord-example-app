import { supabase } from '../database/supabase.js';

/**
 * IGN Service
 * 
 * Handles all in-game name (IGN) operations for the Discord Event Check-In Bot.
 * Features:
 * - Validate IGN format and constraints
 * - Set/update IGN with UPSERT logic
 * - Get IGN for user in specific server
 * - Remove IGN from database
 * 
 * All operations are server-specific (guild_id scoped).
 */

// IGN validation pattern: letters, numbers, spaces, and ._- symbols only
const VALID_IGN_PATTERN = /^[a-zA-Z0-9\s._-]+$/;
const MAX_IGN_LENGTH = 32;

/**
 * Validate IGN format and constraints
 * 
 * @param {string} ign - In-game name to validate
 * @returns {Object} - { valid: boolean, ign?: string, error?: string }
 */
export function validateIgn(ign) {
  // Trim whitespace
  const trimmedIgn = ign.trim();
  
  // Check empty after trim
  if (trimmedIgn.length === 0) {
    return {
      valid: false,
      error: 'IGN cannot be empty or only whitespace',
    };
  }
  
  // Check length
  if (trimmedIgn.length > MAX_IGN_LENGTH) {
    return {
      valid: false,
      error: `IGN too long: ${trimmedIgn.length}/${MAX_IGN_LENGTH} characters`,
    };
  }
  
  // Check allowed characters
  if (!VALID_IGN_PATTERN.test(trimmedIgn)) {
    return {
      valid: false,
      error: 'IGN contains invalid characters. Allowed: letters, numbers, spaces, and ._- symbols',
    };
  }
  
  // All checks passed
  return {
    valid: true,
    ign: trimmedIgn,
  };
}

/**
 * Set or update user IGN (UPSERT operation)
 * 
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild/server ID
 * @param {string} ign - In-game name to set
 * @returns {Promise<Object>} - { success: boolean, data?: object, error?: string, message?: string }
 */
export async function setIgn(userId, guildId, ign) {
  try {
    console.log(`📝 Setting IGN for user ${userId} in guild ${guildId}: "${ign}"`);
    
    // Validate IGN format
    const validation = validateIgn(ign);
    if (!validation.valid) {
      console.log(`⚠️ IGN validation failed: ${validation.error}`);
      return {
        success: false,
        error: 'validation',
        message: validation.error,
      };
    }
    
    const validatedIgn = validation.ign;
    
    // UPSERT: Insert or update if exists
    const { data, error } = await supabase
      .from('user_igns')
      .upsert(
        {
          user_id: userId,
          guild_id: guildId,
          ign: validatedIgn,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,guild_id',
        }
      )
      .select()
      .single();
    
    if (error) {
      // Check for duplicate IGN (case-insensitive uniqueness violation)
      if (error.code === '23505') {
        console.log(`⚠️ IGN "${validatedIgn}" already taken in guild ${guildId}`);
        return {
          success: false,
          error: 'duplicate',
          message: `The IGN "${validatedIgn}" is already taken in this server. Please choose a different name.`,
        };
      }
      
      console.error('❌ Database error setting IGN:', error);
      return {
        success: false,
        error: 'database',
        message: 'Failed to save IGN. Please try again.',
      };
    }
    
    console.log(`✅ IGN set successfully: "${data.ign}"`);
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

/**
 * Get user IGN for specific server
 * 
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild/server ID
 * @returns {Promise<Object>} - { success: boolean, ign?: string, error?: string, message?: string }
 */
export async function getIgn(userId, guildId) {
  try {
    console.log(`🔍 Getting IGN for user ${userId} in guild ${guildId}`);
    
    const { data, error } = await supabase
      .from('user_igns')
      .select('ign')
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .single();
    
    if (error) {
      // No IGN found (not an error, just not set)
      if (error.code === 'PGRST116') {
        console.log(`ℹ️ No IGN set for user ${userId} in guild ${guildId}`);
        return {
          success: true,
          ign: null,
          error: 'not_found',
          message: 'You have not set your in-game name yet.',
        };
      }
      
      console.error('❌ Database error getting IGN:', error);
      return {
        success: false,
        error: 'database',
        message: 'Failed to retrieve IGN. Please try again.',
      };
    }
    
    console.log(`✅ IGN found: "${data.ign}"`);
    return {
      success: true,
      ign: data.ign,
    };
  } catch (err) {
    console.error('❌ Unexpected error getting IGN:', err);
    return {
      success: false,
      error: 'unexpected',
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Remove user IGN
 * 
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild/server ID
 * @returns {Promise<Object>} - { success: boolean, ign?: string, error?: string, message?: string }
 */
export async function removeIgn(userId, guildId) {
  try {
    console.log(`🗑️ Removing IGN for user ${userId} in guild ${guildId}`);
    
    // Check for active check-ins (user checked in but hasn't checked out)
    // Get all checkins for this user
    const { data: checkins, error: checkinError } = await supabase
      .from('checkins')
      .select('event_id')
      .eq('user_id', userId);
    
    if (checkinError) {
      console.error('❌ Database error checking checkins:', checkinError);
      return {
        success: false,
        error: 'database',
        message: 'Failed to verify check-in status. Please try again.',
      };
    }
    
    // Get all checkouts for this user
    const { data: checkouts, error: checkoutError } = await supabase
      .from('checkouts')
      .select('event_id')
      .eq('user_id', userId);
    
    if (checkoutError) {
      console.error('❌ Database error checking checkouts:', checkoutError);
      return {
        success: false,
        error: 'database',
        message: 'Failed to verify check-out status. Please try again.',
      };
    }
    
    // Find check-ins without corresponding check-outs (active check-ins)
    const checkoutEventIds = new Set(checkouts?.map(co => co.event_id) || []);
    const activeCheckIns = checkins?.filter(ci => !checkoutEventIds.has(ci.event_id)) || [];
    
    // Block removal if user has active check-ins
    if (activeCheckIns.length > 0) {
      console.log(`⚠️ Cannot remove IGN: User has ${activeCheckIns.length} active check-in(s)`);
      return {
        success: false,
        error: 'active_checkin',
        message: `You cannot remove your IGN while you are checked in to ${activeCheckIns.length} event(s). Please check out first.`,
        activeCheckIns: activeCheckIns.length,
      };
    }
    
    const { data, error } = await supabase
      .from('user_igns')
      .delete()
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .select('ign')
      .single();
    
    if (error) {
      // No IGN found to delete
      if (error.code === 'PGRST116') {
        console.log(`ℹ️ No IGN to remove for user ${userId} in guild ${guildId}`);
        return {
          success: true,
          error: 'not_found',
          message: 'You do not have an in-game name set in this server.',
        };
      }
      
      console.error('❌ Database error removing IGN:', error);
      return {
        success: false,
        error: 'database',
        message: 'Failed to remove IGN. Please try again.',
      };
    }
    
    console.log(`✅ IGN removed successfully: "${data.ign}"`);
    return {
      success: true,
      ign: data.ign,
    };
  } catch (err) {
    console.error('❌ Unexpected error removing IGN:', err);
    return {
      success: false,
      error: 'unexpected',
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}
