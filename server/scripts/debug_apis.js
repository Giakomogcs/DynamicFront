
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const apis = await prisma.verifiedApi.findMany();
        console.log("Registered APIs:", JSON.stringify(apis, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
