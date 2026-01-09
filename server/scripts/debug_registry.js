
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Fetching registered databases...");
    try {
        const dbs = await prisma.verifiedDb.findMany();
        console.log(`Found ${dbs.length} databases.`);
        dbs.forEach(db => {
            console.log(`- Name: ${db.name}`);
            console.log(`  ID: ${db.idString}`);
            console.log(`  Connection: ${JSON.stringify(db.connectionString)}`);
        });
    } catch (e) {
        console.error("Error fetching databases:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
