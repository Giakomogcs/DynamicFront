import prisma from './registry.js';

async function debugAuthProfiles() {
    console.log('=== DEBUG: Auth Profiles ===\n');

    const resources = await prisma.resource.findMany({
        include: { authProfiles: true }
    });

    console.log(`Found ${resources.length} resources:\n`);

    for (const resource of resources) {
        console.log(`📦 Resource: ${resource.name} (ID: ${resource.id})`);
        console.log(`   Type: ${resource.type}, Enabled: ${resource.isEnabled}`);
        console.log(`   Profiles: ${resource.authProfiles.length}\n`);

        for (const profile of resource.authProfiles) {
            console.log(`   👤 ${profile.label} (${profile.role})`);
            console.log(`      ID: ${profile.id}`);
            console.log(`      Credentials:`, profile.credentials);
            console.log('');
        }
        console.log('---\n');
    }
}

debugAuthProfiles().catch(console.error);
