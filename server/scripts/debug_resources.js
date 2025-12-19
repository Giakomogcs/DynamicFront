
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("--- APIs ---");
    const apis = await prisma.verifiedApi.findMany();
    for (const api of apis) {
        console.log(`Name: ${api.name}`);
        console.log(`BaseURL: ${api.baseUrl}`);
        // console.log(`Auth: ${api.authConfig}`);
        console.log(`full: ${JSON.stringify(api, null, 2)}`);
        console.log("----------------");
    }

    console.log("\n--- DBs ---");
    const dbs = await prisma.verifiedDb.findMany();
    if (dbs.length === 0) console.log("No DBs found.");
    for (const db of dbs) {
        console.log(`Name: ${db.name}`);
        console.log(`Type: ${db.type}`);
        console.log(`Connection: ${db.connectionString}`);
        console.log("----------------");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
