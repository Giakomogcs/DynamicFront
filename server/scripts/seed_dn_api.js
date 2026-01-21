
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function seed() {
    console.log("Seeding DataNavigator API...");
    
    // Absolute path to full_spec.json
    const specPath = path.resolve(__dirname, '../full_spec.json');
    console.log(`Spec file: ${specPath}`);

    const existing = await prisma.verifiedApi.findFirst({ where: { name: 'DataNavigator' } });

    if (existing) {
        console.log("Updating existing DataNavigator API...");
        await prisma.verifiedApi.update({
            where: { id: existing.id },
            data: {
                isEnabled: true,
                specUrl: specPath,
                baseUrl: 'http://localhost:3000',
                authConfig: JSON.stringify({ type: 'bearer', token: '' }) // Empty token to prompt login?
            }
        });
    } else {
        console.log("Creating new DataNavigator API...");
        await prisma.verifiedApi.create({
            data: {
                idString: 'dn-api',
                name: 'DataNavigator',
                baseUrl: 'http://localhost:3000',
                specUrl: specPath,
                authConfig: JSON.stringify({ type: 'bearer', token: '' }),
                isEnabled: true
            }
        });
    }
    console.log("Done.");
}

seed().catch(console.error).finally(() => prisma.$disconnect());
