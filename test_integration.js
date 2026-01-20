
import { modelManager } from './server/services/ai/ModelManager.js';
import { analyzeAuthFromDocs } from './server/handlers/auth_analyzer.js';

// Mock console to capture output for verification (optional)
// console.log = (...args) => process.stdout.write(args.join(' ') + '\n');
// console.warn = (...args) => process.stdout.write(args.join(' ') + '\n');

async function testIntegration() {
    console.log("🚀 Starting Integration Test...");

    try {
        // 1. Initialize ModelManager (will detect available providers)
        await modelManager.init();
        
        // Check available providers
        console.log("Providers:", Array.from(modelManager.providers.keys()));

        const docsUrl = 'https://api.aprendizagem-busca-curso.dev.senai.br/api/docs-json'; 
        
        console.log(`\nTesting Auth Analysis for: ${docsUrl}`);
        
        // This function internally uses modelManager.generateContentWithFailover
        // which defaults to 'gemini-2.0-flash' but should switch to 'copilot/gpt-4' 
        // if gemini is missing and copilot is available.
        const authConfig = await analyzeAuthFromDocs(docsUrl, null);

        console.log("\n✅ Auth Analysis Result:", JSON.stringify(authConfig, null, 2));

        if (authConfig.type) {
            console.log("\n✅ Test Passed: Successfully analyzed auth config.");
        } else {
            console.error("\n❌ Test Failed: Invalid auth config returned.");
            process.exit(1);
        }

    } catch (e) {
        console.error("\n❌ Test Failed with Error:", e);
        process.exit(1);
    }
}

testIntegration();
