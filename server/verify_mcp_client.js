import { mcpClientService } from './services/mcpClientService.js';

async function verify() {
    console.log("--- Starting MCP Client Verification ---");

    try {
        // 1. Initialize
        await mcpClientService.initialize();

        // 2. List Tools
        const tools = mcpClientService.getAllTools();
        console.log(`\nFound ${tools.length} MCP tools:`);
        tools.forEach(t => console.log(`- ${t.name} (${t._exec.serverName})`));

        if (tools.length === 0) {
            console.error("❌ No tools found. Verification failed.");
            return;
        }

        // 3. Find 'filesystem__read_file' or 'filesystem__list_directory'
        // Note: The actual names depend on the server implementation. 
        // @modelcontextprotocol/server-filesystem usually exposes 'read_file', 'list_directory' etc.
        // Our service prefixes them with 'filesystem__'.

        const listTool = tools.find(t => t.name.includes('list_directory') || t.name.includes('ls'));

        if (listTool) {
            console.log(`\nTesting execution of '${listTool.name}'...`);
            // Execute on current directory
            // The filesystem server setup in config used path.resolve("./") so valid paths must be within that.
            const result = await mcpClientService.executeTool(
                listTool._exec.serverName,
                listTool._exec.originalName,
                { path: './' }
            );

            console.log("Execution Result:", JSON.stringify(result, null, 2));
        } else {
            console.warn("⚠️ 'list_directory' tool not found. Skipping execution test.");
        }

    } catch (e) {
        console.error("❌ Verification Error:", e);
    }
}

verify();
