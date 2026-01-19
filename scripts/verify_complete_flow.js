

import { orchestrator } from '../server/agents/Orchestrator.js';
import { resourceEnricher } from '../server/src/core/ResourceEnricher.js';

async function runTest() {
    console.log("=== Verifying Intelligent Auth Strategy ===\n");

    // 1. Ensure resources are loaded (simulated or real)
    await resourceEnricher.loadProfiles();
    console.log("Profiles loaded:", resourceEnricher.getAllProfiles().map(p => p.label));

    const userMessage = "quais filiais tem minha empresa, organize por regiões e me dê os cnaes delas, cnpj delas e etc";

    // 2. Call Orchestrator
    try {
        const result = await orchestrator.processRequest(
            userMessage,
            [], // history
            "gemini-2.0-flash", // model
            { lat: -23.55, lon: -46.63 } // location (SP)
        );

        console.log("\n=== Final Result ===");
        console.log("Text Response:", result.text?.substring(0, 200) + "...");
        console.log("Widgets Generated:", result.widgets?.length);

        // Validation Logic could go here (check logs manually for now)

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

runTest();
