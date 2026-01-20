import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
    console.log("Testing Canvas DB Access...");
    if (!prisma.canvas) {
        console.error("prisma.canvas is undefined! Generate failed.");
        process.exit(1);
    }
    try {
        const c = await prisma.canvas.create({
            data: {
                conversationId: 'test',
                title: 'Test Canvas',
                theme: {},
                layoutType: 'dashboard'
            }
        });
        console.log("Canvas created:", c.id);
        await prisma.canvas.delete({ where: { id: c.id } });
        console.log("Canvas deleted.");
    } catch (e) {
        console.error("Canvas DB Error:", e);
        process.exit(1);
    }
}
test().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(() => prisma.$disconnect());
