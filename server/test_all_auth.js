import prisma from './registry.js';
import { toolService } from './services/toolService.js';

async function testAllAuthProfiles() {
    console.log('\n=== TESTING ALL AUTH PROFILES ===\n');

    try {
        // 1. Carregar todos os resources com profiles
        const resources = await prisma.resource.findMany({
            include: { authProfiles: true }
        });

        console.log(`Found ${resources.length} resources\n`);

        for (const resource of resources) {
            console.log(`\n📦 Resource: ${resource.name}`);
            console.log(`   Profiles: ${resource.authProfiles.length}\n`);

            if (resource.authProfiles.length === 0) {
                console.log('   ⚠️ No profiles to test\n');
                continue;
            }

            // 2. Buscar auth tool para este resource
            const allTools = await toolService.getAllTools();
            const authTool = allTools.find(t =>
                t.name.includes(resource.name) &&
                (t.name.includes('auth') || t.name.includes('login') || t.name.includes('session'))
            );

            if (!authTool) {
                console.log(`   ❌ No auth tool found for resource '${resource.name}'\n`);
                continue;
            }

            console.log(`   🔧 Using tool: ${authTool.name}\n`);

            // 3. Testar cada profile
            for (const profile of resource.authProfiles) {
                console.log(`   👤 Testing: ${profile.label} (${profile.role})`);
                console.log(`      Credentials:`, profile.credentials);

                try {
                    const result = await toolService.executeTool(authTool.name, profile.credentials);

                    if (result.isError) {
                        console.log(`      ❌ FAILED`);
                        console.log(`      Error:`, result.content[0]?.text || 'Unknown error');
                    } else {
                        console.log(`      ✅ SUCCESS`);
                        const output = result.content[0]?.text || '';

                        // Try to parse JSON
                        try {
                            const json = JSON.parse(output);
                            console.log(`      Role:`, json.role || json.type || 'Unknown');
                            console.log(`      Name:`, json.name || json.nome || json.user?.name || 'Unknown');
                        } catch (e) {
                            // Text output
                            console.log(`      Output:`, output.substring(0, 100));
                        }
                    }
                } catch (error) {
                    console.log(`      ❌ EXCEPTION`);
                    console.log(`      Error:`, error.message);
                }

                console.log('');
            }

            console.log('   ' + '─'.repeat(60) + '\n');
        }

        console.log('\n=== TEST COMPLETE ===\n');
    } catch (error) {
        console.error('\n❌ Fatal Error:', error);
        process.exit(1);
    }
}

testAllAuthProfiles();
