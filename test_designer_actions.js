
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { designerAgent } from './server/agents/Designer.js';

// Mock data
const summaryText = "Found 5 Senai Units in Sao Paulo.";
const data = [
    { name: "Unit A", id: 1 },
    { name: "Unit B", id: 2 }
];
const steps = [
    { name: "Search", status: "completed" }
];

console.log("Testing Designer Agent...");

try {
    const result = await designerAgent.design(summaryText, data, "gemini-2.0-flash-exp", steps);
    console.log("Designer Output:", JSON.stringify(result, null, 2));

    const widgets = result.widgets;
    const hasActions = widgets.some(w => w.actions && w.actions.length > 0);
    
    if (hasActions) {
        console.log("✅ SUCCESS: Widgets contain actions!");
    } else {
        console.log("⚠️ WARNING: No actions found in widgets. Verify prompt instructions.");
    }

} catch (e) {
    console.error("Test Failed:", e);
}
