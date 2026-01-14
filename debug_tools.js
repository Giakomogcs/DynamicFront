
import { toolService } from './server/services/toolService.js';

async function run() {
    console.log("Fetching tools...");
    const tools = await toolService.getAllTools();

    const getSchools = tools.find(t => t.name.includes('getshools')); // Typo in original name matches
    const authSession = tools.find(t => t.name.includes('authcontroller_session'));

    console.log("--- GET SCHOOLS ---");
    console.log(JSON.stringify(getSchools, null, 2));

    console.log("\n--- AUTH SESSION ---");
    console.log(JSON.stringify(authSession, null, 2));

    process.exit(0);
}

run().catch(console.error);
