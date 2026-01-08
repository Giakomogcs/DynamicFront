import { toolService } from './services/toolService.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        console.log("Fetching tools...");
        const availableTools = await toolService.getAllTools();
        console.log(`Found ${availableTools.length} available tools.`);

        // Simulate Planner Logic
        let toolSummaries = "";
        if (availableTools.length > 300) {
            toolSummaries = "GROUPED MODE (Should not happen for < 300 tools)";
        } else {
             toolSummaries = availableTools.map(t => `- ${t.name}: ${(t.description || '').substring(0, 150).replace(/\s+/g, ' ')}`).join('\n');
        }

        console.log("\n--- SIMULATED PLANNER PROMPT (First 10 lines) ---");
        const lines = toolSummaries.split('\n');
        lines.slice(0, 10).forEach(l => console.log(l));
        console.log("...");
        console.log(`Total Length: ${toolSummaries.length} chars`);
        
        const dnTools = lines.filter(l => l.includes('dn_'));
        console.log(`\nVisible DN Tools: ${dnTools.length}`);
        if(dnTools.length > 0) {
             console.log("Sample DN Tool:");
             console.log(dnTools[0]);
        }

    } catch (e) {
        console.error("Error in debug script:", e);
    }
}
run();
