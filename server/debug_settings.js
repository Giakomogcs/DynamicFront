
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("=== DEBUG SYSTEM SETTINGS ===");
    const settings = await prisma.systemSetting.findMany();

    console.log(`Found ${settings.length} settings.`);

    settings.forEach(s => {
        let val = s.value;
        try { val = JSON.parse(s.value); } catch { }
        console.log(`[${s.key}] (Raw: "${s.value}") -> Parsed: ${typeof val} ${val}`);

        if (s.key.startsWith('PROVIDER_ENABLED')) {
            const isFalse = s.value === 'false' || s.value === 'false' || val === false;
            console.log(`   -> Interpreted as Disabled? ${isFalse}`);
        }
    });

    console.log("=============================");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
