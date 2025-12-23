# Discord Event Check-In/Check-Out Bot

A Discord bot that enables event check-in/check-out functionality for Discord servers. Admin users can create events with start times, members can check-in and check-out using buttons, and the system tracks attendance data in Supabase.

## Features

- 🎯 **Event Management**: Admins can create and close events with slash commands
- ✅ **Check-In System**: Members check-in with a button click, with announcements
- 🚪 **Check-Out Tracking**: Members can check-out to track event duration
- 👤 **IGN Management**: Members can set, view, and remove their in-game names
- 📊 **Status Tracking**: Monitor completion status (checked-in, completed, incomplete)
- 📈 **Attendance Summary**: View completion rates when closing events
- 📋 **Data Export**: Admins can export attendance data as CSV with status tracking
- ⏰ **Automatic State Management**: Check-in enables at start time, check-out auto-disables after 15 minutes
- 🔒 **IGN Verification**: Admin commands require exact IGN match for safety
- 🗄️ **Supabase Backend**: All data stored in PostgreSQL via Supabase

## Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v8.x or higher  
- **Discord Developer Account**: https://discord.com/developers/applications
- **Supabase Account**: https://supabase.com (free tier sufficient)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd discord-example-app
npm install
```

### 2. Discord Bot Setup

#### Create Discord Application
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it "Event Check-In Bot"
4. Navigate to "Bot" section
5. Click "Add Bot"
6. **Copy the Bot Token** (you'll need this for .env)

#### Configure Bot Permissions
In the "Bot" section, enable these intents:
- ✅ **Message Content Intent** (required for message operations)
- ✅ **Server Members Intent** (required for user data)

#### Invite Bot to Server
1. Navigate to "OAuth2" → "URL Generator"
2. Select scopes: `bot` and `applications.commands`
3. Select permissions:
   - Manage Channels
   - Send Messages
   - Manage Messages
   - Read Message History
   - Use Slash Commands
4. Copy the generated URL and open it in your browser
5. Select your test server and authorize

### 3. Supabase Database Setup

#### Create Supabase Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Set project name: "discord-checkin-bot"
4. Choose a strong database password
5. Select your region
6. Wait ~2 minutes for initialization

#### Create Database Schema
1. Navigate to "SQL Editor" in Supabase dashboard
2. Click "New Query"
3. Run the following migrations in order:
   - Copy contents of `src/database/migrations/001_create_user_igns.sql` → Run
   - Copy contents of `src/database/migrations/002_add_ign_to_checkins.sql` → Run
   - Copy contents of `src/database/migrations/003_add_checkins_status.sql` → Run
4. Alternatively, copy and run `specs/001-event-checkin/database-schema.sql` for base schema
5. Verify tables are created: `events`, `checkins`, `checkouts`, `user_igns`

#### Get Supabase Credentials
1. Go to "Settings" → "API" in Supabase dashboard
2. Copy **Project URL** (starts with https://...supabase.co)
3. Copy **anon public** key (under "Project API keys")

### 4. Configure Environment Variables

1. Copy `.env.sample` to `.env`:
   ```bash
   cp .env.sample .env
   ```

2. Edit `.env` and fill in your credentials:
   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_APP_ID=your_app_id_here
   PUBLIC_KEY=your_public_key_here
   
   # Supabase Configuration  
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_KEY=your_supabase_anon_key_here
   
   # Admin Configuration (Optional)
   ADMIN_ROLE_ID=your_admin_role_id_here
   ```

**Where to find these:**
- `DISCORD_TOKEN`: Bot section in Discord Developer Portal
- `DISCORD_APP_ID`: General Information page in Discord Developer Portal
- `PUBLIC_KEY`: General Information page in Discord Developer Portal
- `SUPABASE_URL`: Settings → API in Supabase dashboard
- `SUPABASE_KEY`: Settings → API in Supabase (anon public key)
- `ADMIN_ROLE_ID`: Right-click a role in Discord (Developer Mode required)

### 5. Register Slash Commands

```bash
npm run register
```

This registers the following commands:
- `/create-event` - Create a new event (admin only)
- `/close-event` - Close an active event (admin only)
- `/export-event` - Export attendance data (admin only)
- `/set-ign` - Set or update your in-game name
- `/view-ign` - View your current in-game name
- `/remove-ign` - Remove your in-game name
- `/clear-checkins` - Clear incomplete check-ins for a user (admin only, requires IGN verification)
- `/my-user-id` - View your Discord User ID
- `/help` - Show all available commands

### 6. Start the Bot

```bash
npm start
```

You should see: `Bot is ready!`

## Usage

### For Admins

#### Create an Event
```
/create-event name:"Team Meeting" start-time:"2025-12-25 14:00"
```
This creates a new event channel with check-in button (disabled until start time).

#### Close an Event
```
/close-event
```
Run this in the event channel when the event ends. This:
- Disables the check-in button
- Enables the check-out button for 15 minutes
- Marks incomplete check-ins (users who didn't check out)
- Shows attendance summary with completion rate
- Auto-disables check-out after 15 minutes

**Example Output:**
```
✅ Event "Team Meeting" has been closed!

📋 Check-in is now disabled
🚪 Check-out is now enabled for the next 15 minutes
⏰ Check-out will automatically disable after 15 minutes

📊 Attendance Summary:
• Total Check-ins: 25
• Completed (with check-out): 22
• Incomplete (no check-out): 3
• Completion Rate: 88.0%
```

#### Export Attendance Data
```
/export-event
```
Run this in the event channel to download a CSV file with all check-in/check-out data including status tracking.

**CSV Columns:**
- User ID, Username, Discriminator, IGN, Status, Check-In Time, Check-Out Time

#### Clear Incomplete Check-ins
```
/clear-checkins user_id:123456789 ign:PlayerName
```
Clear incomplete check-ins for a user (requires exact IGN for verification). Useful when users need to change their IGN.

### For Members

#### Set Your IGN (Required Before Check-in)
```
/set-ign name:YourGameName
```
Set your in-game name before you can check in to events. IGN requirements:
- 1-32 characters
- Letters, numbers, spaces, and ._- symbols only
- Must be unique in the server

#### View Your IGN
```
/view-ign
```
Check what IGN you currently have set.

#### Remove Your IGN
```
/remove-ign
```
Remove your IGN from the server. Note: Cannot remove if you have active check-ins.

#### Check Your User ID
```
/my-user-id
```
Get your Discord User ID (useful for admin operations).

#### Check In
1. Set your IGN first using `/set-ign` (one-time setup)
2. Navigate to the event channel
3. Wait for the event start time
4. Click the "Check In" button
5. You'll see an announcement with your IGN and timestamp

#### Check Out
1. After the admin closes the event
2. Click the "Check Out" button within 15 minutes
3. Your check-out is recorded and status updated to "completed"
4. No announcement (silent check-out)

## Project Structure

```
discord-example-app/
├── src/
│   ├── commands/          # Slash command handlers
│   │   ├── createEvent.js
│   │   ├── closeEvent.js
│   │   ├── exportEvent.js
│   │   ├── setIgn.js
│   │   ├── viewIgn.js
│   │   ├── removeIgn.js
│   │   ├── clearCheckIns.js
│   │   ├── myUserId.js
│   │   └── help.js
│   ├── handlers/          # Interaction handlers
│   │   ├── buttonHandler.js
│   │   └── eventScheduler.js
│   ├── services/          # Business logic
│   │   ├── eventService.js
│   │   ├── checkinService.js
│   │   ├── checkoutService.js
│   │   ├── exportService.js
│   │   └── ignService.js
│   ├── database/          # Database connection & migrations
│   │   ├── supabase.js
│   │   ├── runMigrations.js
│   │   └── migrations/
│   │       ├── 001_create_user_igns.sql
│   │       ├── 002_add_ign_to_checkins.sql
│   │       └── 003_add_checkins_status.sql
│   └── config/            # Configuration
│       └── permissions.js
├── specs/                 # Documentation
│   ├── 001-event-checkin/
│   ├── 001-ign-management/
│   └── 002-button-ui-enhancement/
├── tests/                 # Test files
│   └── manual/
├── app.js                 # Main bot entry point
├── commands.js            # Command registration (global)
├── commands-guild.js      # Command registration (guild-specific)
├── package.json
├── .env                   # Your credentials (not committed)
└── .env.sample            # Template
```

## Development

### Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: discord.js v14
- **Database**: Supabase (PostgreSQL)
- **Architecture**: Event-driven bot with Gateway API

### Running in Development
```bash
npm run dev
```

### Registering New Commands
After modifying commands:
```bash
npm run register
```

## Troubleshooting

### Bot doesn't respond to commands
- Verify bot token is correct in `.env`
- Check bot has proper permissions in server
- Ensure commands are registered: `npm run register`
- Check bot is online in Discord server

### Database errors
- Verify Supabase URL and key in `.env`
- Check database schema is created (run database-schema.sql)
- Ensure service role key is NOT used (use anon key)

### Check-in button doesn't work
- Verify you have set your IGN first: `/set-ign`
- Ensure event start time is in the future or has passed
- Check eventScheduler is running (console logs)
- Ensure bot stayed online since event creation

### Cannot remove IGN
- You cannot remove IGN while checked in to active events
- Admin can use `/clear-checkins` to clear your incomplete check-ins
- Then you can use `/remove-ign`

### Status not updating
- Verify migration 003 was run in Supabase
- Check `checkins` table has `status` column
- Restart the bot to reload code changes

### Check-out button doesn't disable after 15 minutes
- Verify bot remained online during the 15-minute window
- Check eventScheduler logs for timer execution

## Database Schema

The bot uses four tables in Supabase:

**events** - Stores event information
- event_id, event_name, channel_id, start_time, status, closed_at, created_at, created_by

**checkins** - Stores check-in records with status tracking
- checkin_id, event_id, user_id, username, discriminator, ign, status, timestamp
- Status values: 'checked-in', 'completed', 'incomplete'

**checkouts** - Stores check-out records  
- checkout_id, event_id, user_id, timestamp

**user_igns** - Stores user in-game names per server
- user_id, guild_id, ign, updated_at

See `src/database/migrations/` for complete schema and migration files.

## Documentation

Comprehensive documentation is available in `specs/`:

**Event Check-In System** (`specs/001-event-checkin/`)
- `spec.md` - Feature specification
- `plan.md` - Implementation plan
- `tasks.md` - Task breakdown
- `database-schema.sql` - Base schema

**IGN Management** (`specs/001-ign-management/`)
- `spec.md` - IGN feature specification
- `plan.md` - Implementation details
- `tasks.md` - Development tasks

**Status Tracking** (`src/database/migrations/`)
- `003_add_checkins_status.sql` - Status column migration
- `README_003.md` - Migration documentation

## Recent Updates

### December 2025
- ✅ Added status tracking (checked-in, completed, incomplete)
- ✅ Added attendance summary with completion rates
- ✅ Added IGN verification for clear-checkins command
- ✅ Enhanced CSV export with Status column
- ✅ Removed channel name "event-" prefix
- ✅ Code cleanup (removed unused template files)

## Support

For issues or questions, please refer to:
- Discord.js documentation: https://discord.js.org
- Supabase documentation: https://supabase.com/docs
- Project specification: `specs/001-event-checkin/spec.md`

## License

[Your License Here]
