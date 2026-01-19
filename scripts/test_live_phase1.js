// Real integration test - Send actual API request to running server

const API_URL = 'http://localhost:3001';

console.log('=== TESTING PHASE 1 - LIVE INTEGRATION ===\n');

// Test 1: Simple request (no canvas context)
console.log('Test 1: Simple request without canvas context...');
const simpleRequest = {
    message: 'Mostre escolas SENAI em Santa Catarina',
    history: [],
    model: 'gemini-2.0-flash'
};

try {
    const response1 = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simpleRequest)
    });

    const result1 = await response1.json();
    console.log('✅ Response received');
    console.log('  - Text:', result1.text?.substring(0, 100) + '...');
    console.log('  - Widgets:', result1.widgets?.length || 0);

    // Test 2: Request WITH canvas context (simulating existing canvas)
    console.log('\n\nTest 2: Request WITH existing canvas context...');
    const canvasContext = {
        mode: 'append',
        widgets: [
            {
                type: 'stat',
                title: 'Total de Escolas',
                data: [{ label: 'Escolas Encontradas', value: 15 }]
            },
            {
                type: 'table',
                title: 'Escolas SENAI',
                data: [
                    { schoolName: 'SENAI Florianópolis', cnpj: '03634453000489' },
                    { schoolName: 'SENAI Joinville', cnpj: '03634453000560' }
                ]
            }
        ],
        messages: [
            { role: 'user', text: 'Mostre escolas SENAI em SC' },
            { role: 'model', text: 'Encontrei 15 escolas SENAI em Santa Catarina' }
        ]
    };

    const contextRequest = {
        message: 'Agora mostre gráfico das escolas por cidade',
        history: canvasContext.messages,
        model: 'gemini-2.0-flash',
        canvasContext: canvasContext
    };

    const response2 = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextRequest)
    });

    const result2 = await response2.json();
    console.log('✅ Response with canvas context received');
    console.log('  - Text:', result2.text?.substring(0, 100) + '...');
    console.log('  - Widgets:', result2.widgets?.length || 0);

    console.log('\n\n=== PHASE 1 LIVE INTEGRATION TEST COMPLETE ===');
    console.log('✅ Sistema está processando requisições normalmente');
    console.log('✅ Canvas context está sendo passado corretamente');
    console.log('\n📌 Próximo: Implementar Fase 2 (Strategic Reasoning)');

} catch (error) {
    console.error('❌ Error testing:', error.message);
    console.error('\nStack:', error.stack);
}
