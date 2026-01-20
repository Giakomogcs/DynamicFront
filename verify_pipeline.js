import { orchestrator } from './server/agents/Orchestrator.js';

// Mock Tool Service (or rely on real one if DB is connected)
// Ideally we run this with real DB context if possible, or mock it.
// For now, let's assume we run this in an environment where DB is accessible.

async function verifyPipeline() {
    console.log("=== STARTING PIPELINE VERIFICATION ===");

    // Simulate User Request
    const userMessage = "Quais cursos de Mecânica tem no SENAI Campinas?";
    const history = [];

    try {
        const result = await orchestrator.processRequest(userMessage, history, "gemini-1.5-flash");

        console.log("\n=== PIPELINE RESULT ===");
        console.log("Text:", result.text);
        console.log("Widgets:", JSON.stringify(result.widgets, null, 2));

        if (result.widgets.find(w => w.type === 'process')) {
            console.log("\n✅ SUCCESS: Process widget found (Pipeline functioning)");
        } else {
            console.log("\n❌ FAIL: No Process widget found");
        }

    } catch (e) {
        console.error("\n❌ FATAL ERROR:", e);
    }
}

verifyPipeline();
