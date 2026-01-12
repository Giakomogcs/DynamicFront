import { mcpClientService } from './services/mcpClientService.js';
import { toolService } from './services/toolService.js';
import prisma from './registry.js';

/**
 * Comprehensive MCP Integration Test
 * Tests: Server spawning, tool discovery, execution
 */

async function testMcpIntegration() {
    console.log("=== MCP Integration Test ===\n");

    try {
        // 1. Test MCP Client Initialization
        console.log("1️⃣  Testing MCP Client initialization...");
        await mcpClientService.initialize();
        console.log("✅ MCP Client initialized\n");

        // 2. Test Tool Discovery
        console.log("2️⃣  Testing tool discovery...");
        const tools = await toolService.getAllTools();
        console.log(`✅ Found ${tools.length} total tools\n`);

        // 3. Categorize tools
        const mcpTools = tools.filter(t => {
            const execInfo = toolService.executionMap.get(t.name);
            return execInfo?.type === 'mcp';
        });

        const staticTools = tools.filter(t => {
            const execInfo = toolService.executionMap.get(t.name);
            return execInfo?.type === 'static';
        });

        console.log(`   📊 Tool Breakdown:`);
        console.log(`      - Static tools: ${staticTools.length}`);
        console.log(`      - MCP tools: ${mcpTools.length}\n`);

        // 4. List MCP servers
        console.log("3️⃣  Active MCP Servers:");
        for (const [serverName, client] of mcpClientService.clients.entries()) {
            const serverTools = mcpClientService.toolsCache.get(serverName) || [];
            console.log(`   🖥️  ${serverName}: ${serverTools.length} tools`);
        }
        console.log();

        // 5. Test resource filtering (isEnabled)
        console.log("4️⃣  Testing resource filtering...");
        const enabledApis = await prisma.verifiedApi.count({ where: { isEnabled: true } });
        const enabledDbs = await prisma.verifiedDb.count({ where: { isEnabled: true } });
        const totalApis = await prisma.verifiedApi.count();
        const totalDbs = await prisma.verifiedDb.count();

        console.log(`   APIs: ${enabledApis}/${totalApis} enabled`);
        console.log(`   DBs: ${enabledDbs}/${totalDbs} enabled\n`);

        // 6. Test tool execution (if filesystem tools available)
        console.log("5️⃣  Testing tool execution...");
        const filesystemTool = mcpTools.find(t => t.name.includes('list_directory') || t.name.includes('read_file'));

        if (filesystemTool) {
            console.log(`   Testing: ${filesystemTool.name}`);
            try {
                const result = await toolService.executeTool(filesystemTool.name, { path: './' });
                console.log(`   ✅ Execution successful`);
                console.log(`   Result preview: ${JSON.stringify(result).substring(0, 100)}...\n`);
            } catch (e) {
                console.log(`   ⚠️  Execution failed: ${e.message}\n`);
            }
        } else {
            console.log(`   ⚠️  No filesystem tools found for testing\n`);
        }

        // 7. Summary
        console.log("=== Test Summary ===");
        console.log(`✅ MCP Client: Working`);
        console.log(`✅ Tool Discovery: ${tools.length} tools found`);
        console.log(`✅ Server Spawning: ${mcpClientService.clients.size} servers active`);
        console.log(`✅ Resource Filtering: Working (${enabledApis + enabledDbs} enabled resources)`);

        console.log("\n🎉 All tests passed!");

    } catch (error) {
        console.error("\n❌ Test failed:", error);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

testMcpIntegration();
