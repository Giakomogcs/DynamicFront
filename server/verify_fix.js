// using global fetch


const BASE_URL = 'http://localhost:3000';

async function testModelConfig() {
    console.log("1. Testing Model Configuration...");
    try {
        const res = await fetch(`${BASE_URL}/api/models`);
        const data = await res.json();
        console.log("   Default Model:", data.defaultModel);
        if (data.defaultModel.includes('gemini-3')) {
            console.error("FAIL: Server still using gemini-3!");
        } else {
            console.log("   PASS: Server using valid model.");
        }
    } catch (e) {
        console.error("   FAIL: Could not fetch models", e.message);
    }
}

async function testUserQuery() {
    console.log("\n2. Testing User Query...");
    const prompt = "Quais são os cursos que mais se repetem no estado de São paulo?";

    try {
        console.log(`   Detailed Request: "${prompt}"`);
        const res = await fetch(`${BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: prompt,
                history: [],
                model: 'gemini-2.0-flash'
            })
        });

        const data = await res.json();
        console.log("   --- RESPONSE ---");
        if (res.ok) {
            console.log("   Text:", data.text);
            console.log("   Widgets:", data.widgets ? data.widgets.length : 0);
        } else {
            console.error("   FAIL:", data.error);
        }
    } catch (e) {
        console.error("   FATAL ERROR:", e.message);
    }
}

(async () => {
    await testModelConfig();
    await testUserQuery();
})();

