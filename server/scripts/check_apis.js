
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    console.log("Checking VerifiedAPIs...");
    const apis = await prisma.verifiedApi.findMany();
    console.log(`Found ${apis.length} APIs.`);
    apis.forEach(a => {
        console.log(`- ${a.name} (Enabled: ${a.isEnabled}, ID: ${a.idString})`);
        console.log(`  BaseURL: ${a.baseUrl}`);
        console.log(`  SpecURL: ${a.specUrl}`);
    });

    const dbs = await prisma.verifiedDb.findMany();
    console.log(`Found ${dbs.length} DBs.`);
    dbs.forEach(d => {
        console.log(`- ${d.name} (Enabled: ${d.isEnabled})`);
    });
}

check().catch(console.error).finally(() => prisma.$disconnect());
