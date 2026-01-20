import { toolService } from './services/toolService.js';
import { mcpClientService } from './services/mcpClientService.js';

async function main() {
    console.log("Initializing...");

    // Initialize MCP Client Service
    await mcpClientService.initialize();

    // We knew the resource ID from logs: 55552e89-e63d-4362-b061-1077b8289eef
    const resourceId = '55552e89-e63d-4362-b061-1077b8289eef';

    console.log(`Fetching tools for resource ${resourceId}...`);
    // Force refresh to ensure we get latest
    const tools = await toolService.getAllTools(false);

    const dashboardTools = tools.filter(t => t.name.includes('dashboard') || (t.name.includes('contract') && t.name.includes('dn_')));

    console.log(`Found ${dashboardTools.length} dashboard/contract tools.`);

    dashboardTools.forEach(t => {
        console.log(`\n--- Tool: ${t.name} ---`);
        console.log("Description:", t.description);
        if (t.inputSchema) {
            console.log("Parameters:", Object.keys(t.inputSchema.properties || {}));
            // Check if it has state/UF param
            console.log(JSON.stringify(t.inputSchema, null, 2));
        }
    });

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
