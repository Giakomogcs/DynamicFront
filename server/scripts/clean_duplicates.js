
import prisma from '../registry.js';

async function cleanDupes() {
    console.log("Checking for duplicates...");
    const profiles = await prisma.authProfile.findMany({
        include: { resource: true }
    });

    // Group by label + resource
    const groups = {};
    for (const p of profiles) {
        const key = `${p.resourceId}_${p.label}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
    }

    for (const [key, list] of Object.entries(groups)) {
        if (list.length > 1) {
            console.log(`Found duplicate for ${key} (${list.length} records):`);

            // Sort: prioritize records with more credentials or specific IDs
            // We want to keep the one that likely has the most data (merged from JSON)
            list.sort((a, b) => {
                const aKeys = a.credentials ? Object.keys(a.credentials).length : 0;
                const bKeys = b.credentials ? Object.keys(b.credentials).length : 0;
                return bKeys - aKeys; // Descending (more keys first)
            });

            const winner = list[0];
            const losers = list.slice(1);

            console.log(`   Keeping: ${winner.id} (Creds: ${winner.credentials ? Object.keys(winner.credentials).length : 0})`);
            for (const loser of losers) {
                console.log(`   Deleting: ${loser.id} (Creds: ${loser.credentials ? Object.keys(loser.credentials).length : 0})`);
                await prisma.authProfile.delete({ where: { id: loser.id } });
            }
        }
    }
    console.log("Done.");
}

cleanDupes()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
