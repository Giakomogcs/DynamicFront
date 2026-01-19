/**
 * TEST PHASE 4: Canvas Intelligence (Simplified)
 * Testa CanvasGroupManager - decisão create vs merge
 */

import { canvasGroupManager } from '../src/canvas/CanvasGroupManager.js';

async function testPhase4() {
    console.log('🧪 TEST PHASE 4: Canvas Intelligence\n');

    try {
        // Test 1: Theme Similarity
        console.log('1️⃣ Testing theme similarity calculation...');

        const theme1 = { primary: 'Cursos SENAI' };
        const theme2 = { primary: 'Cursos SENAI' };
        const theme3 = { primary: 'Escolas SENAI' };
        const theme4 = { primary: 'Empresas' };

        const sim1 = canvasGroupManager.calculateThemeSimilarity(theme1, theme2);
        const sim2 = canvasGroupManager.calculateThemeSimilarity(theme1, theme3);
        const sim3 = canvasGroupManager.calculateThemeSimilarity(theme1, theme4);

        console.log(`   Similarity "Cursos SENAI" vs "Cursos SENAI": ${(sim1 * 100).toFixed(1)}%`);
        console.log(`   Similarity "Cursos SENAI" vs "Escolas SENAI": ${(sim2 * 100).toFixed(1)}%`);
        console.log(`   Similarity "Cursos SENAI" vs "Empresas": ${(sim3 * 100).toFixed(1)}%`);

        if (sim1 !== 1.0) {
            throw new Error('Identical themes should have 100% similarity');
        }
        console.log('   ✅ Theme similarity working correctly\n');

        // Test 2: Decision - No Existing Canvas
        console.log('2️⃣ Testing decision: no existing canvas...');

        const decision1 = await canvasGroupManager.decideCanvasAction(
            { userMessage: 'test' },
            { primary: 'Cursos' },
            []
        );

        console.log(`   Decision: ${decision1.action}`);
        console.log(`   Reason: ${decision1.reason}`);

        if (decision1.action !== 'create') {
            throw new Error('Should create when no existing canvas');
        }
        console.log('   ✅ Correctly decided to CREATE\n');

        // Test 3: Decision - High Similarity = Merge
        console.log('3️⃣ Testing decision: high similarity (merge)...');

        const existingCanvases = [
            {
                id: 'canvas-123',
                theme: { primary: 'Cursos SENAI' }
            }
        ];

        const decision2 = await canvasGroupManager.decideCanvasAction(
            { userMessage: 'test' },
            { primary: 'Cursos SENAI Florianópolis' },
            existingCanvases
        );

        console.log(`   Decision: ${decision2.action}`);
        console.log(`   Similarity: ${(decision2.similarity * 100).toFixed(1)}%`);
        console.log(`   Target: ${decision2.targetCanvasId || 'N/A'}`);

        if (decision2.action !== 'merge') {
            throw new Error('Should merge when similarity > 70%');
        }
        console.log('   ✅ Correctly decided to MERGE\n');

        // Test 4: Decision - Low Similarity = Create
        console.log('4️⃣ Testing decision: low similarity (create)...');

        const existingCanvases2 = [
            {
                id: 'canvas-456',
                theme: { primary: 'Empresas do Sul' }
            }
        ];

        const decision3 = await canvasGroupManager.decideCanvasAction(
            { userMessage: 'test' },
            { primary: 'Cursos de Programação' },
            existingCanvases2
        );

        console.log(`   Decision: ${decision3.action}`);
        console.log(`   Similarity: ${(decision3.similarity * 100).toFixed(1)}%`);

        if (decision3.action !== 'create') {
            throw new Error('Should create when similarity < 70%');
        }
        console.log('   ✅ Correctly decided to CREATE\n');

        // Test 5: Normalize Theme
        console.log('5️⃣ Testing theme normalization...');

        const normalized1 = canvasGroupManager.normalizeTheme('Cursos SENAI!!!');
        const normalized2 = canvasGroupManager.normalizeTheme('  cursos   senai  ');

        console.log(`   "Cursos SENAI!!!" → "${normalized1}"`);
        console.log(`   "  cursos   senai  " → "${normalized2}"`);

        if (normalized1 !== normalized2) {
            throw new Error('Normalization should produce same result');
        }
        console.log('   ✅ Theme normalization working\n');

        console.log('\n🎉 ALL PHASE 4 TESTS PASSED!\n');
        console.log('✅ Theme similarity calculation: Working');
        console.log('✅ Create vs Merge decision: Working');
        console.log('✅ Theme normalization: Working\n');

        console.log('📊 Key Achievement:');
        console.log('   → System intelligently decides when to create new canvas');
        console.log('   → System intelligently decides when to merge with existing');
        console.log('   → 70% similarity threshold working perfectly\n');

        return true;

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Run tests
testPhase4().then(success => {
    process.exit(success ? 0 : 1);
});
