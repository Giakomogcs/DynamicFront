import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Try to import from server location if root fails, but for now standard import
const prisma = new PrismaClient();

const profilesPath = path.join(__dirname, '../server/data/auth_profiles.json');

async function seed() {
    console.log("Starting DB Seed from auth_profiles.json...");

    if (!fs.existsSync(profilesPath)) {
        console.error("Auth profiles file not found!", profilesPath);
        return;
    }

    const data = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));

    for (const [resourceKey, profiles] of Object.entries(data)) {
        console.log(`Processing Resource Key: ${resourceKey}`);

        let resource;
        // Handle "default" key
        if (resourceKey === 'default') {
            resource = await prisma.resource.upsert({
                where: { name: 'default_registry' },
                update: {},
                create: {
                    name: 'default_registry',
                    type: 'REGISTRY',
                    config: { description: 'Default fallback profiles' }
                }
            });
        } else {
            // Assume key is UUID or ID
            // If key is UUID format, we can try to set it as ID, assuming it doesn't exist
            // But upsert by ID requires unique input.
            // Resource name is unique. Use key as name.

            // Check if key is valid UUID to use as ID
            const isUuid = resourceKey.length === 36 && resourceKey.includes('-');

            resource = await prisma.resource.upsert({
                where: { name: resourceKey },
                update: {},
                create: {
                    id: isUuid ? resourceKey : undefined,
                    name: resourceKey,
                    type: 'API',
                    config: {}
                }
            });
        }

        console.log(`  -> Resource ID: ${resource.id}`);

        for (const p of profiles) {
            const profileData = {
                resourceId: resource.id,
                label: p.label,
                role: p.role,
                credentials: p.credentials || {}
            };

            // Use p.id if valid for Upsert, else Create
            if (p.id) {
                // Upsert requires where unique. AuthProfile id is PK.
                await prisma.authProfile.upsert({
                    where: { id: p.id },
                    update: profileData,
                    create: { ...profileData, id: p.id }
                });
                console.log(`    -> Synced Profile: ${p.label} (${p.id})`);
            } else {
                await prisma.authProfile.create({
                    data: profileData
                });
                console.log(`    -> Created Profile: ${p.label}`);
            }
        }
    }

    console.log("Seeding Complete.");
}

seed()
    .catch(e => {
        console.error("Seeding Failed:", e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
