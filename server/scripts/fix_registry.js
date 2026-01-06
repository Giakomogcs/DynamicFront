
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetId = 'e06b9ebd-eab5-4c6d-8162-d6a147310e88';
    const host = "10.105.158.14";
    const port = "5432";
    const cleanConnection = `postgresql://tda:tda@${host}:${port}/cni-dev`;

    console.log(`Updating DB ${targetId} with clean connection string...`);

    try {
        await prisma.verifiedDb.delete({
            where: { idString: targetId }
        });
        const created = await prisma.verifiedDb.create({
            data: {
                idString: targetId,
                name: "Aprendizagem DB",
                connectionString: cleanConnection,
                type: "postgres"
            }
        });
        console.log("Re-creation successful:", created);
    } catch (e) {
        console.error("Error updating database:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
