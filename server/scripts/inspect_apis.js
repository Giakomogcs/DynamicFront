
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const apis = await prisma.verifiedApi.findMany();
    console.log("Registered APIs:");
    apis.forEach(api => {
        console.log(`- Name: ${api.name}`);
        console.log(`  ID: ${api.idString}`);
        console.log(`  Base URL: ${api.baseUrl}`);
        console.log(`  Spec URL: ${api.specUrl}`);
        console.log(`  Auth Config: ${api.authConfig}`);
        console.log(`  -----------------------------------`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
