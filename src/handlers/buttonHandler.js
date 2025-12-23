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
    
    // Update channel message buttons
    await updateChannelButtonsOnClose(interaction.channel, event.event_id);
    
    // Send confirmation
    await interaction.editReply({
      content: `✅ Event "${event.event_name}" has been closed!\n\n` +
               `📋 Check-in is now **disabled**\n` +
               `🚪 Check-out is now **enabled** for the next 15 minutes\n` +
               `⏰ Check-out will automatically disable after 15 minutes`,
    });
    
    // Post announcement in channel
    await interaction.channel.send({
      content: `🔔 **Event Closed**\n\n` +
               `This event has been closed by ${interaction.user}.\n` +
               `✅ Check-out is now available for the next **15 minutes**.\n` +
               `_The check-out button will automatically disable after 15 minutes._`,
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
    
    // Update main message: Disable check-in, enable check-out
    const checkInButton = new ButtonBuilder()
      .setCustomId(`checkin_${eventId}`)
      .setLabel('Check In')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true); // Disabled when closed
    
    const checkOutButton = new ButtonBuilder()
      .setCustomId(`checkout_${eventId}`)
      .setLabel('Check Out')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(false); // Enabled when closed
    
    const row1 = new ActionRowBuilder().addComponents(checkInButton, checkOutButton);
    await eventMessage.edit({ components: [row1] });
    
    // Update admin message: Disable close button (export comes after 15 min)
    if (adminMessage) {
      const closeEventButton = new ButtonBuilder()
        .setCustomId(`close_event_${eventId}`)
        .setLabel('🚪 Close Event')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true); // Disabled after close
      
      const row2 = new ActionRowBuilder().addComponents(closeEventButton);
      await adminMessage.edit({ 
        content: `## 🔐 Admin Controls\n\n` +
                 `**Close Event:** Event has been closed\n` +
                 `**Export CSV:** Will be available after check-out closes (15 minutes)\n\n` +
                 `⚠️ _These controls are for admins only._`,
        components: [row2] 
      });
    }
    
    console.log(`✅ Updated channel buttons - check-in disabled, check-out enabled`);
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
 * Route button interactions to appropriate handlers
 * 
 * @param {Object} interaction - Discord button interaction
 * @returns {Promise<void>}
 */
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
