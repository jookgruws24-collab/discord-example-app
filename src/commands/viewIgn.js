import { getIgn } from '../services/ignService.js';

/**
 * /view-ign Command Handler
 * 
 * Allows users to view their current in-game name (IGN) for the current server.
 * Features:
 * - Displays current IGN if set
 * - Helpful message if IGN not set
 * - Server-specific: Shows IGN for current guild only
 * - Ephemeral response: Only user sees the result
 */

export async function handleViewIgnCommand(interaction) {
  try {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    console.log(`📋 /view-ign: User ${interaction.user.tag} viewing their IGN`);
    
    // Defer reply (database query may take a moment)
    await interaction.deferReply({ ephemeral: true });
    
    // Get IGN using service
    const result = await getIgn(userId, guildId);
    
    // Handle response based on result
    if (result.success && result.ign) {
      // IGN found - display it
      await interaction.editReply({
        content: `✅ **Your In-Game Name**\n\n` +
                 `Your current IGN: **${result.ign}**\n\n` +
                 `This is what will be displayed when you check in to events.\n\n` +
                 `💡 _To update your IGN, use \`/set-ign\`_`,
      });
    } else if (result.error === 'not_found') {
      // IGN not set - provide guidance
      await interaction.editReply({
        content: `❌ **No In-Game Name Set**\n\n` +
                 `You have not set your in-game name for this server yet.\n\n` +
                 `**To set your IGN:**\n` +
                 `1. Use the \`/set-ign\` command\n` +
                 `2. Enter your in-game name\n` +
                 `3. Check in to events using your IGN\n\n` +
                 `⚠️ _You must set your IGN before you can check in to events._`,
      });
    } else {
      // Database or unexpected error
      await interaction.editReply({
        content: `❌ **Error**\n\n${result.message}\n\n` +
                 `If this problem persists, please contact a server administrator.`,
      });
    }
  } catch (error) {
    console.error('❌ Error handling /view-ign command:', error);
    
    // Try to respond with error message
    try {
      const errorMessage = {
        content: '❌ An unexpected error occurred while retrieving your IGN. Please try again.',
        ephemeral: true,
      };
      
      if (interaction.deferred) {
        await interaction.editReply(errorMessage.content);
      } else if (!interaction.replied) {
        await interaction.reply(errorMessage);
      }
    } catch (followUpError) {
      console.error('❌ Failed to send error message:', followUpError);
    }
  }
}
