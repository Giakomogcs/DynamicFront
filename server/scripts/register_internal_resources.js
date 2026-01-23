// Script to register internal resources or system defaults
// Currently empty to respect agent autonomy.

import prisma from '../registry.js';

async function main() {
    console.log("No hardcoded resources to register.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
