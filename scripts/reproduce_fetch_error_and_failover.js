
import { modelManager } from '../server/services/ai/ModelManager.js';
import { GeminiProvider } from '../server/services/ai/providers/GeminiProvider.js';

// Mock Provider that fails with fetch error
class FailingProvider extends GeminiProvider {
    constructor() {
        super({ apiKey: 'fake' });
        this.id = 'gemini'; // Masquerade as Gemini
    }

    async generateContent() {
        throw new Error("fetch failed");
    }
}

async function testFailover() {
    console.log("--- Starting Failover Test (Network Error) ---");

    // 1. Force Initialize ModelManager
    await modelManager.init();

    // 2. Inject Failing Provider manually into the map
    const failingProvider = new FailingProvider();
    modelManager.providers.set('gemini', failingProvider);

    // 3. Ensure we have a backup provider (Mocking Groq for safety in case no key)
    // Actually, ModelManager loads settings. If no keys, failover might fail too. 
    // But we just want to see the failover LOGS in console.

    try {
        console.log("Triggering request that should fail...");
        // We ask for a Gemini model, which maps to our FailingProvider
        await modelManager.generateContent("Hello", { model: 'gemini-2.0-flash' });
    } catch (e) {
        console.log("Caught expected error (or final error):", e.message);
    }
}

testFailover();
