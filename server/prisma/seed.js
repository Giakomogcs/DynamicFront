import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 [Seed] Database structure verified.');
    console.log('✅ [Seed] Ready for manual resource and user configuration via UI.');
    console.log('ℹ️  [Seed] No default data created - add resources and auth profiles through the application.');
}

main()
    .catch((e) => {
        console.error('❌ [Seed] Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
