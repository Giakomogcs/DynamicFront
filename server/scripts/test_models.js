
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from server root (one level up from scripts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API Key found!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-pro",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
];

async function testModel(modelName) {
    console.log(`\n--- Testing ${modelName} ---`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        console.log(`[SUCCESS] ${modelName} responded: ${response.text().substring(0, 50)}...`);
    } catch (error) {
        console.error(`[FAILED] ${modelName} Error:`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`StatusText: ${error.response.statusText}`);
        }
        console.error(error.message);

        // Check for specific quota info in error
        if (error.message.includes('Quota exceeded')) {
            console.log("-> DIAGNOSIS: Quota Exceeded / Rate Limit.");
        }
        if (error.message.includes('not found') || error.message.includes('404')) {
            console.log("-> DIAGNOSIS: Model does not exist or access denied.");
        }
    }
}

async function run() {
    console.log("Starting Model diagnostics...");
    for (const m of modelsToTest) {
        await testModel(m);
    }
}

run();
