
import { PrismaClient } from '@prisma/client';
import { GeminiInternalProvider } from '../src/services/gemini/GeminiInternalProvider.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
    console.log('--- Verifying Gemini Internal Provider ---');

    try {
        const providerConfig = await prisma.connectedProvider.findFirst({
            where: {
                providerId: 'gemini-internal',
                isEnabled: true
            }
        });

        if (!providerConfig) {
            console.error('❌ No enabled Gemini Internal provider found in database.');
            process.exit(1);
        }

        console.log('✅ Found provider config:', providerConfig.providerId);

        const credentials = {
            access_token: providerConfig.accessToken,
            refresh_token: providerConfig.refreshToken,
            expiry_date: providerConfig.tokenExpiry ? new Date(providerConfig.tokenExpiry).getTime() : undefined
        };

        const provider = new GeminiInternalProvider(credentials);
        
        console.log('🔄 Initializing provider...');
        const initSuccess = await provider.initialize();
        if (!initSuccess) {
            console.error('❌ Initialization failed.');
            process.exit(1);
        }
        console.log('✅ Initialization successful.');

        console.log('🔄 Testing generateContent...');
        const response = await provider.generateContent('Hello! Please reply with a short verification message.');
        
        console.log('📥 Response received:');
        const text = response.response.text();
        console.log('---------------------------------------------------');
        console.log(text);
        console.log('---------------------------------------------------');
        
        if (text && text.length > 0) {
            console.log('✅ Verification PASSED.');
        } else {
            console.error('❌ Verification FAILED: Empty response.');
        }

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
