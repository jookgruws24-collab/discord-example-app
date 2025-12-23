import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { isAdmin, createAdminOnlyResponse } from '../config/permissions.js';
import { getEventByChannelId, closeEvent } from '../services/eventService.js';

/**
 * /close-event Command Handler
 * 
 * Closes the current event and enables check-out.
 * Admin only command.
 * Must be run in an event channel.
 */

export async function handleCloseEventCommand(interaction) {
  try {
    // Check admin permissions
    if (!isAdmin(interaction)) {
      await interaction.reply(createAdminOnlyResponse());
      return;
    }
    
    console.log(`🚪 /close-event in channel ${interaction.channelId} by ${interaction.user.tag}`);
    
    // Defer reply
    await interaction.deferReply({ ephemeral: true });
    
    // Get event for this channel
    const event = await getEventByChannelId(interaction.channelId);
    
    if (!event) {
      await interaction.editReply({
        content: '❌ This is not an event channel. Please run this command in an event channel.',
      });
      return;
    }
    
    // Check if already closed
    if (event.status === 'closed') {
      await interaction.editReply({
        content: '⚠️ This event is already closed.',
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
    
    // Get status summary statistics
    const stats = await getEventStatusSummary(event.event_id);
    
    // Update channel message buttons
    await updateChannelButtonsOnClose(interaction.channel, event.event_id);
    
    // Build summary message
    let summaryMessage = `✅ Event "${event.event_name}" has been closed!\n\n` +
                         `📋 Check-in is now **disabled**\n` +
                         `🚪 Check-out is now **enabled** for the next 15 minutes\n` +
                         `⏰ Check-out will automatically disable after 15 minutes`;
    
    // Add statistics if available
    if (stats) {
      const completionRate = stats.total > 0 
        ? ((stats.completed / stats.total) * 100).toFixed(1)
        : '0.0';
      
      summaryMessage += `\n\n**📊 Attendance Summary:**\n` +
                       `• Total Check-ins: **${stats.total}**\n` +
                       `• Completed (with check-out): **${stats.completed}**\n` +
                       `• Incomplete (no check-out): **${stats.incomplete}**\n` +
                       `• Completion Rate: **${completionRate}%**`;
    }
    
    // Send confirmation
    await interaction.editReply({
      content: summaryMessage,
    });
    
    // Post announcement in channel
    await interaction.channel.send({
      content: `🔔 **Event Closed**\n\n` +
               `This event has been closed by ${interaction.user}.\n` +
               `✅ Check-out is now available for the next **15 minutes**.\n` +
               `_The check-out button will automatically disable after 15 minutes._`,
    });
    
    console.log(`✅ Event ${event.event_id} closed successfully`);
  } catch (error) {
    console.error('❌ Error handling /close-event:', error);
    
    try {
      const errorMessage = {
        content: '❌ An error occurred while closing the event. Please try again.',
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
 * Update channel message buttons when event is closed
 * Disables check-in button, enables check-out button
 * 
 * @param {Object} channel - Discord channel object
 * @param {string} eventId - UUID of the event
 * @returns {Promise<void>}
 */
async function updateChannelButtonsOnClose(channel, eventId) {
  try {
    // Fetch recent messages to find the event message with buttons
    const messages = await channel.messages.fetch({ limit: 10 });
    
    // Find message with check-in button
    const eventMessage = messages.find(msg => 
      msg.components.length > 0 && 
      msg.components[0].components.some(component => 
        component.customId === `checkin_${eventId}`
      )
    );
    
    if (!eventMessage) {
      console.warn('⚠️ Could not find event message to update buttons');
      return;
    }
    
    // Create updated buttons - disable check-in and undo, enable check-out
    const checkInButton = new ButtonBuilder()
      .setCustomId(`checkin_${eventId}`)
      .setLabel('Check In')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true); // Disabled when closed
    
    const undoCheckInButton = new ButtonBuilder()
      .setCustomId(`undo_checkin_${eventId}`)
      .setLabel('❌ Undo Check-In')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true); // Disabled when closed
    
    const checkOutButton = new ButtonBuilder()
      .setCustomId(`checkout_${eventId}`)
      .setLabel('Check Out')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(false); // Enabled when closed
    
    const row = new ActionRowBuilder().addComponents(checkInButton, undoCheckInButton, checkOutButton);
    
    // Update message
    await eventMessage.edit({
      components: [row],
    });
    
    console.log(`✅ Updated channel buttons - check-in disabled, check-out enabled`);
  } catch (error) {
    console.error('❌ Error updating channel buttons:', error);
  }
}

/**
 * Get event status summary statistics
 * 
 * @param {string} eventId - UUID of the event
 * @returns {Promise<Object|null>} - Status counts or null
 */
async function getEventStatusSummary(eventId) {
  try {
    const { supabase } = await import('../database/supabase.js');
    
    // Get all check-ins for the event
    const { data, error } = await supabase
      .from('checkins')
      .select('status')
      .eq('event_id', eventId);
    
    if (error) {
      console.error('❌ Error fetching status summary:', error);
      return null;
    }
    
    // Count by status
    const stats = {
      total: data?.length || 0,
      checkedIn: 0,
      completed: 0,
      incomplete: 0,
    };
    
    (data || []).forEach(row => {
      if (row.status === 'checked-in') stats.checkedIn++;
      else if (row.status === 'completed') stats.completed++;
      else if (row.status === 'incomplete') stats.incomplete++;
    });
    
    return stats;
  } catch (error) {
    console.error('❌ Error calculating status summary:', error);
    return null;
  }
}

export default {
  handleCloseEventCommand,
};
