/**
 * TEST PHASE 1: Database Validation
 * Valida que todas as tabelas foram criadas corretamente
 */

import prisma from '../registry.js';

async function testDatabaseSetup() {
    console.log('🧪 TEST PHASE 1: Database Validation\n');

    try {
        // Test 1: CanvasGroup table
        console.log('1️⃣ Testing CanvasGroup table...');
        const testGroup = await prisma.canvasGroup.create({
            data: {
                conversationId: 'test-conversation-001',
                name: 'Test Group',
                description: 'Testing canvas groups'
            }
        });
        console.log('   ✅ CanvasGroup created:', testGroup.id);

        // Test 2: ExecutionTemplate table
        console.log('\n2️⃣ Testing ExecutionTemplate table...');
        const testTemplate = await prisma.executionTemplate.create({
            data: {
                name: 'test_template',
                queryPatterns: ['test', 'demo'],
                toolSequence: ['tool1', 'tool2'],
                processingLogic: 'test_logic',
                widgetTypes: ['table', 'chart'],
                avgExecutionTimeMs: 1000
            }
        });
        console.log('   ✅ ExecutionTemplate created:', testTemplate.id);

        // Test 3: ExecutionLog table
        console.log('\n3️⃣ Testing ExecutionLog table...');
        const testLog = await prisma.executionLog.create({
            data: {
                templateId: testTemplate.id,
                userMessage: 'Test query',
                toolsCalled: ['tool1'],
                success: true,
                executionTimeMs: 500,
                dataQuality: 0.9
            }
        });
        console.log('   ✅ ExecutionLog created:', testLog.id);

        // Test 4: ResourceSemantics table
        console.log('\n4️⃣ Testing ResourceSemantics table...');
        const testSemantics = await prisma.resourceSemantics.create({
            data: {
                resourceId: 'test_resource',
                domain: 'Testing',
                subDomains: ['Unit Tests'],
                entities: [{ name: 'TestEntity', role: 'primary' }],
                workflows: [{ name: 'Test Workflow', steps: ['step1'] }],
                relationships: []
            }
        });
        console.log('   ✅ ResourceSemantics created:', testSemantics.id);

        // Test 5: EntityRelation table  
        console.log('\n5️⃣ Testing EntityRelation table...');
        const testRelation = await prisma.entityRelation.create({
            data: {
                fromEntity: 'EntityA',
                toEntity: 'EntityB',
                relationType: 'has_many',
                viaParam: 'entityBId',
                strength: 0.85
            }
        });
        console.log('   ✅ EntityRelation created:', testRelation.id);

        // Query Test: Verify relationships
        console.log('\n6️⃣ Testing relationships...');
        const templateWithLogs = await prisma.executionTemplate.findUnique({
            where: { id: testTemplate.id },
            include: { executions: true }
        });
        console.log('   ✅ Template with logs:', {
            templateId: templateWithLogs.id,
            executionCount: templateWithLogs.executions.length
        });

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await prisma.executionLog.delete({ where: { id: testLog.id } });
        await prisma.executionTemplate.delete({ where: { id: testTemplate.id } });
        await prisma.canvasGroup.delete({ where: { id: testGroup.id } });
        await prisma.resourceSemantics.delete({ where: { id: testSemantics.id } });
        await prisma.entityRelation.delete({ where: { id: testRelation.id } });
        console.log('   ✅ Cleanup complete');

        console.log('\n\n🎉 ALL TESTS PASSED! Database is ready for Phase 2.\n');
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
testDatabaseSetup().then(success => {
    process.exit(success ? 0 : 1);
});
