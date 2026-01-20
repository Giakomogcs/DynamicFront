import { toolService } from './services/toolService.js';
import { mcpClientService } from './services/mcpClientService.js';

async function main() {
    await mcpClientService.initialize();

    // We knew the resource ID from logs: 55552e89-e63d-4362-b061-1077b8289eef
    const resourceId = '55552e89-e63d-4362-b061-1077b8289eef';

    const tools = await toolService.getAllTools(false);

    // Filter for contracts and include unit or dashboard
    const dashboardTools = tools.filter(t => t.name.includes('contract'));

    console.log(`\n=== Found ${dashboardTools.length} Tools ===\n`);

    dashboardTools.forEach(t => {
        console.log(`TOOL: ${t.name}`);
        const props = t.inputSchema?.properties || {};
        console.log(`PARAMS: ${Object.keys(props).join(', ')}`);
        console.log('---');
    });

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
