
// Native fetch in Node 18+

async function runCallback() {
    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "quais cursos tem em diadema?",
                history: [],
                model: "gemini-2.0-flash"
            })
        });

        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Test Error:", e);
    }
}

runCallback();
