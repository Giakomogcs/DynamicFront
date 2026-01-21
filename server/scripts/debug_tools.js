import { toolService } from '../services/toolService.js';

async function listTools() {
    console.log("🛠️ Listing Available Tools...");
    try {
        const tools = await toolService.getAllTools();
        console.log(`✅ Found ${tools.length} tools.`);
        tools.forEach(t => console.log(`   - ${t.name}`));
        
        if (tools.length === 0) {
            console.warn("⚠️ No tools found! Check MCP server connection.");
        }
    } catch (e) {
        console.error("❌ Failed to list tools:", e);
    }
}

listTools();
