
import { GeminiInternalProvider } from '../src/services/gemini/GeminiInternalProvider.js';
import prisma from '../src/registry.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    console.log('--- Verifying Gemini Internal Tool Support ---');

    console.log('1. Fetching first available credentials...');
    const provider = await prisma.connectedProvider.findFirst({
        where: { providerId: 'gemini-internal', isEnabled: true }
    });

    if (!provider) {
        console.error('No enabled Gemini Internal provider found in DB.');
        return;
    }

    const credentials = {
        access_token: provider.accessToken,
        refresh_token: provider.refreshToken,
        expiry_date: provider.tokenExpiry ? provider.tokenExpiry.getTime() : null,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        token_type: "Bearer"
    };

    const gemini = new GeminiInternalProvider(credentials);

    console.log('2. Initializing provider...');
    const initialized = await gemini.initialize();
    if (!initialized) {
        console.error('Failed to initialize.');
        return;
    }

    console.log('3. Testing Tool Call (Asking for time)...');
    
    // Define a dummy tool
    const tools = [{
        name: "get_current_time",
        description: "Returns the current time in ISO format.",
        parameters: { type: "OBJECT", properties: {} }
    }];

    try {
        const result = await gemini.generateContent("What time is it now? Use the tool.", {
            model: 'gemini-2.5-flash',
            tools: tools,
            systemInstruction: "You are a helpful assistant. If asked for time, YOU MUST use the 'get_current_time' tool."
        });

        const text = result.response.text();
        const functionCalls = result.response.functionCalls ? result.response.functionCalls() : [];

        console.log('--- Result ---');
        console.log('Text Response:', text);
        console.log('Function Calls:', JSON.stringify(functionCalls, null, 2));

        if (functionCalls.length > 0 && functionCalls[0].name === 'get_current_time') {
            console.log('✅ SUCCESS: Tool call detected!');
        } else {
            console.warn('⚠️ WARNING: No tool call detected. Model might have ignored the instruction or the implementation failed.');
        }

    } catch (e) {
        console.error('Error during generation:', e);
    }
}

run();
