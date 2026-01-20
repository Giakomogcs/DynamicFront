import { modelManager } from './services/ai/ModelManager.js';

/**
 * Test script to verify which AI providers and models are currently available
 */

const TEST_PROMPT = "Responda apenas com 'OK' se você está funcionando.";

async function testProvider(modelName) {
    console.log(`\n🧪 Testing: ${modelName}`);
    console.log('─'.repeat(60));

    try {
        const startTime = Date.now();

        const result = await modelManager.generateContent(TEST_PROMPT, {
            model: modelName,
            jsonMode: false
        });

        const duration = Date.now() - startTime;
        const response = result.response.text();

        console.log(`✅ SUCCESS (${duration}ms)`);
        console.log(`   Response: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);

        return {
            model: modelName,
            status: 'success',
            duration,
            response: response.substring(0, 200)
        };

    } catch (error) {
        console.log(`❌ FAILED`);
        console.log(`   Error: ${error.message.substring(0, 150)}${error.message.length > 150 ? '...' : ''}`);

        return {
            model: modelName,
            status: 'failed',
            error: error.message.substring(0, 300)
        };
    }
}

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 AI PROVIDER AVAILABILITY TEST');
    console.log('='.repeat(60));

    // Initialize ModelManager
    await modelManager.init();

    // Get all available models from settings
    const availableModels = await modelManager.getAvailableModels();

    console.log(`\n📋 Found ${availableModels.length} configured models:`);
    availableModels.forEach(m => console.log(`   - ${m}`));

    // Test each model
    const results = [];

    for (const modelName of availableModels) {
        const result = await testProvider(modelName);
        results.push(result);

        // Small delay between tests to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary Report
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');

    console.log(`\n✅ Working Models (${successful.length}):`);
    successful.forEach(r => {
        console.log(`   ✓ ${r.model} (${r.duration}ms)`);
    });

    console.log(`\n❌ Failed Models (${failed.length}):`);
    failed.forEach(r => {
        console.log(`   ✗ ${r.model}`);
        console.log(`     → ${r.error.split('\n')[0]}`);
    });

    // Provider Health Status
    console.log('\n' + '='.repeat(60));
    console.log('🏥 PROVIDER HEALTH STATUS');
    console.log('='.repeat(60));

    const providers = ['gemini', 'groq', 'openai', 'anthropic', 'xai'];
    providers.forEach(providerId => {
        const isHealthy = modelManager.isProviderHealthy(providerId);
        const status = isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY';
        console.log(`   ${providerId.padEnd(12)} → ${status}`);
    });

    // Metrics
    console.log('\n' + '='.repeat(60));
    console.log('📈 USAGE METRICS');
    console.log('='.repeat(60));
    const metrics = modelManager.getMetrics();
    console.log(JSON.stringify(metrics, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('✨ Test Complete!');
    console.log('='.repeat(60) + '\n');

    // Exit
    process.exit(successful.length > 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
    console.error('\n💥 Fatal Error:', error);
    process.exit(1);
});
