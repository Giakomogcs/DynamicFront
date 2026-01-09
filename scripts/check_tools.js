
import { toolService } from '../server/services/toolService.js';
import prisma from '../server/registry.js';

async function check() {
    console.log("=== Checking Tool Connectivity ===");

    // Force wait for DB
    try {
        const apis = await prisma.verifiedApi.count();
        const dbs = await prisma.verifiedDb.count();
        console.log(`[Registry] Found ${apis} APIs and ${dbs} DBs.`);
    } catch (e) {
        console.error("DB Connection Failed:", e);
        process.exit(1);
    }

    const tools = await toolService.getAllTools();
    console.log(`[ToolService] Loaded ${tools.length} total tools.`);

    const apiTools = tools.filter(t => !['register_api', 'register_database', 'read_url_content'].includes(t.name) && !t.name.includes('inspect'));
    const dbTools = tools.filter(t => t.name.includes('inspect') || t.name.includes('query'));

    console.log(`- Core Tools: ${tools.length - apiTools.length - dbTools.length}`);
    console.log(`- API Tools: ${apiTools.length}`);
    console.log(`- DB Tools: ${dbTools.length}`);

    if (apiTools.length > 0) {
        console.log("Sample API Tool:", apiTools[0].name);
    }

    // Simulate lookup
    const testTool = apiTools.length > 0 ? apiTools[0].name : 'google_search';
    const execInfo = toolService.executionMap.get(testTool);

    if (execInfo) {
        console.log(`SUCCESS: Tool '${testTool}' is mapped to type '${execInfo.type}'.`);
    } else {
        console.error(`FAIL: Tool '${testTool}' is missing from execution map.`);
    }

    console.log("=== Check Complete ===");
    process.exit(0);
}

check();
