import 'dotenv/config';
import { REST, Routes } from 'discord.js';

// Same command definitions as commands.js
const commands = [
  {
    name: 'create-event',
    description: 'Create a new event with check-in tracking (Admin only)',
    options: [
      {
        type: 3,
        name: 'name',
        description: 'Event name (e.g., "Team Meeting")',
        required: true,
      },
      {
        type: 3,
        name: 'start-time',
        description: 'Event start time (e.g., "2025-12-25 14:00")',
        required: true,
      },
    ],
  },
  {
    name: 'close-event',
    description: 'Close the current event and enable check-out (Admin only)',
  },
  {
    name: 'export-event',
    description: 'Export attendance data as CSV (Admin only)',
  },
  {
    name: 'set-ign',
    description: 'Set or update your in-game name for this server',
    options: [
      {
        type: 3,
        name: 'name',
        description: 'Your in-game name (1-32 characters, letters/numbers/spaces/._- only)',
        required: true,
      },
    ],
  },
  {
    name: 'view-ign',
    description: 'View your current in-game name for this server',
  },
  {
    name: 'remove-ign',
    description: 'Remove your in-game name from this server',
  },
  {
    name: 'clear-checkins',
    description: 'Clear incomplete check-ins for a user (Admin only)',
    options: [
      {
        type: 3,
        name: 'user_id',
        description: 'Discord User ID to clear check-ins for',
        required: true,
      },
      {
        type: 3,
        name: 'ign',
        description: 'User\'s in-game name for verification',
        required: true,
      },
    ],
  },
  {
    name: 'my-user-id',
    description: 'View your Discord User ID',
  },
  {
    name: 'help',
    description: 'Show all available commands and usage information',
  },
];

// Get guild ID from command line argument
const GUILD_ID = process.argv[2];

if (!GUILD_ID) {
  console.error('❌ Error: Guild ID is required!');
  console.log('\n📋 Usage: node commands-guild.js <GUILD_ID>');
  console.log('\n💡 To find your Guild ID:');
  console.log('   1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)');
  console.log('   2. Right-click your server icon → Copy Server ID\n');
  process.exit(1);
}

// Register commands with Discord API
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Started registering guild commands for server ${GUILD_ID}...\n`);
    
    // Register commands for specific guild (instant update)
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_APP_ID, GUILD_ID),
      { body: commands },
    );
    
    console.log('✅ Successfully registered guild commands!\n');
    console.log('📋 Registered commands:');
    commands.forEach(cmd => {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
    });
    console.log('\n✨ Commands should appear IMMEDIATELY in your Discord server!\n');
    
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    process.exit(1);
  }
})();
