
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { PrismaClient } from '@prisma/client';
import { getApiTools } from '../handlers/api.js';

const prisma = new PrismaClient();

async function main() {
    try {
        const api = await prisma.verifiedApi.findFirst({
            where: { name: 'DN' }
        });

        if (!api) {
            console.log("API 'DN' not found.");
            return;
        }

        console.log(`Analyzing API: ${api.name}`);
        console.log(`Spec URL: ${api.specUrl}`);

        // Force dynamic generation since we know toolConfig is null
        const tools = await getApiTools(api);
        console.log(`\nGenerated Tools Count: ${tools.length}`);

        if (tools.length > 0) {
            console.log("First 5 tools:");
            tools.slice(0, 5).forEach(t => console.log(`- ${t.name}: ${t.description.substring(0, 50)}...`));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
