import { supabase } from '../database/supabase.js';

/**
 * Export Service
 * 
 * Handles event data export functionality.
 * Features:
 * - Query all check-ins and check-outs for an event
 * - Format data as CSV with proper headers
 * - Handle missing check-out data gracefully
 * - Generate downloadable CSV file
 */

/**
 * Generate export data for an event
 * Joins check-ins with check-outs by event_id and user_id
 * 
 * @param {string} eventId - UUID of the event
 * @returns {Promise<Object>} - Export data or error
 */
export async function generateExportData(eventId) {
  try {
    console.log(`📊 Generating export data for event ${eventId}`);
    
    // Get all check-ins and check-outs for the event
    const { data: checkIns, error: checkInError } = await supabase
      .from('checkins')
      .select('*')
      .eq('event_id', eventId)
      .order('timestamp', { ascending: true });
    
    if (checkInError) {
      console.error('❌ Error fetching check-ins:', checkInError);
      return {
        success: false,
        error: 'database',
        message: 'Failed to fetch check-in data.',
      };
    }
    
    // Get all check-outs for the event
    const { data: checkOuts, error: checkOutError } = await supabase
      .from('checkouts')
      .select('*')
      .eq('event_id', eventId);
    
    if (checkOutError) {
      console.error('❌ Error fetching check-outs:', checkOutError);
      return {
        success: false,
        error: 'database',
        message: 'Failed to fetch check-out data.',
      };
    }
    
    // Create a map of check-outs by user_id for quick lookup
    const checkOutMap = new Map();
    (checkOuts || []).forEach(checkout => {
      checkOutMap.set(checkout.user_id, checkout);
    });
    
    // Merge check-ins with check-outs
    const mergedData = (checkIns || []).map(checkIn => {
      const checkOut = checkOutMap.get(checkIn.user_id);
      
      return {
        userId: checkIn.user_id,
        username: checkIn.username,
        discriminator: checkIn.discriminator || '',
        ign: checkIn.ign || '', // IGN from check-in snapshot (NULL for pre-IGN records)
        status: checkIn.status || 'checked-in', // Status tracking
        checkInTime: checkIn.timestamp,
        checkOutTime: checkOut ? checkOut.timestamp : null,
      };
    });
    
    // Check for users who checked out but didn't check in (per FR-013)
    checkOutMap.forEach((checkOut, userId) => {
      const hasCheckIn = mergedData.some(row => row.userId === userId);
      if (!hasCheckIn) {
        mergedData.push({
          userId: userId,
          username: '', // Username not available for check-out-only records
          discriminator: '',
          ign: '', // IGN not available for check-out-only records
          status: '', // No status for check-out-only records
          checkInTime: null,
          checkOutTime: checkOut.timestamp,
        });
      }
    });
    
    console.log(`✅ Generated ${mergedData.length} rows of export data`);
    
    return {
      success: true,
      data: mergedData,
    };
  } catch (err) {
    console.error('❌ Unexpected error generating export data:', err);
    return {
      success: false,
      error: 'unexpected',
      message: 'An unexpected error occurred while generating export data.',
    };
  }
}

/**
 * Format data as CSV string
 * 
 * @param {Array} data - Array of merged check-in/check-out records
 * @returns {string} - CSV formatted string
 */
export function formatAsCSV(data) {
  // CSV Headers - includes IGN and Status columns
  const headers = ['User ID', 'Username', 'Discriminator', 'IGN', 'Status', 'Check-In Time', 'Check-Out Time'];
  
  // Format header row
  const csvRows = [headers.join(',')];
  
  // Format data rows
  data.forEach(row => {
    const csvRow = [
      escapeCSVField(row.userId),
      escapeCSVField(row.username),
      escapeCSVField(row.discriminator),
      escapeCSVField(row.ign), // IGN column (empty string for NULL/pre-IGN records)
      escapeCSVField(row.status), // Status column
      row.checkInTime ? formatTimestamp(row.checkInTime) : '',
      row.checkOutTime ? formatTimestamp(row.checkOutTime) : '',
    ];
    
    csvRows.push(csvRow.join(','));
  });
  
  return csvRows.join('\n');
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 * 
 * @param {string} field - Field value
 * @returns {string} - Escaped field value
 */
function escapeCSVField(field) {
  if (!field) return '';
  
  const fieldStr = String(field);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
    return `"${fieldStr.replace(/"/g, '""')}"`;
  }
  
  return fieldStr;
}

/**
 * Format ISO timestamp for CSV (human-readable)
 * Shows time in UTC+7 timezone
 * 
 * @param {string} isoTimestamp - ISO 8601 timestamp
 * @returns {string} - Formatted timestamp in UTC+7
 */
function formatTimestamp(isoTimestamp) {
  const date = new Date(isoTimestamp);
  
  // Format in UTC+7 timezone: YYYY-MM-DD HH:MM:SS
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Bangkok', // UTC+7
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/(\d+)\/(\d+)\/(\d+),\s+(\d+):(\d+):(\d+)/, '$3-$1-$2 $4:$5:$6');
}

/**
 * Get event name by event ID
 * 
 * @param {string} eventId - UUID of the event
 * @returns {Promise<string|null>} - Event name or null
 */
export async function getEventName(eventId) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('event_name')
      .eq('event_id', eventId)
      .single();
    
    if (error) {
      console.error('❌ Error fetching event name:', error);
      return null;
    }
    
    return data?.event_name || null;
  } catch (err) {
    console.error('❌ Unexpected error fetching event name:', err);
    return null;
  }
}

export default {
  generateExportData,
  formatAsCSV,
  getEventName,
};
