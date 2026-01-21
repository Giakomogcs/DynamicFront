// Import db client (assuming it's exported from storageService or a db module)
// Actually storageService assumes persistence file? 
// No, the user migrated to Prisma in Phase 1. 
// We should use prisma client here or storageService.
// Let's use prisma directly if valid imports, or check storageService implementation.
// Looking at storageService below... it uses prisma!

import { modelManager } from '../services/ai/ModelManager.js';
import prisma from '../registry.js';

export class RouterAgent {
    constructor() { }

    async analyzeRequest(userMessage, currentSlug = 'home', sessionId) {
        // 1. Get Project Context (Routes)
        let availablePages = [];
        if (sessionId) {
            try {
                const session = await prisma.session.findUnique({
                    where: { id: sessionId },
                    include: { canvases: { select: { slug: true, title: true } } }
                });
                if (session && session.canvases) {
                    availablePages = session.canvases.map(c => `${c.title} (slug: ${c.slug})`);
                }
            } catch (err) {
                console.warn("[Router] Failed to fetch session pages:", err.message);
            }
        }

const routerPrompt = `
You are the ROUTER Agent for a Multi-Page Web App Builder.
User Input: "${userMessage}"
Current Page: "${currentSlug}" (Active Canvas)
Session Context (Available Pages):
${availablePages.map(p => `- ${p}`).join('\n') || "No other pages yet."}

Your goal is to classify the INTENT.

INTENTS:
1. **NAVIGATE**: User wants to go to an EXISTING page listed above (e.g., "Go to dashboard").
2. **CREATE_PAGE**: User wants to create a NEW distinct page (e.g., "Create a settings page", "Add a marketing dashboard").
3. **UPDATE_CURRENT**: User wants to modify the CURRENT page (e.g., "Add a calendar here", "Put a chart on this page", "Change the title").
4. **CHAT**: User is greeting or asking for help with no UI intent.

OUTPUT FORMAT (JSON):
{
    "intent": "NAVIGATE" | "CREATE_PAGE" | "UPDATE_CURRENT" | "CHAT",
    "targetSlug": "string" (For NAVIGATE: exact slug. For CREATE_PAGE: suggested new slug. For UPDATE_CURRENT: "${currentSlug}"),
    "pageTitle": "string" (For CREATE_PAGE: suggested title),
    "confidence": number (0-1)
}
`;

        try {
            const result = await modelManager.generateContent(routerPrompt, {
                model: "gemini-2.0-flash",
                jsonMode: true
            });
            const text = result.response.text();
            return JSON.parse(text);
        } catch (e) {
            console.error("[Router] Failed:", e);
            return { intent: "EXECUTE", confidence: 0 };
        }
    }
}

export const routerAgent = new RouterAgent();
