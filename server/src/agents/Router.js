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
You are the ROUTER Agent for a Multi - Page Web App Builder.
User Input: "${userMessage}"
Current Page: "${currentSlug}"(Active Canvas)
Session Context(Available Pages):
${availablePages.map(p => `- ${p}`).join('\n') || "No other pages yet."}

Your goal is to classify the INTENT.

            INTENTS:
        1. ** NAVIGATE **: User wants to go to an EXISTING page listed above(e.g., "Go to dashboard").
2. ** CREATE_PAGE **: User wants to create a NEW distinct page(e.g., "Create a settings page", "Add a marketing dashboard").
3. ** UPDATE_CURRENT **: User wants to modify the CURRENT page(e.g., "Add a calendar here", "Put a chart on this page", "Change the title").
4. ** DATA_REQUEST **: User is asking for information, data, organizations, searching for items, or using system tools (e.g., "Show me schools", "List companies", "Find courses", "Search for X"). This requires TOOL USAGE.
5. ** CHAT **: User is greeting, saying thanks, or asking general questions with no UI/Data intent(e.g., "Olá", "Who are you?", "Help").

            IMPORTANT Rules: 
            - If the user asks for specific **DATA** or **RESOURCES** (e.g. "List items", "Show X", "Find Y", "Analysis of Z") -> Classify as ** DATA_REQUEST ** or ** UPDATE_CURRENT **.
            - If the request implies **fetching**, **listing**, **searching**, or **calculating** information from the backend -> ** DATA_REQUEST **.
            - If the user says something like "Olá", "Tudo bem", or "Bom dia", ALWAYS classify as CHAT.

OUTPUT FORMAT(JSON):
        {
            "intent": "NAVIGATE" | "CREATE_PAGE" | "UPDATE_CURRENT" | "DATA_REQUEST" | "CHAT",
                "targetSlug": "string"(For NAVIGATE: exact slug.For CREATE_PAGE: suggested new slug.For UPDATE_CURRENT: "${currentSlug}"),
                    "pageTitle": "string"(For CREATE_PAGE: suggested title),
                        "confidence": number(0 - 1)
        }
        `;

        try {
            const result = await modelManager.generateContent(routerPrompt, {
                model: "gemini-2.0-flash",
                jsonMode: true
            });
            let text = result.response.text();

            // Defensive: Handle undefined text
            if (typeof text !== 'string') {
                console.warn("[Router] Warning: result.response.text() returned non-string:", text);
                text = "";
            }

            // Clean up Markdown code blocks if present
            text = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim();

            try {
                return JSON.parse(text);
            } catch (jsonErr) {
                console.warn("[Router] JSON Parse failed, raw text:", text);
                // Fallback: If it looks like valid JSON but failed, try regex extraction?
                // For now, default to CHAT which will trigger normal execution
                return { intent: "CHAT", confidence: 0 };
            }
        } catch (e) {
            console.error("[Router] Failed:", e);
            return { intent: "EXECUTE", confidence: 0 };
        }
    }
}

export const routerAgent = new RouterAgent();
