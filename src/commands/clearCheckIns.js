import { supabase } from '../database/supabase.js';
import { getIgn } from '../services/ignService.js';

/**
 * /clear-checkins Command Handler (Admin Only)
 * 
 * Allows admins to clear all incomplete check-ins (no checkout) for a specific user.
 * Use case: User wants to change IGN but has incomplete check-ins blocking removal.
 * 
 * Parameters:
 * - user_id: Discord user ID (required)
 * - ign: User's in-game name for verification (required)
 */

export async function handleClearCheckInsCommand(interaction) {
  try {
    // Check if user has administrator permission
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        content: '❌ **Permission Denied**\n\nThis command requires Administrator permission.',
        ephemeral: true,
      });
      return;
    }
    
    // Get command parameters
    const targetUserId = interaction.options.getString('user_id');
    const providedIgn = interaction.options.getString('ign');
    const guildId = interaction.guildId;
    
    console.log(`📋 /clear-checkins: Admin ${interaction.user.tag} clearing check-ins for user ${targetUserId} with IGN verification "${providedIgn}"`);
    
    // Defer reply (database operations may take a moment)
    await interaction.deferReply({ ephemeral: true });
    
    // Verify IGN matches the user's registered IGN
    const ignResult = await getIgn(targetUserId, guildId);
    
    if (!ignResult.success || ignResult.error === 'not_found' || !ignResult.ign) {
      await interaction.editReply({
        content: `❌ **IGN Not Found**\n\nUser ID \`${targetUserId}\` does not have an IGN registered in this server.\n\n` +
                 `💡 _Make sure the user has set their IGN using \`/set-ign\` first._`,
      });
      return;
    }
    
    // Check if provided IGN matches exactly (case-sensitive, exact match required)
    if (ignResult.ign !== providedIgn) {
      console.log(`⚠️ IGN verification failed: expected "${ignResult.ign}", got "${providedIgn}"`);
      await interaction.editReply({
        content: `❌ **IGN Verification Failed**\n\n` +
                 `The provided IGN does not match the registered IGN for user ID \`${targetUserId}\`.\n\n` +
                 `**Provided:** \`${providedIgn}\`\n` +
                 `**Expected:** \`${ignResult.ign}\`\n\n` +
                 `⚠️ _IGN must match exactly (case-sensitive, including spaces)._\n` +
                 `💡 _Use \`/view-ign\` to check the user's registered IGN (ask the user to run it)._`,
      });
      return;
    }
    
    console.log(`✅ IGN verification passed for user ${targetUserId}: "${ignResult.ign}"`);
    
    // Get all check-ins for the user
    const { data: checkins, error: checkinError } = await supabase
      .from('checkins')
      .select('event_id, checkin_id')
      .eq('user_id', targetUserId);
    
    if (checkinError) {
      console.error('❌ Database error fetching check-ins:', checkinError);
      await interaction.editReply({
        content: '❌ **Database Error**\n\nFailed to fetch check-ins. Please try again.',
      });
      return;
    }
    
    // Get all check-outs for the user
    const { data: checkouts, error: checkoutError } = await supabase
      .from('checkouts')
      .select('event_id')
      .eq('user_id', targetUserId);
    
    if (checkoutError) {
      console.error('❌ Database error fetching check-outs:', checkoutError);
      await interaction.editReply({
        content: '❌ **Database Error**\n\nFailed to fetch check-outs. Please try again.',
      });
      return;
    }
    
    // Find incomplete check-ins (no corresponding checkout)
    const checkoutEventIds = new Set(checkouts?.map(co => co.event_id) || []);
    const incompleteCheckIns = checkins?.filter(ci => !checkoutEventIds.has(ci.event_id)) || [];
    
    if (incompleteCheckIns.length === 0) {
      await interaction.editReply({
        content: `ℹ️ **No Incomplete Check-ins**\n\nUser ID \`${targetUserId}\` has no incomplete check-ins.\n\n` +
                 `💡 _They can now use \`/remove-ign\` if needed._`,
      });
      return;
    }
    
    // Delete incomplete check-ins
    const checkinIds = incompleteCheckIns.map(ci => ci.checkin_id);
    const { error: deleteError } = await supabase
      .from('checkins')
      .delete()
      .in('checkin_id', checkinIds);
    
    if (deleteError) {
      console.error('❌ Database error deleting check-ins:', deleteError);
      await interaction.editReply({
        content: '❌ **Database Error**\n\nFailed to clear check-ins. Please try again.',
      });
      return;
    }
    
    console.log(`✅ Cleared ${incompleteCheckIns.length} incomplete check-in(s) for user ${targetUserId} (IGN: ${ignResult.ign})`);
    
    await interaction.editReply({
      content: `✅ **Check-ins Cleared**\n\n` +
               `Successfully cleared **${incompleteCheckIns.length}** incomplete check-in(s) for:\n` +
               `• User ID: \`${targetUserId}\`\n` +
               `• IGN: **${ignResult.ign}**\n\n` +
               `**What's next:**\n` +
               `• User can now use \`/remove-ign\` to remove their IGN\n` +
               `• User can then use \`/set-ign\` to set a new IGN\n\n` +
               `⚠️ _Note: This action cannot be undone. Cleared check-ins are permanently removed._`,
    });
    
  } catch (error) {
    console.error('❌ Error handling /clear-checkins command:', error);
    
    try {
      const errorMessage = {
        content: '❌ An unexpected error occurred. Please try again.',
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
