
import prisma from '../registry.js';
import pg from 'pg';
const { Client } = pg;

async function run() {
    console.log("Fetching registered databases...");
    const dbs = await prisma.verifiedDb.findMany();

    if (dbs.length === 0) {
        console.log("No databases found in registry.");
        return;
    }

    for (const db of dbs) {
        console.log(`\n--- DB: ${db.name} ---`);
        // Mask password in logs
        const masked = db.connectionString.replace(/:([^:@]+)@/, ':****@');
        console.log(`Connection String: ${masked}`);

        const client = new Client({ connectionString: db.connectionString });
        try {
            await client.connect();
            console.log("Connection: SUCCESS");

            // Optional: Check schema access 
            const res = await client.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'");
            console.log(`Public tables count: ${res.rows[0].count}`);

            await client.end();
        } catch (e) {
            console.error(`Connection: FAILED - ${e.message}`);
            // Check if it's SSL related
            if (e.message.includes('self-signed') || e.message.includes('ssl')) {
                console.log("Hint: Try adding ?sslmode=no-verify or &ssl=true to connection string.");
            }
        }
    }
}

run()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
