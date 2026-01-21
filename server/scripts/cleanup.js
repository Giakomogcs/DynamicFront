import prisma from '../registry.js';

async function cleanData() {
    console.log("🧹 Cleaning up Verification and Debug sessions...");
    try {
        const { count } = await prisma.session.deleteMany({
            where: {
                title: { in: ['Verification Session', 'Debug Session', 'New Project', 'Validation Session'] }
            }
        });
        console.log(`✅ Deleted ${count} test sessions.`);
    } catch (e) {
        console.error("❌ Cleanup failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanData();
