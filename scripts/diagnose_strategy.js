// Teste de diagnóstico - Identifica problemas na estratégia

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

console.log('🔍 DIAGNÓSTICO: "Tela da empresa com filiais"\n');

async function diagnosticTest() {
    const testRequest = {
        message: 'quero uma tela da minha empresa contendo meus dados, filiais espalhadas por regiões',
        history: [],
        model: 'copilot/gpt-4'
    };

    console.log('📤 Enviando request...\n');

    try {
        const startTime = Date.now();
        const response = await fetch(`${BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testRequest)
        });

        const duration = Date.now() - startTime;
        const data = await response.json();

        console.log(`⏱️  Tempo: ${duration}ms`);
        console.log(`📊 Status: ${response.status}\n`);

        // Análise detalhada
        console.log('═══════════════════════════════════════════════════════\n');
        console.log('📋 RESULTADO:\n');

        if (data.text) {
            console.log('Texto:');
            console.log(data.text.substring(0, 500));
            console.log();
        }

        if (data.widgets) {
            console.log(`Widgets gerados: ${data.widgets.length}`);
            data.widgets.forEach((w, i) => {
                console.log(`  ${i + 1}. ${w.type}: ${w.title || 'sem título'}`);
                if (w.dataSource) {
                    console.log(`     ✅ DataSource: ${w.dataSource.tool}`);
                    console.log(`     🔐 Auth: ${w.dataSource.authProfile}`);
                }
            });
            console.log();
        }

        if (data.error) {
            console.log('❌ ERRO:', data.error);
        }

        // Análise de problemas
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('🔍 ANÁLISE DE PROBLEMAS:\n');

        const issues = [];

        // Problema 1: Texto sugere falta de dados
        if (data.text && (
            data.text.includes('não consegui') ||
            data.text.includes('Tentei') ||
            data.text.includes('Sugestões') ||
            data.text.includes('reformular')
        )) {
            issues.push({
                tipo: 'StrategicAgent falhou',
                causa: 'Não conseguiu obter dados após múltiplas tentativas',
                solução: 'Verificar se tools corretas existem e se auth está funcionando'
            });
        }

        // Problema 2: Sem widgets
        if (!data.widgets || data.widgets.length === 0) {
            issues.push({
                tipo: 'Designer não gerou widgets',
                causa: 'Sem dados para visualizar ou Designer falhou',
                solução: 'Verificar se Executor retornou dados ou melhorar prompt do Designer'
            });
        }

        // Problema 3: Widgets sem dataSource
        if (data.widgets && data.widgets.length > 0) {
            const semDataSource = data.widgets.filter(w => !w.dataSource);
            if (semDataSource.length > 0) {
                issues.push({
                    tipo: `${semDataSource.length} widgets sem dataSource`,
                    causa: 'Designer não adicionou metadata de auto-refresh',
                    solução: 'Verificar se steps estão sendo passados para Designer'
                });
            }
        }

        if (issues.length === 0) {
            console.log('✅ Nenhum problema detectado!\n');
        } else {
            issues.forEach((issue, i) => {
                console.log(`${i + 1}. ❌ ${issue.tipo}`);
                console.log(`   Causa: ${issue.causa}`);
                console.log(`   Solução: ${issue.solução}\n`);
            });
        }

        // Sugestões de melhoria
        console.log('═══════════════════════════════════════════════════════');
        console.log('💡 SUGESTÕES DE MELHORIA:\n');

        console.log('1. 🔧 Verificar tools disponíveis:');
        console.log('   - getCompanyProfile existe?');
        console.log('   - listEnterprise existe?');
        console.log('   - Planner está selecionando tools corretas?\n');

        console.log('2. 🔐 Verificar autenticação:');
        console.log('   - Multi-auth detectou contexto "empresa"?');
        console.log('   - Credenciais do perfil "company" estão corretas?');
        console.log('   - API retorna 401/403?\n');

        console.log('3. 📊 Melhorar estratégia do StrategicAgent:');
        console.log('   - Adicionar fallback: se empresa falha, pedir CNPJ');
        console.log('   - Tentar tools alternativas (dashboard geral)');
        console.log('   - Logar melhor o motivo de cada falha\n');

        console.log('4. 🎨 Melhorar Designer:');
        console.log('   - Gerar widgets mesmo com dados parciais');
        console.log('   - Criar placeholder quando não há dados');
        console.log('   - Sugerir ação ao usuário (ex: "Configure CNPJ")\n');

    } catch (error) {
        console.log('❌ ERRO NA REQUISIÇÃO:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Servidor não está rodando!');
            console.log('   Execute: npm run dev');
        }
    }
}

// Teste 2: Verificar tools disponíveis
async function checkAvailableTools() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔧 VERIFICANDO TOOLS DISPONÍVEIS:\n');

    try {
        const res = await fetch(`${BASE_URL}/api/resources`);
        const resources = await res.json();

        console.log(`Total de recursos: ${resources.length}\n`);

        const apiDN = resources.find(r => r.name && r.name.includes('DN'));
        if (apiDN) {
            console.log(`✅ API DN encontrada: ${apiDN.name}`);
            console.log(`   ID: ${apiDN.id}`);
            console.log(`   Enabled: ${apiDN.isEnabled}\n`);

            // Buscar tools dessa API
            const toolsRes = await fetch(`${BASE_URL}/api/resources/api/${apiDN.id}/tools`);
            const tools = await toolsRes.json();

            console.log(`   Tools disponíveis: ${tools.length}`);

            const relevantes = tools.filter(t =>
                t.name.includes('company') ||
                t.name.includes('enterprise') ||
                t.name.includes('Companies')
            );

            console.log(`   Tools de empresa: ${relevantes.length}\n`);
            relevantes.forEach(t => {
                console.log(`   - ${t.name}`);
            });

        } else {
            console.log('❌ API DN não encontrada!');
        }

    } catch (error) {
        console.log('❌ Erro ao buscar tools:', error.message);
    }
}

// Executar testes
console.log('Iniciando diagnóstico...\n');
await diagnosticTest();
await checkAvailableTools();

console.log('\n═══════════════════════════════════════════════════════');
console.log('✅ DIAGNÓSTICO COMPLETO');
console.log('═══════════════════════════════════════════════════════\n');
