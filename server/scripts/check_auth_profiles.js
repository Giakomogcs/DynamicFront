/**
 * Script para verificar auth profiles no banco
 */

import prisma from '../registry.js';

async function checkAuthProfiles() {
    console.log('\n=== Auth Profiles no Banco ===\n');

    const resources = await prisma.resource.findMany({
        include: { authProfiles: true }
    });

    for (const resource of resources) {
        console.log(`📦 Resource: ${resource.name}`);

        if (resource.authProfiles && resource.authProfiles.length > 0) {
            for (const profile of resource.authProfiles) {
                console.log(`  ✓ Profile: ${profile.label}`);
                console.log(`    Role: ${profile.role}`);
                console.log(`    Credentials:`, profile.credentials);
                console.log('');
            }
        } else {
            console.log('  ⚠️ Nenhum profile cadastrado\n');
        }
    }

    await prisma.$disconnect();
}

checkAuthProfiles().catch(console.error);
