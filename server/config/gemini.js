import { modelManager } from '../services/ai/ModelManager.js';

// Proxy object to maintain backward compatibility
export const geminiManager = {
    // Forward generateContentWithFailover
    generateContentWithFailover: (prompt, config) => modelManager.generateContentWithFailover(prompt, config),

    // Forward executeQueuedRequest
    executeQueuedRequest: (fn) => modelManager.executeQueuedRequest(fn),

    // Legacy: getPrimaryModel - This is the tricky one used by Executor.
    // If we call this, we return a "Dummy Model" that has startChat?
    // WARNING: This is unsafe if Executor relies on full SDK behavior.
    // Ideally we update Executor. But to prevent crash on startup:
    getPrimaryModel: (config) => {
        console.warn("[geminiManager] DEPRECATED getPrimaryModel called. Please refactor to use stateless generateContent.");
        // We will return a mock that breaks if used, prompting refactor
        return {
            startChat: () => { throw new Error("startChat is deprecated in ModelManager. Refactor ExecutorAgent to use stateless calls."); },
            generateContent: (p) => modelManager.generateContent(p, config)
        };
    },

    listAvailableModels: () => modelManager.getAvailableModels(),

    // Properties
    get primaryModelName() { return "gemini-2.0-flash"; }
};
