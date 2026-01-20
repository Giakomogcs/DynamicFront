import { toolService } from './services/toolService.js';
import { mcpClientService } from './services/mcpClientService.js';
import { resourceEnricher } from './src/core/ResourceEnricher.js';

async function main() {
    await mcpClientService.initialize();

    // Load profiles to get credentials
    const profiles = await resourceEnricher.loadProfiles();
    const admin = profiles.find(p => p.role === 'Admin');

    if (!admin) {
        console.error("No Admin profile found!");
        process.exit(1);
    }

    console.log(`Using Admin: ${admin.label}`);

    const toolName = 'dn_dashboardcontroller_getcontractscapacity';

    console.log(`Executing ${toolName} for State SP...`);

    try {
        const result = await toolService.executeTool(
            toolName,
            {
                email: admin.credentials.email,
                password: admin.credentials.password,
                year: 2024,
                start_month: "062024",
                end_month: "062024",
                state: "SP"
            }
        );

        console.log("----- RESULT START -----");
        // Handle MCP content result
        if (result.content && result.content[0] && result.content[0].text) {
            try {
                const parsed = JSON.parse(result.content[0].text);
                console.log(JSON.stringify(parsed, null, 2));
            } catch (e) {
                console.log(result.content[0].text);
            }
        } else {
            console.log(JSON.stringify(result, null, 2));
        }
        console.log("----- RESULT END -----");
    } catch (e) {
        console.log("----- EXECUTION ERROR -----");
        console.log(e.message);
        console.log(JSON.stringify(e, null, 2));
        console.log("----- ERROR END -----");
    }

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
