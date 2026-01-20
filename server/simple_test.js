import { toolService } from './services/toolService.js';
import { mcpClientService } from './services/mcpClientService.js';
import { resourceEnricher } from './src/core/ResourceEnricher.js';
import fs from 'fs';

async function main() {
    try {
        await mcpClientService.initialize();
        const profiles = await resourceEnricher.loadProfiles();
        const admin = profiles.find(p => p.role === 'Admin');

        const toolName = 'dn_dashboardcontroller_getcontractscapacity';
        const params = {
            email: admin.credentials.email,
            password: admin.credentials.password,
            year: 2024,
            start_month: "062024",
            end_month: "062024",
            state: "SP"
        };

        console.log(`Executing ${toolName}...`);

        try {
            const result = await toolService.executeTool(toolName, params);
            fs.writeFileSync('final_output.json', JSON.stringify(result, null, 2));
            console.log("Success. Wrote to final_output.json");
        } catch (toolError) {
            const errObj = {
                message: toolError.message,
                stack: toolError.stack,
                details: toolError
            };
            fs.writeFileSync('final_output.json', JSON.stringify(errObj, null, 2));
            console.log("Tool Error. Wrote to final_output.json");
        }
    } catch (e) {
        fs.writeFileSync('final_output.json', JSON.stringify({ fatal: e.message, stack: e.stack }, null, 2));
    }
    process.exit(0);
}

main();
