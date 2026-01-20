import { orchestrator } from './agents/Orchestrator.js';
import { resourceEnricher } from './src/core/ResourceEnricher.js';

async function testE2EAuthFlow() {
    console.log('\n=== E2E AUTHENTICATION FLOW TEST ===\n');

    try {
        // 1. Carregar profiles
        console.log('1. Loading auth profiles from database...');
        await resourceEnricher.loadProfiles();
        const allProfiles = resourceEnricher.getAllProfiles();
        console.log(`   ✓ Loaded ${allProfiles.length} profiles total\n`);

        // 2. Fazer uma query real que requer autenticação
        const testQuery = "Liste os cursos de mecânica disponíveis";
        console.log(`2. Sending test query: "${testQuery}"\n`);

        console.log('3. Orchestrator processing request...');
        const result = await orchestrator.processRequest(
            testQuery,
            [], // empty history
            'gemini-2.0-flash-thinking-exp-1219', // model
            null, // location
            null  // canvas context
        );

        console.log('\n4. Result Analysis:\n');

        if (result.error) {
            console.log('   ❌ FAILED');
            console.log('   Error:', result.error);
            console.log('   Text:', result.text);
            return;
        }

        if (result.text) {
            console.log('   ✅ SUCCESS');
            console.log('   Response preview:', result.text.substring(0, 200) + '...');
        }

        if (result.canvasData) {
            console.log(`   📊 Canvas generated with ${result.canvasData.widgets?.length || 0} widgets`);
        }

        // 5. Verificar se autenticação foi usada
        console.log('\n5. Authentication Check:');

        // Verificar logs para confirmar que autenticação aconteceu
        if (result.text && !result.text.includes('autenticação necessária') && !result.text.includes('precisa fazer login')) {
            console.log('   ✓ Query executed successfully (auth likely worked)');
        } else {
            console.log('   ⚠️ Query may have failed due to auth');
        }

        console.log('\n=== TEST COMPLETE ===\n');

    } catch (error) {
        console.error('\n❌ E2E Test Failed:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testE2EAuthFlow();
