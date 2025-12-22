import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getEventsNeedingUpdates, updateEventStatus, getEventsForCheckoutDisable, markCheckoutDisabled } from '../services/eventService.js';

/**
 * Event Scheduler
 * 
 * Background service that manages automatic event state transitions:
 * - Enables check-in buttons when event start time arrives
 * - Disables check-out buttons 15 minutes after event closure
 * 
 * Runs periodic checks to handle state changes.
 */

let client = null;
let schedulerInterval = null;

/**
 * Initialize the event scheduler
 * 
 * @param {Object} discordClient - Discord.js client instance
 */
export function startEventScheduler(discordClient) {
  if (!discordClient) {
    console.error('❌ Cannot start event scheduler: no Discord client provided');
    return;
  }
  
  client = discordClient;
  
  console.log('⏰ Starting event scheduler...');
  
  // Run immediately on startup
  processEventUpdates();
  
  // Run every minute
  schedulerInterval = setInterval(processEventUpdates, 60 * 1000);
  
  console.log('✅ Event scheduler started (runs every 60 seconds)');
}

/**
 * Stop the event scheduler
 */
export function stopEventScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('🛑 Event scheduler stopped');
  }
}

/**
 * Process all pending event updates
 */
async function processEventUpdates() {
  try {
    // Process events that need to transition from 'pending' to 'active'
    await enableCheckInForPendingEvents();
    
    // Process events that need check-out disabled (15 min after close)
    await disableCheckOutForClosedEvents();
    
  } catch (error) {
    console.error('❌ Error processing event updates:', error);
  }
}

/**
 * Enable check-in for events whose start time has passed
 */
async function enableCheckInForPendingEvents() {
  try {
    const events = await getEventsNeedingUpdates();
    
    if (events.length === 0) {
      return;
    }
    
    console.log(`⏰ Found ${events.length} event(s) ready to activate`);
    
    for (const event of events) {
      try {
        // Get channel
        const channel = await client.channels.fetch(event.channel_id);
        
        if (!channel) {
          console.warn(`⚠️ Channel ${event.channel_id} not found for event ${event.event_id}`);
          continue;
        }
        
        // Update event status to 'active'
        const updated = await updateEventStatus(event.event_id, 'active');
        
        if (!updated) {
          console.error(`❌ Failed to update status for event ${event.event_id}`);
          continue;
        }
        
        // Enable check-in button in channel
        await enableCheckInButton(channel, event.event_id);
        
        // Post announcement
        await channel.send({
          content: `🔔 **Event Started!**\n\n` +
                   `The event **${event.event_name}** has started!\n` +
                   `✅ Check-in is now **available**. Click the button above to check in.`,
        });
        
        console.log(`✅ Enabled check-in for event ${event.event_id}`);
      } catch (eventError) {
        console.error(`❌ Error processing event ${event.event_id}:`, eventError);
      }
    }
  } catch (error) {
    console.error('❌ Error enabling check-in for pending events:', error);
  }
}

/**
 * Disable check-out for events closed over 15 minutes ago
 */
async function disableCheckOutForClosedEvents() {
  try {
    const events = await getEventsForCheckoutDisable();
    
    if (events.length === 0) {
      return;
    }
    
    console.log(`⏰ Found ${events.length} event(s) ready to disable check-out`);
    
    for (const event of events) {
      try {
        // Get channel
        const channel = await client.channels.fetch(event.channel_id);
        
        if (!channel) {
          console.warn(`⚠️ Channel ${event.channel_id} not found for event ${event.event_id}`);
          continue;
        }
        
        // Disable check-out button in channel
        await disableCheckOutButton(channel, event.event_id);
        
        // Mark event as processed (won't send message again)
        await markCheckoutDisabled(event.event_id);
        
        // Post announcement (only once)
        await channel.send({
          content: `🔒 **Check-Out Closed**\n\n` +
                   `The check-out period has ended (15 minutes after event closure).\n` +
                   `Check-out is no longer available.`,
        });
        
        console.log(`✅ Disabled check-out for event ${event.event_id}`);
      } catch (eventError) {
        console.error(`❌ Error processing event ${event.event_id}:`, eventError);
      }
    }
  } catch (error) {
    console.error('❌ Error disabling check-out for closed events:', error);
  }
}

/**
 * Enable check-in button in event channel
 * 
 * @param {Object} channel - Discord channel object
 * @param {string} eventId - UUID of the event
 */
async function enableCheckInButton(channel, eventId) {
  try {
    // Fetch recent messages to find the event messages
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
        component.customId === `close_event_${eventId}`
      )
    );
    
    if (!eventMessage) {
      console.warn(`⚠️ Could not find event message for event ${eventId}`);
      return;
    }
    
    // Update main message: Enable check-in button
    const checkInButton = new ButtonBuilder()
      .setCustomId(`checkin_${eventId}`)
      .setLabel('Check In')
      .setStyle(ButtonStyle.Success)
      .setDisabled(false); // Now enabled
    
    const row1 = new ActionRowBuilder().addComponents(checkInButton);
    await eventMessage.edit({ components: [row1] });
    
    // Update admin message: Enable Close Event button (no export yet)
    if (adminMessage) {
      const closeEventButton = new ButtonBuilder()
        .setCustomId(`close_event_${eventId}`)
        .setLabel('🚪 Close Event')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(false); // Now enabled
      
      const row2 = new ActionRowBuilder().addComponents(closeEventButton);
      await adminMessage.edit({ components: [row2] });
    }
    
    console.log(`✅ Enabled check-in and close event buttons for event ${eventId}`);
  } catch (error) {
    console.error(`❌ Error enabling check-in button:`, error);
  }
}

/**
 * Disable check-out button in event channel
 * 
 * @param {Object} channel - Discord channel object
 * @param {string} eventId - UUID of the event
 */
async function disableCheckOutButton(channel, eventId) {
  try {
    // Fetch recent messages to find both messages
    const messages = await channel.messages.fetch({ limit: 15 });
    
    // Find main message with check-in/check-out buttons
    const eventMessage = messages.find(msg => 
      msg.components.length > 0 && 
      msg.components[0].components.some(component => 
        component.customId === `checkout_${eventId}` || component.customId === `checkin_${eventId}`
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
      console.warn(`⚠️ Could not find event message for event ${eventId}`);
      return;
    }
    
    // Disable check-in and check-out buttons (main message)
    const checkInButton = new ButtonBuilder()
      .setCustomId(`checkin_${eventId}`)
      .setLabel('Check In')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    
    const checkOutButton = new ButtonBuilder()
      .setCustomId(`checkout_${eventId}`)
      .setLabel('Check Out')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true); // Now disabled
    
    const row1 = new ActionRowBuilder().addComponents(checkInButton, checkOutButton);
    await eventMessage.edit({ components: [row1] });
    
    // Add Export button now that check-out is closed (admin message)
    if (adminMessage) {
      const closeEventButton = new ButtonBuilder()
        .setCustomId(`close_event_${eventId}`)
        .setLabel('🚪 Close Event')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true); // Keep disabled
      
      const exportButton = new ButtonBuilder()
        .setCustomId(`export_event_${eventId}`)
        .setLabel('📊 Export CSV')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false); // Now enabled - appears for first time!
      
      const row2 = new ActionRowBuilder().addComponents(closeEventButton, exportButton);
      await adminMessage.edit({ 
        content: `## 🔐 Admin Controls\n\n` +
                 `**Export CSV:** Download attendance data\n\n` +
                 `⚠️ _These controls are for admins only._`,
        components: [row2] 
      });
    }
    
    console.log(`✅ Disabled check-out button, kept export button enabled for event ${eventId}`);
  } catch (error) {
    console.error(`❌ Error disabling check-out button:`, error);
  }
}

export default {
  startEventScheduler,
  stopEventScheduler,
};
