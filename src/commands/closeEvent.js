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
    
    // Get all check-ins for this event
    const checkInList = await getCheckInList(event.event_id);
    
    // Update channel message buttons (disable check-in button)
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
    
    // Create updated buttons - disable all buttons when event closes
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
    
    const row = new ActionRowBuilder().addComponents(checkInButton, undoCheckInButton);
    
    // Update message
    await eventMessage.edit({
      components: [row],
    });
    
    console.log(`✅ Updated channel buttons - all buttons disabled`);
  } catch (error) {
    console.error('❌ Error updating channel buttons:', error);
  }
}

/**
 * Get check-in list for an event
 * 
 * @param {string} eventId - UUID of the event
 * @returns {Promise<Array|null>} - List of check-ins or null
 */
async function getCheckInList(eventId) {
  try {
    const { supabase } = await import('../database/supabase.js');
    
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
    console.error('❌ Error calculating check-in list:', error);
    return null;
  }
}

export default {
  handleCloseEventCommand,
};
