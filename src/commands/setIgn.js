import { setIgn } from '../services/ignService.js';

/**
 * /set-ign Command Handler
 * 
 * Allows users to set or update their in-game name (IGN) for the current server.
 * Features:
 * - UPSERT behavior: creates new IGN or updates existing
 * - Server-specific: IGN is scoped to current guild
 * - Validation: enforces length, character, and uniqueness constraints
 * - User-friendly errors with guidance
 * 
 * Parameters:
 * - name: In-game name (required, 1-32 characters)
 */

export async function handleSetIgnCommand(interaction) {
  try {
    // Get command parameters
    const ignInput = interaction.options.getString('name');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    console.log(`📋 /set-ign: User ${interaction.user.tag} setting IGN to "${ignInput}"`);
    
    // Defer reply (database operation may take a moment)
    await interaction.deferReply({ ephemeral: true });
    
    // Set IGN using service
    const result = await setIgn(userId, guildId, ignInput);
    
    // Handle response based on result
    if (result.success) {
      await interaction.editReply({
        content: `✅ **Your in-game name has been set!**\n\n` +
                 `Your IGN: **${result.data.ign}**\n\n` +
                 `This will be displayed when you check in to events. You can update it anytime using \`/set-ign\`.`,
      });
    } else {
      // Handle different error types
      let errorMessage = '';
      
      switch (result.error) {
        case 'validation':
          errorMessage = `❌ **Invalid IGN**\n\n${result.message}\n\n` +
                        `**Requirements:**\n` +
                        `• 1-32 characters\n` +
                        `• Letters, numbers, spaces, and ._- symbols only\n\n` +
                        `**Examples:** \`ProGamer\`, \`Dark_Knight\`, \`Player.123\``;
          break;
          
        case 'duplicate':
          errorMessage = `❌ **IGN Already Taken**\n\n${result.message}\n\n` +
                        `Please choose a different name and try again.`;
          break;
          
        case 'database':
        case 'unexpected':
        default:
          errorMessage = `❌ **Error**\n\n${result.message}\n\n` +
                        `If this problem persists, please contact a server administrator.`;
          break;
      }
      
      await interaction.editReply({
        content: errorMessage,
      });
    }
  } catch (error) {
    console.error('❌ Error handling /set-ign command:', error);
    
    // Try to respond with error message
    try {
      const errorMessage = {
        content: '❌ An unexpected error occurred while setting your IGN. Please try again.',
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
