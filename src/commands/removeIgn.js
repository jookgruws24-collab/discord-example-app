import { removeIgn } from '../services/ignService.js';

/**
 * /remove-ign Command Handler
 * 
 * Allows users to remove their in-game name (IGN) from the current server.
 * Features:
 * - Deletes IGN from database
 * - Confirmation message with removed IGN
 * - Warning about check-in implications
 * - Server-specific: Only removes IGN for current guild
 * - Ephemeral response: Only user sees the result
 */

export async function handleRemoveIgnCommand(interaction) {
  try {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    console.log(`📋 /remove-ign: User ${interaction.user.tag} removing their IGN`);
    
    // Defer reply (database operation may take a moment)
    await interaction.deferReply({ ephemeral: true });
    
    // Remove IGN using service
    const result = await removeIgn(userId, guildId);
    
    // Handle response based on result
    if (result.success && result.ign) {
      // IGN removed successfully
      await interaction.editReply({
        content: `✅ **In-Game Name Removed**\n\n` +
                 `Your IGN "**${result.ign}**" has been removed from this server.\n\n` +
                 `⚠️ **Important:**\n` +
                 `• You will not be able to check in to events until you set a new IGN\n` +
                 `• Use \`/set-ign\` to set a new in-game name\n\n` +
                 `💡 _Note: You can also update your IGN directly with \`/set-ign\` without removing it first._`,
      });
    } else if (result.error === 'not_found') {
      // No IGN to remove
      await interaction.editReply({
        content: `ℹ️ **No In-Game Name Set**\n\n` +
                 `You don't have an in-game name set in this server yet.\n\n` +
                 `💡 **Recommendation:** Set your IGN first using \`/set-ign\`\n\n` +
                 `**Why set an IGN?**\n` +
                 `• Required to check in to events\n` +
                 `• Displayed in check-in announcements\n` +
                 `• Included in attendance exports\n\n` +
                 `**Example:** \`/set-ign name:YourGameName\``,
      });
    } else if (result.error === 'active_checkin') {
      // User has active check-ins - cannot remove IGN
      await interaction.editReply({
        content: `❌ **Cannot Remove IGN**\n\n` +
                 `${result.message}\n\n` +
                 `⚠️ **You are currently checked in to ${result.activeCheckIns} event(s)**\n\n` +
                 `**To remove your IGN:**\n` +
                 `1. Check out from all active events first\n` +
                 `2. Then use \`/remove-ign\` again\n\n` +
                 `💡 _Tip: You can update your IGN with \`/set-ign\` without removing it._`,
      });
    } else {
      // Database or unexpected error
      await interaction.editReply({
        content: `❌ **Error**\n\n${result.message}\n\n` +
                 `If this problem persists, please contact a server administrator.`,
      });
    }
  } catch (error) {
    console.error('❌ Error handling /remove-ign command:', error);
    
    // Try to respond with error message
    try {
      const errorMessage = {
        content: '❌ An unexpected error occurred while removing your IGN. Please try again.',
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
