import { modelManager } from '../services/ai/ModelManager.js';
import { storageService } from '../services/storageService.js';

export class RouterAgent {
    constructor() { }

    /**
     * analyzeRequest
     * Decides if the user wants to:
     * 1. NAVIGATE (Switch to another page/canvas)
     * 2. EXECUTE (Run tools on current page)
     * 3. CHAT (Ask for help/explanation)
     * 
     * @param {string} userMessage 
     * @param {string} currentSlug 
     * @param {string} sessionId 
     */
    async analyzeRequest(userMessage, currentSlug = 'home', sessionId) {
        // 1. Get Project Context (Routes)
        let projectRoutes = [];
        if (sessionId) {
            // TODO: Implement getProjectNavigation in StorageService
            // For now, fast path: just define common intent
        }

        const routerPrompt = `
You are the ROUTER Agent for a Web App Builder.
User Input: "${userMessage}"
Current Page: "${currentSlug}"

Your goal is to classify the INTENT.

INTENTS:
1. **NAVIGATE**: User wants to go to a DIFFERENT page/view (e.g. "Go to settings", "Open contracts", "Back to home").
2. **EXECUTE**: User wants to see data, change data, or build something ON THE CURRENT PAGE or broadly (e.g. "Show me active contracts", "Add a table", "Analyze this").
3. **CHAT**: User is greeting or asking for help (e.g. "Hi", "Help", "How do I use this?").

OUTPUT FORMAT (JSON):
{
    "intent": "NAVIGATE" | "EXECUTE" | "CHAT",
    "targetSlug": "string" (only for NAVIGATE, guess the best slug e.g. 'settings', 'dashboard'),
    "confidence": number (0-1)
}
`;

        try {
            const result = await modelManager.generateContent(routerPrompt, {
                model: "gemini-2.0-flash", // Fast model for routing
                jsonMode: true
            });
            const text = result.response.text();
            return JSON.parse(text);
        } catch (e) {
            console.error("[Router] Failed:", e);
            return { intent: "EXECUTE", confidence: 0 }; // Default to normal execution
        }
    }
}

export const routerAgent = new RouterAgent();
