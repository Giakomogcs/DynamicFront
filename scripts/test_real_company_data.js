// Direct test: Auth + Company Data + Filiais
// This tests the REAL flow the user requested
console.log('=== TESTE DIRETO: DADOS DA EMPRESA + FILIAIS ===\n');

const API_BASE = 'https://dn-api-dev.southcentralus.cloudapp.azure.com:3010/api';

// Step 1: Authenticate
console.log('Step 1: Autenticando com rafael.s.ribeiro@sc.senai.br...');

const authResponse = await fetch(`${API_BASE}/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        email: 'rafael.s.ribeiro@sc.senai.br',
        password: 'Senha@100824'
    })
});

if (!authResponse.ok) {
    console.error(`❌ Autenticação falhou: ${authResponse.status}`);
    console.error(await authResponse.text());
    process.exit(1);
}

const authData = await authResponse.json();
const token = authData.access_token;

console.log(`✅ Autenticado! Token: ${token.substring(0, 20)}...`);
console.log(`   User: ${authData.user?.email || 'N/A'}`);
console.log(`   CNPJ: ${authData.user?.cnpj || 'N/A'}\n`);

// Step 2: Get Company Profile
console.log('Step 2: Buscando perfil da empresa...');

const profileResponse = await fetch(`${API_BASE}/companies/profile`, {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});

if (!profileResponse.ok) {
    console.error(`❌ Busca de perfil falhou: ${profileResponse.status}`);
    console.error(await profileResponse.text());
    process.exit(1);
}

const profile = await profileResponse.json();

console.log(`✅ Perfil da empresa obtido!`);
console.log(`   Nome: ${profile.name || profile.razaoSocial || 'N/A'}`);
console.log(`   CNPJ: ${profile.cnpj || 'N/A'}`);
console.log(`   Município: ${profile.city || profile.municipio || 'N/A'}`);
console.log(`   UF: ${profile.state || profile.uf || 'N/A'}\n`);

// Step 3: List Filiais (Enterprises)
console.log('Step 3: Listando filiais/empresas relacionadas...');

const enterprisesResponse = await fetch(`${API_BASE}/enterprise/list?state=SP&page=1&limit=10`, {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});

if (!enterprisesResponse.ok) {
    console.error(`❌ Listagem de empresas falhou: ${enterprisesResponse.status}`);
    console.error(await enterprisesResponse.text());
    process.exit(1);
}

const enterprises = await enterprisesResponse.json();

console.log(`✅ Empresas encontradas: ${enterprises.data?.length || enterprises.length || 0}`);

const data = enterprises.data || enterprises;
if (Array.isArray(data) && data.length > 0) {
    console.log('\nPrimeiras 5 empresas:');
    data.slice(0, 5).forEach((ent, idx) => {
        console.log(`\n  ${idx + 1}. ${ent.razaoSocial || ent.name || 'N/A'}`);
        console.log(`     CNPJ: ${ent.cnpj || 'N/A'}`);
        console.log(`     Município: ${ent.municipio || ent.city || 'N/A'} - ${ent.uf || ent.state || 'N/A'}`);
        console.log(`     Setor: ${ent.setorPrimario || ent.sector || 'N/A'}`);
    });
}

console.log('\n\n=== RESULTADO ===');
console.log('✅ Autenticação: OK');
console.log('✅ Perfil da Empresa: OK');
console.log(`✅ Filiais Listadas: ${data?.length || 0} empresas`);
console.log('\n🎯 Dados prontos para montar o canvas!');
console.log('\nPróximo passo: Integrar no Orchestrator para gerar widgets automaticamente.');
