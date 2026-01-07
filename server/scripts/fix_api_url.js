
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const apiName = 'DN';
    const newBaseUrl = 'https://api.aprendizagem-busca-curso.dev.senai.br';

    console.log(`Updating Base URL for ${apiName} to ${newBaseUrl}...`);

    try {
        const api = await prisma.verifiedApi.findFirst({ where: { name: apiName } });
        if (!api) {
            console.error("API not found!");
            return;
        }

        await prisma.verifiedApi.update({
            where: { idString: api.idString },
            data: { baseUrl: newBaseUrl }
        });

        console.log("Update successful!");
    } catch (e) {
        console.error("Error updating:", e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
