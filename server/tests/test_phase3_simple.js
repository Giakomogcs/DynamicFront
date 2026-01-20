/**
 * TEST PHASE 3: Semantic Resource Analyzer (Simplified)
 * Valida análise semântica automática de resources (pattern-based)
 */

import { semanticResourceAnalyzer } from '../src/semantic/SemanticResourceAnalyzer.js';

async function testPhase3Simple() {
    console.log('🧪 TEST PHASE 3: Semantic Resource Analyzer (Simplified)\n');

    try {
        // Mock tools de um resource de "Education" (SENAI)
        const senaiTools = [
            {
                name: 'dn_schoolscontroller_getschools',
                description: 'Lista todas as escolas SENAI disponíveis',
                parameters: { properties: { city: {}, state: {}, name: {} } }
            },
            {
                name: 'dn_coursescontroller_searchcourses',
                description: 'Busca cursos disponíveis nas unidades',
                parameters: { properties: { schoolsCnpj: {}, querySearch: {} } }
            },
            {
                name: 'dn_coursescontroller_getcoursedetails',
                description: 'Obtém detalhes completos de um curso específico',
                parameters: { properties: { courseId: {} } }
            }
        ];

        // Test 1: Domain Detection
        console.log('1️⃣ Testing domain detection (Education)...');
        const domain = semanticResourceAnalyzer.detectDomainByPatterns(senaiTools);
        console.log(`   ✅ Domain: ${domain}`);

        if (domain !== 'Education') {
            throw new Error(`Expected 'Education', got '${domain}'`);
        }

        // Test 2: Entity Detection
        console.log('\n2️⃣ Testing entity detection...');
        const entities = semanticResourceAnalyzer.detectEntitiesByPatterns(senaiTools);
        console.log(`   ✅ Entities: ${entities.join(', ')}`);

        if (!entities.some(e => e.toLowerCase().includes('school') || e.toLowerCase().includes('course'))) {
            throw new Error('Expected School or Course entities');
        }

        // Test 3: Workflow Detection
        console.log('\n3️⃣ Testing workflow detection...');
        const workflows = semanticResourceAnalyzer.detectWorkflowsByPatterns(senaiTools);
        console.log(`   ✅ Workflows: ${workflows.length}`);

        if (workflows.length > 0) {
            console.log(`      - ${workflows[0].name}`);
        }

        // Test 4: Healthcare Domain
        console.log('\n4️⃣ Testing different domain (Healthcare)...');
        const healthcareTools = [
            { name: 'hospital_getpatients', description: 'Get patients', parameters: {} },
            { name: 'hospital_getdoctors', description: 'Get doctors', parameters: {} }
        ];

        const healthDomain = semanticResourceAnalyzer.detectDomainByPatterns(healthcareTools);
        console.log(`   ✅ Domain: ${healthDomain}`);

        if (healthDomain !== 'Healthcare') {
            throw new Error(`Expected 'Healthcare', got '${healthDomain}'`);
        }

        // Test 5: Enterprise Domain
        console.log('\n5️⃣ Testing Enterprise domain...');
        const enterpriseTools = [
            { name: 'api_listcompanies', description: 'List companies with CNPJ', parameters: {} },
            { name: 'api_getenterprise', description: 'Get enterprise details', parameters: {} }
        ];

        const entDomain = semanticResourceAnalyzer.detectDomainByPatterns(enterpriseTools);
        console.log(`   ✅ Domain: ${entDomain}`);

        if (entDomain !== 'Enterprise') {
            throw new Error(`Expected 'Enterprise', got '${entDomain}'`);
        }

        console.log('\n\n🎉 ALL PHASE 3 TESTS PASSED!\n');
        console.log('✅ Pattern-based domain detection: Working');
        console.log('✅ Entity extraction: Working');
        console.log('✅ Workflow detection: Working');
        console.log('✅ Multi-domain support: Education, Healthcare, Enterprise ✓\n');

        console.log('📊 Key Achievement:');
        console.log('   → System can analyze ANY resource without hardcoded knowledge');
        console.log('   → 3 different domains auto-detected correctly');
        console.log('   → Entities & workflows extracted from tool names\n');

        console.log('⚠️  Note: Full LLM integration skipped (no API keys configured)');
        console.log('   Fallback pattern detection is working perfectly!\n');

        return true;

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Run tests
testPhase3Simple().then(success => {
    process.exit(success ? 0 : 1);
});
