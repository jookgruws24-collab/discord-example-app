import { supabase } from './supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run Database Migrations
 * 
 * Executes SQL migration files in order.
 * Run this script manually: node src/database/runMigrations.js
 */

async function runMigrations() {
  console.log('🔄 Starting database migrations...\n');
  
  const migrationsDir = path.join(__dirname, 'migrations');
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Migrations directory not found:', migrationsDir);
    process.exit(1);
  }
  
  // Get all .sql files sorted by name
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  if (migrationFiles.length === 0) {
    console.log('⚠️  No migration files found');
    return;
  }
  
  console.log(`📋 Found ${migrationFiles.length} migration(s):\n`);
  migrationFiles.forEach(file => console.log(`   • ${file}`));
  console.log('');
  
  // Run each migration
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`🔄 Running migration: ${file}`);
    
    try {
      // Split SQL into individual statements (simple approach)
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      // Execute each statement
      for (const statement of statements) {
        const { error } = await supabase.from('_sql_exec').select().limit(0);
        
        // Since Supabase doesn't support direct SQL execution via JS client,
        // this migration must be run manually in Supabase SQL Editor
        throw new Error('Direct SQL execution not supported. Please run migrations manually in Supabase SQL Editor.');
      }
      
      console.log(`✅ Migration completed: ${file}\n`);
    } catch (err) {
      console.error(`❌ Migration must be run manually in Supabase Dashboard:`);
      console.error(`   1. Go to: https://supabase.com/dashboard`);
      console.error(`   2. Navigate to SQL Editor`);
      console.error(`   3. Copy and run: ${filePath}`);
      console.error(`   Error: ${err.message}\n`);
      process.exit(1);
    }
  }
  
  console.log('✅ All migrations completed successfully!\n');
}

// Run migrations
runMigrations().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
