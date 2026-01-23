
import prisma from '../registry.js';

async function main() {
    console.log("Checking System Settings...");
    const settings = await prisma.systemSetting.findMany();
    console.log("Settings found:", settings.length);
    settings.forEach(s => {
        console.log(`[${s.key}]: ${s.value} (Type: ${typeof s.value})`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
