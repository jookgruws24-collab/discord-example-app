import { supabase } from '../database/supabase.js';
import { createCheckIn, postCheckInAnnouncement } from '../services/checkinService.js';
import { createCheckOut, isCheckOutWindowOpen } from '../services/checkoutService.js';
import { isAdmin } from '../config/permissions.js';
import { closeEvent, getEventByChannelId } from '../services/eventService.js';
import { generateExportData, formatAsCSV } from '../services/exportService.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';

/**
 * Button Handler
 * 
 * Handles button interactions for check-in and check-out.
 * Routes button clicks to appropriate service handlers.
 */

/**
 * Handle check-in button interaction
 * 
 * @param {Object} interaction - Discord button interaction
 * @returns {Promise<void>}
 */
export async function handleCheckInButton(interaction) {
  try {
    // Parse event ID from button custom ID (format: checkin_<event_id>)
    const eventId = interaction.customId.split('_')[1];
    
    if (!eventId) {
      console.error('❌ Invalid check-in button custom ID:', interaction.customId);
      await interaction.reply({
        content: '❌ Invalid check-in button. Please contact an admin.',
        ephemeral: true,
      });
      return;
    }
    
    console.log(`🔘 Check-in button clicked by ${interaction.user.tag} for event ${eventId}`);
    
    // Defer reply (check-in may take a moment)
    await interaction.deferReply({ ephemeral: true });
    
    // Get event from database
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .single();
    
    if (eventError || !event) {
      console.error('❌ Event not found:', eventId);
      await interaction.editReply({
        content: '❌ Event not found. It may have been deleted.',
      });
      return;
    }
    
    // SECURITY: Validate interaction channel matches event channel
    if (interaction.channelId !== event.channel_id) {
      console.warn(`⚠️ Security: User ${interaction.user.tag} attempted to use check-in button from wrong channel`);
      await interaction.editReply({
        content: '❌ This button can only be used in the event channel.',
      });
      return;
    }
    
    // Check if event has started
    const now = new Date();
    const startTime = new Date(event.start_time);
    
    if (now < startTime) {
      const timeUntilStart = Math.ceil((startTime - now) / 1000 / 60); // minutes
      await interaction.editReply({
        content: `⏰ Check-in is not available yet. Event starts in ${timeUntilStart} minute(s).`,
      });
      return;
    }
    
    // Check if event is still active
    if (event.status === 'closed') {
      await interaction.editReply({
        content: '🚫 This event has been closed. Check-in is no longer available.',
      });
      return;
    }
    
    // Create check-in record (with mandatory IGN validation)
    const result = await createCheckIn(eventId, interaction.guildId, interaction.user);
    
    if (!result.success) {
      // Handle no IGN set (mandatory requirement)
      if (result.error === 'no_ign') {
        await interaction.editReply({
          content: '❌ **In-Game Name Required**\n\n' +
                   'You must set your in-game name before checking in to events.\n\n' +
                   '**How to set your IGN:**\n' +
                   '1. Use the `/set-ign` command\n' +
                   '2. Enter your in-game name\n' +
                   '3. Try checking in again\n\n' +
                   '_Your IGN will be displayed when you check in._',
        });
        return;
      }
      
      // Handle duplicate check-in
      if (result.error === 'duplicate') {
        await interaction.editReply({
          content: '✅ You have already checked in to this event!',
        });
        return;
      }
      
      // Handle other errors
      await interaction.editReply({
        content: result.message || '❌ Failed to check in. Please try again.',
      });
      return;
    }
    
    // Post announcement in channel with IGN
    const announcementPosted = await postCheckInAnnouncement(
      interaction.channel,
      result.displayName, // Use IGN instead of username
      result.data.timestamp
    );
    
    if (!announcementPosted) {
      console.warn('⚠️ Check-in recorded but announcement failed');
    }
    
    // Confirm check-in to user
    await interaction.editReply({
      content: `✅ Successfully checked in as **${result.displayName}**! Your attendance has been recorded.`,
    });
    
    console.log(`✅ Check-in complete for ${interaction.user.tag}`);
  } catch (error) {
    console.error('❌ Error handling check-in button:', error);
    
    try {
      await interaction.editReply({
        content: '❌ An error occurred while processing your check-in. Please try again.',
      });
    } catch (followUpError) {
      console.error('❌ Failed to send error message:', followUpError);
    }
  }
}

/**
 * Handle check-out button interaction
 * 
 * @param {Object} interaction - Discord button interaction
 * @returns {Promise<void>}
 */
export async function handleCheckOutButton(interaction) {
  try {
    // Parse event ID from button custom ID (format: checkout_<event_id>)
    const eventId = interaction.customId.split('_')[1];
    
    if (!eventId) {
      console.error('❌ Invalid check-out button custom ID:', interaction.customId);
      await interaction.reply({
        content: '❌ Invalid check-out button. Please contact an admin.',
        ephemeral: true,
      });
      return;
    }
    
    console.log(`🔘 Check-out button clicked by ${interaction.user.tag} for event ${eventId}`);
    
    // Defer reply (check-out may take a moment)
    await interaction.deferReply({ ephemeral: true });
    
    // Get event from database
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .single();
    
    if (eventError || !event) {
      console.error('❌ Event not found:', eventId);
      await interaction.editReply({
        content: '❌ Event not found. It may have been deleted.',
      });
      return;
    }
    
    // SECURITY: Validate interaction channel matches event channel
    if (interaction.channelId !== event.channel_id) {
      console.warn(`⚠️ Security: User ${interaction.user.tag} attempted to use check-out button from wrong channel`);
      await interaction.editReply({
        content: '❌ This button can only be used in the event channel.',
      });
      return;
    }
    
    // Check if event is closed
    if (event.status !== 'closed') {
      await interaction.editReply({
        content: '⏰ Check-out is not available yet. The event must be closed first.',
      });
      return;
    }
    
    // Check if check-out window is still open (15 minutes)
    if (!isCheckOutWindowOpen(event)) {
      await interaction.editReply({
        content: '🚫 Check-out window has closed. Check-out is only available for 15 minutes after event closure.',
      });
      return;
    }
    
    // Create check-out record (FR-013: Allow check-out even without check-in)
    const result = await createCheckOut(eventId, interaction.user.id);
    
    if (!result.success) {
      // Handle duplicate check-out
      if (result.error === 'duplicate') {
        await interaction.editReply({
          content: '✅ You have already checked out from this event!',
        });
        return;
      }
      
      // Handle other errors
      await interaction.editReply({
        content: result.message || '❌ Failed to check out. Please try again.',
      });
      return;
    }
    
    // Confirm check-out to user (FR-010: No public announcement)
    await interaction.editReply({
      content: '✅ Successfully checked out! Your departure has been recorded.',
    });
    
    console.log(`✅ Check-out complete for ${interaction.user.tag}`);
  } catch (error) {
    console.error('❌ Error handling check-out button:', error);
    
    try {
      await interaction.editReply({
        content: '❌ An error occurred while processing your check-out. Please try again.',
      });
    } catch (followUpError) {
      console.error('❌ Failed to send error message:', followUpError);
    }
  }
}

/**
 * Handle close event button interaction
 * 
 * @param {Object} interaction - Discord button interaction
 * @returns {Promise<void>}
 */
export async function handleCloseEventButton(interaction) {
  try {
    // Parse event ID from button custom ID (format: close_event_<event_id>)
    const eventId = interaction.customId.split('_')[2]; // Note: split returns ['close', 'event', 'eventId']
    
    if (!eventId) {
      console.error('❌ Invalid close event button custom ID:', interaction.customId);
      await interaction.reply({
        content: '❌ Invalid button. Please contact an admin.',
        ephemeral: true,
      });
      return;
    }
    
    console.log(`🔘 Close Event button clicked by ${interaction.user.tag} for event ${eventId}`);
    
    // Defer reply (closing may take a moment)
    await interaction.deferReply({ ephemeral: true });
    
    // Check admin permissions
    if (!isAdmin(interaction)) {
      await interaction.editReply({
        content: '❌ Only admins can close events.',
      });
      return;
    }
    
    // Get event from database
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .single();
    
    if (eventError || !event) {
      console.error('❌ Event not found:', eventId);
      await interaction.editReply({
        content: '❌ Event not found. It may have been deleted.',
      });
      return;
    }
    
    // SECURITY: Validate interaction channel matches event channel
    if (interaction.channelId !== event.channel_id) {
      console.warn(`⚠️ Security: User ${interaction.user.tag} attempted to use close button from wrong channel`);
      await interaction.editReply({
        content: '❌ This button can only be used in the event channel.',
      });
      return;
    }
    
    // Check if event is active
    if (event.status === 'closed') {
      await interaction.editReply({
        content: '⚠️ This event is already closed.',
      });
      return;
    }
    
    if (event.status === 'pending') {
      await interaction.editReply({
        content: '⚠️ This event has not started yet. Wait for the start time.',
      });
      return;
    }
    
    // Close the event in database
    const result = await closeEvent(event.event_id);
    
    if (!result.success) {
      await interaction.editReply({
        content: result.message || '❌ Failed to close event. Please try again.',
      });
      return;
    }
    
    // Get all check-ins for this event
    const checkInList = await getCheckInListFromDb(event.event_id);
    
    // Update channel message buttons
    await updateChannelButtonsOnClose(interaction.channel, event.event_id);
    
    // Build summary message
    let summaryMessage = `✅ Event "${event.event_name}" has been closed!\n\n` +
                         `📋 Check-in is now **disabled**`;
    
    // Add attendance list
    if (checkInList && checkInList.length > 0) {
      summaryMessage += `\n\n**👥 Check-in List (${checkInList.length} attendee(s)):**\n`;
      checkInList.forEach((checkin, index) => {
        summaryMessage += `${index + 1}. **${checkin.ign}** (${checkin.username})\n`;
      });
    } else {
      summaryMessage += `\n\n**👥 No one has checked in to this event.**`;
    }
    
    // Send confirmation
    await interaction.editReply({
      content: summaryMessage,
    });
    
    // Post announcement in channel
    await interaction.channel.send({
      content: `🔔 **Event Closed**\n\n` +
               `This event has been closed by ${interaction.user}.\n` +
               `Event is now complete. Check-in/out features have been disabled.`,
    });
    
    console.log(`✅ Event ${event.event_id} closed successfully via button`);
  } catch (error) {
    console.error('❌ Error handling close event button:', error);
    
    try {
      await interaction.editReply({
        content: '❌ An error occurred while closing the event. Please try again.',
      });
    } catch (followUpError) {
      console.error('❌ Failed to send error message:', followUpError);
    }
  }
}

/**
 * Update channel message buttons when event is closed
 * 
 * @param {Object} channel - Discord channel object
 * @param {string} eventId - UUID of the event
 * @returns {Promise<void>}
 */
async function updateChannelButtonsOnClose(channel, eventId) {
  try {
    // Fetch recent messages to find both messages
    const messages = await channel.messages.fetch({ limit: 15 });
    
    // Find main message with check-in button
    const eventMessage = messages.find(msg => 
      msg.components.length > 0 && 
      msg.components[0].components.some(component => 
        component.customId === `checkin_${eventId}`
      )
    );
    
    // Find admin message with close/export buttons
    const adminMessage = messages.find(msg =>
      msg.components.length > 0 &&
      msg.components[0].components.some(component =>
        component.customId === `close_event_${eventId}` || component.customId === `export_event_${eventId}`
      )
    );
    
    if (!eventMessage) {
      console.warn('⚠️ Could not find event message to update buttons');
      return;
    }
    
    // Update main message: Disable check-in and undo buttons only
    const checkInButton = new ButtonBuilder()
      .setCustomId(`checkin_${eventId}`)
      .setLabel('Check In')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    
    const undoCheckInButton = new ButtonBuilder()
      .setCustomId(`undo_checkin_${eventId}`)
      .setLabel('❌ Undo Check-In')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    
    const row1 = new ActionRowBuilder().addComponents(checkInButton, undoCheckInButton);
    await eventMessage.edit({ components: [row1] });
    
    console.log(`✅ Updated channel buttons - all buttons disabled`);
  } catch (error) {
    console.error('❌ Error updating channel buttons:', error);
  }
}

/**
 * Handle export event button interaction
 * 
 * @param {Object} interaction - Discord button interaction
 * @returns {Promise<void>}
 */
export async function handleExportEventButton(interaction) {
  try {
    // Parse event ID from button custom ID (format: export_event_<event_id>)
    const eventId = interaction.customId.split('_')[2]; // Note: split returns ['export', 'event', 'eventId']
    
    if (!eventId) {
      console.error('❌ Invalid export button custom ID:', interaction.customId);
      await interaction.reply({
        content: '❌ Invalid button. Please contact an admin.',
        ephemeral: true,
      });
      return;
    }
    
    console.log(`📊 Export button clicked by ${interaction.user.tag} for event ${eventId}`);
    
    // Defer reply (export may take a moment)
    await interaction.deferReply({ ephemeral: true });
    
    // Check admin permissions
    if (!isAdmin(interaction)) {
      await interaction.editReply({
        content: '❌ Only admins can export event data.',
      });
      return;
    }
    
    // Get event from database
    const event = await getEventByChannelId(interaction.channelId);
    
    if (!event) {
      await interaction.editReply({
        content: '❌ This is not an event channel.',
      });
      return;
    }
    
    // Verify event is closed
    if (event.status !== 'closed') {
      await interaction.editReply({
        content: '⚠️ Event must be closed before exporting data.',
      });
      return;
    }
    
    // Generate export data
    const result = await generateExportData(event.event_id);
    
    if (!result.success) {
      await interaction.editReply({
        content: result.message || '❌ Failed to generate export data. Please try again.',
      });
      return;
    }
    
    // Check if there's any data to export
    if (!result.data || result.data.length === 0) {
      await interaction.editReply({
        content: '⚠️ No attendance data to export. No one has checked in or checked out yet.',
      });
      return;
    }
    
    // Format as CSV
    const csvContent = formatAsCSV(result.data);
    
    // Create file attachment
    const fileName = `event-${event.event_name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.csv`;
    const buffer = Buffer.from(csvContent, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: fileName });
    
    // Send CSV file as ephemeral message (only admin sees it)
    await interaction.editReply({
      content: `✅ Export complete!\n\n` +
               `**Event:** ${event.event_name}\n` +
               `**Total Records:** ${result.data.length}\n` +
               `**File:** ${fileName}\n\n` +
               `The CSV file is attached below and contains all check-in and check-out data.`,
      files: [attachment],
    });
    
    console.log(`✅ Event ${event.event_id} exported successfully via button (${result.data.length} rows)`);
  } catch (error) {
    console.error('❌ Error handling export button:', error);
    
    try {
      await interaction.editReply({
        content: '❌ An error occurred while exporting event data. Please try again.',
      });
    } catch (followUpError) {
      console.error('❌ Failed to send error message:', followUpError);
    }
  }
}

/**
 * Handle delete event button interaction
 * Admin can delete the event and channel
 * 
 * @param {Object} interaction - Discord button interaction
 * @returns {Promise<void>}
 */
async function handleDeleteEventButton(interaction) {
  try {
    // Parse event ID from button custom ID (format: delete_event_<event_id>)
    const eventId = interaction.customId.split('_')[2]; // Note: split returns ['delete', 'event', 'eventId']
    
    if (!eventId) {
      console.error('❌ Invalid delete event button custom ID:', interaction.customId);
      await interaction.reply({
        content: '❌ Invalid button. Please contact an admin.',
        ephemeral: true,
      });
      return;
    }
    
    console.log(`🔘 Delete Event button clicked by ${interaction.user.tag} for event ${eventId}`);
    
    // Defer reply (deletion may take a moment)
    await interaction.deferReply({ ephemeral: true });
    
    // Check admin permissions
    if (!isAdmin(interaction)) {
      await interaction.editReply({
        content: '❌ Only admins can delete events.',
      });
      return;
    }
    
    // Get event from database
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .single();
    
    if (eventError || !event) {
      console.error('❌ Event not found:', eventId);
      await interaction.editReply({
        content: '❌ Event not found. It may have already been deleted.',
      });
      return;
    }
    
    // Get the channel
    const channel = interaction.channel;
    
    // Delete all check-outs for this event
    const { error: checkoutsError } = await supabase
      .from('checkouts')
      .delete()
      .eq('event_id', eventId);
    
    if (checkoutsError) {
      console.error('⚠️ Error deleting check-outs:', checkoutsError);
    }
    
    // Delete all check-ins for this event
    const { error: checkinsError } = await supabase
      .from('checkins')
      .delete()
      .eq('event_id', eventId);
    
    if (checkinsError) {
      console.error('⚠️ Error deleting check-ins:', checkinsError);
    }
    
    // Delete the event from database
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('event_id', eventId);
    
    if (deleteError) {
      console.error('❌ Database error deleting event:', deleteError);
      await interaction.editReply({
        content: '❌ Failed to delete event from database. Please try again.',
      });
      return;
    }
    
    // Send confirmation before deleting channel
    await interaction.editReply({
      content: `✅ Event "${event.event_name}" has been deleted!\n\n` +
               `The channel will be deleted in 5 seconds...`,
    });
    
    console.log(`✅ Event ${eventId} deleted from database by ${interaction.user.tag}`);
    
    // Wait 5 seconds then delete the channel
    setTimeout(async () => {
      try {
        await channel.delete();
        console.log(`✅ Channel ${channel.id} deleted successfully`);
      } catch (channelError) {
        console.error('❌ Error deleting channel:', channelError);
      }
    }, 5000);
    
  } catch (error) {
    console.error('❌ Error handling delete event button:', error);
    
    try {
      const errorMessage = {
        content: '❌ An error occurred while deleting the event. Please try again.',
      };
      
      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply({ ...errorMessage, ephemeral: true });
      }
    } catch (followUpError) {
      console.error('❌ Failed to send error message:', followUpError);
    }
  }
}

/**
 * Handle undo check-in button interaction
 * Allows users to remove their check-in if they made a mistake
 * Only works while event is still active (not closed)
 * 
 * @param {Object} interaction - Discord button interaction
 * @returns {Promise<void>}
 */
async function handleUndoCheckInButton(interaction) {
  try {
    // Parse event ID from button custom ID (format: undo_checkin_<event_id>)
    const eventId = interaction.customId.split('_')[2];
    
    if (!eventId) {
      console.error('❌ Invalid undo check-in button custom ID:', interaction.customId);
      await interaction.reply({
        content: '❌ Invalid button. Please contact an admin.',
        ephemeral: true,
      });
      return;
    }
    
    console.log(`🔘 Undo Check-In button clicked by ${interaction.user.tag} for event ${eventId}`);
    
    // Defer reply
    await interaction.deferReply({ ephemeral: true });
    
    // Get event from database
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .single();
    
    if (eventError || !event) {
      console.error('❌ Event not found:', eventId);
      await interaction.editReply({
        content: '❌ Event not found. It may have been deleted.',
      });
      return;
    }
    
    // Check if event is closed
    if (event.status === 'closed') {
      await interaction.editReply({
        content: '🚫 Cannot undo check-in after event is closed.',
      });
      return;
    }
    
    // Check if user has checked in
    const { data: checkin, error: checkinError } = await supabase
      .from('checkins')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', interaction.user.id)
      .single();
    
    if (checkinError || !checkin) {
      console.log(`ℹ️ User ${interaction.user.tag} hasn't checked in yet`);
      await interaction.editReply({
        content: '⚠️ You have not checked in to this event yet.',
      });
      return;
    }
    
    // Delete the check-in record
    const { error: deleteError } = await supabase
      .from('checkins')
      .delete()
      .eq('checkin_id', checkin.checkin_id);
    
    if (deleteError) {
      console.error('❌ Database error deleting check-in:', deleteError);
      await interaction.editReply({
        content: '❌ Failed to undo check-in. Please try again.',
      });
      return;
    }
    
    console.log(`✅ Check-in undone for user ${interaction.user.tag} (${checkin.checkin_id})`);
    
    await interaction.editReply({
      content: `✅ **Check-in removed!**\n\n` +
               `Your check-in has been cancelled. You can check in again using the Check In button.`,
    });
    
    // Post announcement in channel
    await interaction.channel.send({
      content: `🔄 **${checkin.ign}** cancelled their check-in`,
    });
    
  } catch (error) {
    console.error('❌ Error handling undo check-in button:', error);
    
    try {
      const errorMessage = {
        content: '❌ An error occurred while undoing check-in. Please try again.',
      };
      
      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply({ ...errorMessage, ephemeral: true });
      }
    } catch (followUpError) {
      console.error('❌ Failed to send error message:', followUpError);
    }
  }
}

/**
 * Get check-in list for an event from database
 * 
 * @param {string} eventId - UUID of the event
 * @returns {Promise<Array|null>} - List of check-ins or null
 */
async function getCheckInListFromDb(eventId) {
  try {
    // Get all check-ins for the event, sorted by timestamp
    const { data, error } = await supabase
      .from('checkins')
      .select('ign, username')
      .eq('event_id', eventId)
      .order('timestamp', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching check-in list:', error);
      return null;
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ Error getting check-in list:', error);
    return null;
  }
}

/**
 * Route button interactions to appropriate handlers
 * 
 * @param {Object} interaction - Discord button interaction
 * @returns {Promise<void>}
 */
export async function handleButtonInteraction(interaction) {
  const { customId } = interaction;
  
  if (customId.startsWith('checkin_')) {
    await handleCheckInButton(interaction);
  } else if (customId.startsWith('undo_checkin_')) {
    await handleUndoCheckInButton(interaction);
  } else if (customId.startsWith('checkout_')) {
    await handleCheckOutButton(interaction);
  } else if (customId.startsWith('close_event_')) {
    await handleCloseEventButton(interaction);
  } else if (customId.startsWith('export_event_')) {
    await handleExportEventButton(interaction);
  } else if (customId.startsWith('delete_event_')) {
    await handleDeleteEventButton(interaction);
  } else {
    console.error('❌ Unknown button custom ID:', customId);
    await interaction.reply({
      content: '❌ Unknown button action.',
      ephemeral: true,
    });
  }
}

export default {
  handleButtonInteraction,
  handleCheckInButton,
  handleCheckOutButton,
  handleCloseEventButton,
  handleExportEventButton,
};
