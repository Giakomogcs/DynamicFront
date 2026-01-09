
import { toolService } from './server/services/toolService.js';

async function test() {
    console.log("Testing DB Tool Execution...");
    try {
        // Init cache
        await toolService.getAllTools();

        // Execute inspect schema with valid DB ID
        const result = await toolService.executeTool('dn_inspect_schema', { search: 'unidades' });

        console.log("RESULT:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("CRASH:", e);
    }
}

test();
