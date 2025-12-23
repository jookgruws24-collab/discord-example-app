/**
 * /help Command Handler
 * 
 * Shows a list of all available commands with descriptions and usage examples.
 */

export async function handleHelpCommand(interaction) {
  try {
    console.log(`📋 /help: User ${interaction.user.username} requested help`);
    
    const isAdmin = interaction.memberPermissions?.has('Administrator');
    
    await interaction.reply({
      content: `📚 **Discord Event Check-In Bot - Command List**\n\n` +
               `**📋 IGN Management Commands**\n` +
               `• \`/set-ign name:[your-name]\` - Set or update your in-game name\n` +
               `• \`/view-ign\` - View your current in-game name\n` +
               `• \`/remove-ign\` - Remove your in-game name (requires no active check-ins)\n` +
               `• \`/my-user-id\` - View your Discord User ID\n\n` +
               
               `**📅 Event Commands (Everyone)**\n` +
               `• Check-in/Check-out - Use buttons in event announcements\n\n` +
               
               (isAdmin ? 
                 `**⚙️ Admin Commands**\n` +
                 `• \`/create-event name:[event] start-time:[YYYY-MM-DD HH:MM]\` - Create a new event\n` +
                 `• \`/close-event\` - Close current event and enable check-out\n` +
                 `• \`/export-event\` - Export attendance data as CSV\n` +
                 `• \`/clear-checkins user_id:[id]\` - Clear incomplete check-ins for a user\n\n` +
                 
                 `**💡 Admin Tips**\n` +
                 `• Events auto-close 15 minutes after scheduled end time\n` +
                 `• Users need IGN set before checking in\n` +
                 `• Use \`/clear-checkins\` to help users change their IGN\n\n`
                 : 
                 `**💡 Tips**\n` +
                 `• IGN is required before you can check in to events\n` +
                 `• You must check out before removing your IGN\n` +
                 `• Ask an admin to use \`/clear-checkins\` if you need help\n\n`
               ) +
               
               `**ℹ️ Need More Help?**\n` +
               `Contact a server administrator for assistance.`,
      ephemeral: true,
    });
    
  } catch (error) {
    console.error('❌ Error handling /help command:', error);
    
    try {
      await interaction.reply({
        content: '❌ An unexpected error occurred. Please try again.',
        ephemeral: true,
      });
    } catch (followUpError) {
      console.error('❌ Failed to send error message:', followUpError);
    }
  }
}
