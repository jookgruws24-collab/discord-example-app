/**
 * /my-user-id Command Handler
 * 
 * Shows the user their Discord User ID.
 * Use case: User needs their ID to give to admin for clearing incomplete check-ins.
 */

export async function handleMyUserIdCommand(interaction) {
  try {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    
    console.log(`📋 /my-user-id: User ${username} (${userId}) requested their ID`);
    
    await interaction.reply({
      content: `ℹ️ **Your Discord User ID**\n\n` +
               `**Username:** ${username}\n` +
               `**User ID:** \`${userId}\`\n\n` +
               `💡 **Why you might need this:**\n` +
               `• Give to an admin to clear incomplete check-ins\n` +
               `• Required if you want to change your IGN but have incomplete check-ins\n\n` +
               `**To copy your ID:** Click or tap on the ID above to select it, then copy.`,
      ephemeral: true,
    });
    
  } catch (error) {
    console.error('❌ Error handling /my-user-id command:', error);
    
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
