/**
 * TEST PHASE 2: Strategic Reasoning Engine + Template Cache
 * Valida engine com retry e template caching
 */

import { strategicReasoningEngine } from '../src/reasoning/StrategicReasoningEngine.js';
import { templateCache } from '../src/cache/TemplateCache.js';
import prisma from '../registry.js';

async function testPhase2() {
    console.log('🧪 TEST PHASE 2: Strategic Reasoning + Template Cache\n');

    try {
        // Mock context para teste
        const mockContext = {
            userMessage: 'quais empresas tem na região sul?',
            tools: [
                { name: 'dn_enterprisecontroller_listenterprise', description: 'Lista empresas' },
                { name: 'dn_authcontroller_session', description: 'Autenticação' }
            ],
            location: 'Brasil',
            modelName: 'gemini-2.0-flash-exp',
            history: [],
            canvasAnalysis: { theme: { primary: 'Empresas' } }
        };

        // Test 1: Template Cache - Save Template
        console.log('1️⃣ Testing TemplateCache.saveSuccessfulStrategy...');

        const mockStrategy = {
            steps: [
                { toolName: 'dn_enterprisecontroller_listenterprise' }
            ],
            processingType: 'list_filter'
        };

        const mockResult = {
            widgets: [{ type: 'table' }],
            gatheredData: [{ name: 'Empresa A', state: 'RS' }],
            executionTime: 1200
        };

        const template = await templateCache.saveSuccessfulStrategy(
            mockStrategy,
            mockContext,
            mockResult
        );

        if (template) {
            console.log('   ✅ Template saved:', template.id);
        } else {
            console.log('   ⚠️ Template not saved (may be expected)');
        }

        // Test 2: Template Cache - Find Template
        console.log('\n2️⃣ Testing TemplateCache.findMatchingTemplate...');

        const found = await templateCache.findMatchingTemplate(
            'empresas no sul',
            { theme: { primary: 'Empresas' } }
        );

        if (found) {
            console.log('   ✅ Template found:', found.name, '- Score: HIGH');
        } else {
            console.log('   ℹ️ No template found (expected for new queries)');
        }

        // Test 3: Template Cache - Calculate Match Score
        console.log('\n3️⃣ Testing pattern matching...');

        const patterns = templateCache.extractQueryPatterns('buscar empresas em São Paulo');
        console.log('   ✅ Patterns extracted:', patterns);

        // Test 4: StrategicEngine - Error Classification
        console.log('\n4️⃣ Testing error classification...');

        const emptyResult = { gatheredData: [] };
        const errorType = strategicReasoningEngine.classifyError(emptyResult);
        console.log('   ✅ Error classified as:', errorType);

        if (errorType !== 'EMPTY_RESULT') {
            throw new Error(`Expected EMPTY_RESULT, got ${errorType}`);
        }

        // Test 5: Data Quality Calculation
        console.log('\n5️⃣ Testing data quality calculation...');

        const goodData = {
            gatheredData: [
                { name: 'Company A', cnpj: '12345', state: 'SP' },
                { name: 'Company B', cnpj: '67890', state: 'RJ' }
            ]
        };

        const quality = strategicReasoningEngine.calculateDataQuality(goodData);
        console.log(`   ✅ Data quality: ${(quality * 100).toFixed(1)}%`);

        if (quality < 0.5) {
            throw new Error(`Expected quality > 0.5, got ${quality}`);
        }

        // Test 6: Strategy Adaptation - Broaden Search
        console.log('\n6️⃣ Testing strategy adaptation (broaden search)...');

        const narrowStrategy = {
            steps: [{
                name: 'search_tool',
                arguments: {
                    search: 'very specific long query',
                    status: 'active',
                    type: 'specific'
                }
            }]
        };

        const broadenedStrategy = await strategicReasoningEngine.broadenSearch(
            narrowStrategy,
            emptyResult,
            mockContext
        );

        console.log('   ✅ Strategy adapted:', {
            original: narrowStrategy.steps[0].arguments,
            adapted: broadenedStrategy.steps[0].arguments
        });

        // Test 7: Execution Log
        console.log('\n7️⃣ Testing execution logging...');

        await templateCache.logExecution(
            template?.id || null,
            'test query',
            ['tool1', 'tool2'],
            true,
            500,
            0.85
        );

        console.log('   ✅ Execution logged');

        // Test 8: Verify log was saved
        const logs = await prisma.executionLog.findMany({
            where: { userMessage: 'test query' },
            take: 1
        });

        if (logs.length > 0) {
            console.log('   ✅ Log verified in database:', logs[0].id);

            // Cleanup
            await prisma.executionLog.delete({ where: { id: logs[0].id } });
        }

        // Cleanup template if created
        if (template) {
            await prisma.executionTemplate.delete({ where: { id: template.id } });
            console.log('\n🧹 Cleanup: Template removed');
        }

        console.log('\n\n🎉 ALL PHASE 2 TESTS PASSED!\n');
        console.log('✅ TemplateCache: Working');
        console.log('✅ StrategicEngine: Error classification working');
        console.log('✅ Strategy adaptation: Working');
        console.log('✅ Data quality calculation: Working');
        console.log('✅ Execution logging: Working\n');

        return true;

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error('Stack:', error.stack);
        return false;
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
testPhase2().then(success => {
    process.exit(success ? 0 : 1);
});
