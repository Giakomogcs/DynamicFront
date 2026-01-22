/**
 * Migration Script: Move API Keys from .env to Database
 * 
 * This script reads API keys from the current .env file and stores them
 * in the SystemSetting table, making them centralized and available to all users.
 */

import prisma from '../registry.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_KEYS_TO_MIGRATE = [
    'GEMINI_API_KEY',
    'GROQ_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'XAI_API_KEY',
    'GITHUB_COPILOT_TOKEN'
];

async function migrateKeys() {
    console.log('🔄 Starting API Key Migration...\n');

    let migratedCount = 0;
    let skippedCount = 0;

    for (const key of API_KEYS_TO_MIGRATE) {
        const value = process.env[key];

        if (!value || value.trim() === '') {
            console.log(`⏭️  Skipping ${key} (not set in .env)`);
            skippedCount++;
            continue;
        }

        try {
            // Check if already exists in DB
            const existing = await prisma.systemSetting.findUnique({
                where: { key }
            });

            if (existing) {
                console.log(`⚠️  ${key} already exists in database - skipping`);
                skippedCount++;
                continue;
            }

            // Create new setting
            await prisma.systemSetting.create({
                data: {
                    key: key,
                    value: JSON.stringify(value)
                }
            });

            console.log(`✅ Migrated ${key}`);
            migratedCount++;
        } catch (error) {
            console.error(`❌ Failed to migrate ${key}:`, error.message);
        }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`\n✨ Migration complete!`);

    if (migratedCount > 0) {
        console.log('\n⚠️  IMPORTANT NEXT STEPS:');
        console.log('   1. Remove API keys from .env file (keep only DATABASE_URL and LOG_LEVEL)');
        console.log('   2. Restart the server to use keys from database');
    }

    await prisma.$disconnect();
}

migrateKeys().catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
});
