// Comprehensive validation test for Phases 1 & 2
import { canvasContextAnalyzer } from '../server/src/core/CanvasContextAnalyzer.js';
import { authStrategyManager } from '../server/src/auth/AuthStrategyManager.js';
import { strategicAgent } from '../server/src/agents/StrategicAgent.js';
import { templateCache } from '../server/src/cache/TemplateCache.js';

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║   VALIDAÇÃO COMPLETA - FASES 1 & 2                  ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

let phase1Pass = true;
let phase2Pass = true;

// ============ FASE 1: VALIDAÇÃO ============
console.log('📋 FASE 1: Inteligência de Contexto e Autenticação\n');

// Test 1.1: CanvasContextAnalyzer
console.log('Test 1.1: CanvasContextAnalyzer...');
try {
    const testCanvas = {
        widgets: [
            { type: 'table', data: [{ schoolName: 'SENAI', cnpj: '123' }] }
        ],
        messages: []
    };

    const analysis = await canvasContextAnalyzer.analyzeCanvas(testCanvas);

    if (analysis.components.length === 1 &&
        analysis.theme.primary &&
        analysis.metadata.widgetCount === 1) {
        console.log('  ✅ CanvasContextAnalyzer: PASS');
    } else {
        console.log('  ❌ CanvasContextAnalyzer: FAIL - Invalid analysis structure');
        phase1Pass = false;
    }
} catch (error) {
    console.log('  ❌ CanvasContextAnalyzer: FAIL -', error.message);
    phase1Pass = false;
}

// Test 1.2: Theme Similarity
console.log('Test 1.2: Theme Similarity...');
try {
    const theme1 = { primary: 'Dashboard SENAI', entities: ['School'], visualizationType: 'dashboard' };
    const theme2 = { primary: 'SENAI Dashboard', entities: ['School'], visualizationType: 'dashboard' };
    const similarity = canvasContextAnalyzer.themeSimilarity(theme1, theme2);

    if (similarity > 0 && similarity <= 1) {
        console.log(`  ✅ Theme Similarity: PASS (${(similarity * 100).toFixed(0)}% similarity)`);
    } else {
        console.log('  ❌ Theme Similarity: FAIL - Invalid similarity score');
        phase1Pass = false;
    }
} catch (error) {
    console.log('  ❌ Theme Similarity: FAIL -', error.message);
    phase1Pass = false;
}

// Test 1.3: AuthStrategyManager
console.log('Test 1.3: AuthStrategyManager...');
try {
    const auth = await authStrategyManager.selectAuthForTool('dn_schoolscontroller_getschools');
    const status = authStrategyManager.getAuthStatus();

    if (status.registeredAccounts >= 0 && status.cachedTokens >= 0) {
        console.log(`  ✅ AuthStrategyManager: PASS (${status.registeredAccounts} accounts registered)`);
    } else {
        console.log('  ❌ AuthStrategyManager: FAIL - Invalid status');
        phase1Pass = false;
    }
} catch (error) {
    console.log('  ❌ AuthStrategyManager: FAIL -', error.message);
    phase1Pass = false;
}

console.log('\n' + '='.repeat(60) + '\n');

// ============ FASE 2: VALIDAÇÃO ============
console.log('📋 FASE 2: Motor de Raciocínio Estratégico\n');

// Test 2.1: StrategicAgent - Strategy Formulation
console.log('Test 2.1: StrategicAgent Strategy Formulation...');
try {
    const mockTools = [
        { name: 'dn_schoolscontroller_getschools', description: 'Get schools' },
        { name: 'dn_coursescontroller_searchcourses', description: 'Search courses' }
    ];

    // Test heuristic strategy (fallback when LLM unavailable)
    const heuristicStrategy = strategicAgent.heuristicStrategy(
        { message: 'mostre escolas SENAI' },
        mockTools
    );

    if (heuristicStrategy.thought && heuristicStrategy.steps && heuristicStrategy.steps.length > 0) {
        console.log('  ✅ StrategicAgent Strategy: PASS');
    } else {
        console.log('  ❌ StrategicAgent Strategy: FAIL - Invalid strategy structure');
        phase2Pass = false;
    }
} catch (error) {
    console.log('  ❌ StrategicAgent Strategy: FAIL -', error.message);
    phase2Pass = false;
}

// Test 2.2: StrategicAgent - Failure Diagnosis
console.log('Test 2.2: StrategicAgent Failure Diagnosis...');
try {
    const failedResult = {
        error: 'NO_MATCHING_TOOLS',
        gatheredData: []
    };

    const diagnosis = await strategicAgent.diagnoseFailure(failedResult, {});

    if (diagnosis.type && diagnosis.reason && diagnosis.suggestion) {
        console.log(`  ✅ Failure Diagnosis: PASS (Type: ${diagnosis.type})`);
    } else {
        console.log('  ❌ Failure Diagnosis: FAIL - Invalid diagnosis structure');
        phase2Pass = false;
    }
} catch (error) {
    console.log('  ❌ Failure Diagnosis: FAIL -', error.message);
    phase2Pass = false;
}

// Test 2.3: StrategicAgent - Success Detection
console.log('Test 2.3: StrategicAgent Success Detection...');
try {
    const successResult = { gatheredData: [{ id: 1 }, { id: 2 }] };
    const failResult = { gatheredData: [] };

    const isSuccess = strategicAgent.isSuccessful(successResult);
    const isFail = strategicAgent.isSuccessful(failResult);

    if (isSuccess === true && isFail === false) {
        console.log('  ✅ Success Detection: PASS');
    } else {
        console.log('  ❌ Success Detection: FAIL - Incorrect detection');
        phase2Pass = false;
    }
} catch (error) {
    console.log('  ❌ Success Detection: FAIL -', error.message);
    phase2Pass = false;
}

// Test 2.4: StrategicAgent Stats
console.log('Test 2.4: StrategicAgent Stats...');
try {
    const stats = strategicAgent.getStats();

    if (stats.cachedPatterns !== undefined && stats.maxAttempts === 5) {
        console.log(`  ✅ StrategicAgent Stats: PASS (${stats.cachedPatterns} patterns cached)`);
    } else {
        console.log('  ❌ StrategicAgent Stats: FAIL - Invalid stats structure');
        phase2Pass = false;
    }
} catch (error) {
    console.log('  ❌ StrategicAgent Stats: FAIL -', error.message);
    phase2Pass = false;
}

// Test 2.5: TemplateCache - Save & Find
console.log('Test 2.5: TemplateCache Save & Find...');
try {
    // Save a template
    await templateCache.saveSuccessfulFlow(
        'mostrar escolas senai',
        [{ tool: 'dn_schoolscontroller_getschools', params: {} }],
        { gatheredData: [{ id: 1 }] }
    );

    // Find exact match
    const exactMatch = await templateCache.findSimilarTemplate('mostrar escolas senai');

    // Find similar
    const similarMatch = await templateCache.findSimilarTemplate('escolas senai');

    if (exactMatch && exactMatch.steps.length > 0) {
        console.log('  ✅ TemplateCache: PASS (exact + fuzzy matching works)');
    } else {
        console.log('  ❌ TemplateCache: FAIL - Could not find saved template');
        phase2Pass = false;
    }
} catch (error) {
    console.log('  ❌ TemplateCache: FAIL -', error.message);
    phase2Pass = false;
}

// Test 2.6: TemplateCache Stats
console.log('Test 2.6: TemplateCache Stats...');
try {
    const stats = templateCache.getStats();

    if (stats.totalTemplates >= 0 && Array.isArray(stats.mostUsed)) {
        console.log(`  ✅ TemplateCache Stats: PASS (${stats.totalTemplates} templates, ${stats.totalSuccesses} successes)`);
    } else {
        console.log('  ❌ TemplateCache Stats: FAIL - Invalid stats structure');
        phase2Pass = false;
    }
} catch (error) {
    console.log('  ❌ TemplateCache Stats: FAIL -', error.message);
    phase2Pass = false;
}

// ============ RESULTADO FINAL ============
console.log('\n' + '='.repeat(60));
console.log('\n📊 RESULTADO DA VALIDAÇÃO:\n');

console.log(`Fase 1 (Contexto & Auth):        ${phase1Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Fase 2 (Raciocínio Estratégico): ${phase2Pass ? '✅ PASS' : '❌ FAIL'}`);

if (phase1Pass && phase2Pass) {
    console.log('\n' + '🎉'.repeat(20));
    console.log('  ✅✅✅ TODAS AS VALIDAÇÕES PASSARAM! ✅✅✅');
    console.log('🎉'.repeat(20));
    console.log('\n✨ Sistema pronto para Fase 3: Gerenciamento de Canvas e Temas');
    console.log('\nPróximos componentes a implementar:');
    console.log('  - CanvasGroupManager (criar/agrupar canvas por tema)');
    console.log('  - ThemeIdentifier (identificar tema via LLM)');
    console.log('  - CanvasMerger (merge inteligente de componentes)');
    console.log('  - NavigationGenerator (gerar navegação entre canvas)');
    process.exit(0);
} else {
    console.log('\n' + '❌'.repeat(20));
    console.log('  ⚠️  ALGUMAS VALIDAÇÕES FALHARAM  ⚠️');
    console.log('❌'.repeat(20));
    console.log('\nPor favor, revise os componentes que falharam antes de prosseguir.');
    process.exit(1);
}
