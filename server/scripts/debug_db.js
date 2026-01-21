import { storageService } from '../services/storageService.js';
import prisma from '../registry.js';

async function debugStorageService() {
    console.log("🐛 Starting Storage Service Debug for CREATE_PAGE...");
    
    // 1. Create a Session first
    const convId = `debug_${Date.now()}`;
    const session = await prisma.session.create({
        data: { title: "Debug Session", conversationId: convId }
    });
    console.log(`   ✅ Session Created: ${session.id}`);

    // 2. Test saveCanvas like Orchestrator does
    const newId = crypto.randomUUID();
    const title = "Debug Page";
    const sessionId = session.id;

    console.log(`   Testing storageService.saveCanvas(${newId}, "${title}", [], [], "${sessionId}")`);

    try {
        const result = await storageService.saveCanvas(
            newId,
            title,
            [], // widgets
            [], // messages
            sessionId
        );

        if (result) {
            console.log("   ✅ Success! Canvas returned:");
            console.log(`      ID: ${result.id}, Title: ${result.title}, Slug: ${result.slug}`);
        } else {
            console.log("   ❌ Result is NULL or UNDEFINED");
        }
    } catch (e) {
        console.error("   ❌ Exception caught:");
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

debugStorageService();
