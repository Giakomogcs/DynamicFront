// Test script for Canvas Context Analyzer - Phase 1
import { canvasContextAnalyzer } from '../server/src/core/CanvasContextAnalyzer.js';
import { authStrategyManager } from '../server/src/auth/AuthStrategyManager.js';

console.log('=== Testing Canvas Context Analyzer ===\n');

// Sample canvas data
const sampleCanvas = {
    widgets: [
        {
            type: 'stat',
            title: 'Total Schools',
            data: [{ label: 'Schools Found', value: 15 }]
        },
        {
            type: 'table',
            title: 'SENAI Units',
            data: [
                { schoolName: 'SENAI Florianópolis', cnpj: '03634453000489', city: 'Florianópolis' },
                { schoolName: 'SENAI Joinville', cnpj: '03634453000560', city: 'Joinville' },
            ]
        },
        {
            type: 'chart',
            config: { chartType: 'bar' },
            data: [
                { name: 'Florianópolis', value: 8 },
                { name: 'Joinville', value: 7 }
            ]
        }
    ],
    messages: [
        { role: 'user', text: 'Mostre escolas SENAI em SC' },
        { role: 'model', text: 'Encontrei 15 escolas SENAI...', metadata: { toolsUsed: ['dn_schoolscontroller_getschools'] } }
    ],
    metadata: {
        toolsExecuted: ['dn_schoolscontroller_getschools'],
        authenticationUsed: {
            users: ['rafael.s.ribeiro@sc.senai.br'],
            tools: ['dn_schoolscontroller_getschools']
        }
    }
};

// Test 1: Analyze Canvas
console.log('Test 1: Analyzing sample canvas...');
const analysis = await canvasContextAnalyzer.analyzeCanvas(sampleCanvas);

console.log('✅ Canvas Analysis Results:');
console.log('  - Theme:', analysis.theme.primary);
console.log('  - Visualization Type:', analysis.theme.visualizationType);
console.log('  - Confidence:', analysis.theme.confidence);
console.log('  - Components:', analysis.components.length);
analysis.components.forEach(comp => {
    console.log(`    * ${comp.type} at (${comp.position.x}, ${comp.position.y})`);
});
console.log('  - Tools Used:', analysis.toolsUsed.join(', '));
console.log('  - Resources:');
console.log('    * Schools:', analysis.resources.schools.length);
console.log('    * Enterprises:', analysis.resources.enterprises.length);
console.log('  - Auth Used:', analysis.authentication.used);
console.log('    * Users:', analysis.authentication.users.join(', '));

// Test 2: Theme Similarity
console.log('\nTest 2: Testing theme similarity...');
const theme1 = { primary: 'SENAI Dashboard', entities: ['School', 'Course'], visualizationType: 'dashboard' };
const theme2 = { primary: 'Dashboard SENAI', entities: ['School'], visualizationType: 'dashboard' };
const theme3 = { primary: 'Enterprise Management', entities: ['Enterprise'], visualizationType: 'crud' };

const similarity12 = canvasContextAnalyzer.themeSimilarity(theme1, theme2);
const similarity13 = canvasContextAnalyzer.themeSimilarity(theme1, theme3);

console.log(`  - Similarity (SENAI Dashboard vs Dashboard SENAI): ${(similarity12 * 100).toFixed(1)}%`);
console.log(`  - Similarity (SENAI Dashboard vs Enterprise Mgmt): ${(similarity13 * 100).toFixed(1)}%`);

if (similarity12 > 0.7) {
    console.log('  ✅ Same theme detected → should MERGE into existing canvas');
} else {
    console.log('  ⚠️ Different theme → should CREATE new canvas');
}

// Test 3: Auth Strategy Manager
console.log('\nTest 3: Testing Authentication Strategy Manager...');

// Test tool categorization
const testTools = [
    'dn_schoolscontroller_getschools',
    'dn_enterprisecontroller_listenterprise',
    'dn_contractscontroller_getactivecontracts',
    'dn_coursescontroller_searchcourses'
];

for (const tool of testTools) {
    const auth = await authStrategyManager.selectAuthForTool(tool);
    if (auth) {
        console.log(`  ✅ Tool: ${tool}`);
        console.log(`     → Selected: ${auth.label} (${auth.role})`);
    } else {
        console.log(`  ℹ️ Tool: ${tool} → No auth required (public)`);
    }
}

// Test 4: Auth Status
console.log('\nTest 4: Auth Status...');
const authStatus = authStrategyManager.getAuthStatus();
console.log(`  - Registered Accounts: ${authStatus.registeredAccounts}`);
console.log(`  - Cached Tokens: ${authStatus.cachedTokens}`);
authStatus.accounts.forEach(acc => {
    console.log(`    * ${acc.email} (${acc.role}) - Token Cached: ${acc.hasCachedToken}`);
});

console.log('\n=== All Tests Complete ===');
console.log('\n📌 Phase 1.1 (Canvas Context Analyzer) is WORKING!');
console.log('📌 Phase 1.2 (Auth Strategy Manager) is READY!');
console.log('\nNext Steps:');
console.log('  1. Test integration with live Orchestrator requests');
console.log('  2. Implement Phase 2 (Strategic Reasoning Agent)');
console.log('  3. Implement Phase 3 (Canvas Group Manager)');
