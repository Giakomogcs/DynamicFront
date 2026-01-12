#!/usr/bin/env node
import prisma from './registry.js';

/**
 * Helper script to inspect MCP servers using MCP Inspector
 * Usage: node inspect_mcp_server.js <type> [id]
 */

const [type, id] = process.argv.slice(2);

if (!type) {
    console.log("Usage: node inspect_mcp_server.js <type> [id]");
    console.log("\nExamples:");
    console.log("  node inspect_mcp_server.js filesystem");
    console.log("  node inspect_mcp_server.js api <apiId>");
    console.log("  node inspect_mcp_server.js db <dbId>");
    process.exit(1);
}

async function main() {
    if (type === 'filesystem') {
        console.log("🔍 Inspecting Filesystem Server...\n");
        console.log("Run this command:");
        console.log("npx @modelcontextprotocol/inspector npx -y @modelcontextprotocol/server-filesystem ./\n");
        return;
    }

    if (type === 'api') {
        if (!id) {
            console.log("📋 Available APIs:");
            const apis = await prisma.verifiedApi.findMany();
            apis.forEach(api => {
                console.log(`  - ${api.name} (${api.idString})`);
            });
            console.log("\nUsage: node inspect_mcp_server.js api <apiId>");
            return;
        }

        const api = await prisma.verifiedApi.findUnique({ where: { idString: id } });
        if (!api) {
            console.error("❌ API not found");
            return;
        }

        const configJson = JSON.stringify(api);
        const configBase64 = Buffer.from(configJson).toString('base64');

        console.log(`🔍 Inspecting API: ${api.name}\n`);
        console.log("Run this command:");
        console.log(`npx @modelcontextprotocol/inspector node ./mcp-servers/openapi-wrapper.js ${configBase64}\n`);
        return;
    }

    if (type === 'db') {
        if (!id) {
            console.log("📋 Available DBs:");
            const dbs = await prisma.verifiedDb.findMany();
            dbs.forEach(db => {
                console.log(`  - ${db.name} (${db.idString})`);
            });
            console.log("\nUsage: node inspect_mcp_server.js db <dbId>");
            return;
        }

        const db = await prisma.verifiedDb.findUnique({ where: { idString: id } });
        if (!db) {
            console.error("❌ DB not found");
            return;
        }

        console.log(`🔍 Inspecting Database: ${db.name}\n`);
        console.log("Run this command:");
        console.log(`npx @modelcontextprotocol/inspector npx -y @modelcontextprotocol/server-postgres "${db.connectionString}"\n`);
        return;
    }

    console.error("❌ Invalid type. Use: filesystem, api, or db");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
