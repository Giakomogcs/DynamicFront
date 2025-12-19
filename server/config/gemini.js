import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

export class GeminiModelManager {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            console.error("CRITICAL: GEMINI_API_KEY is missing from .env");
        }
        this.genAI = new GoogleGenerativeAI(this.apiKey);

        // Load models from env or defaults
        this.primaryModelName = process.env.GEMINI_MODEL_PRIMARY || "gemini-2.5-flash";
        this.secondaryModelName = process.env.GEMINI_MODEL_SECONDARY || "gemini-2.5-pro";
    }

    /**
     * customized getGenerativeModel that supports simple failover logic.
     * Note: The Google SDK doesn't support "fallback" in the constructor.
     * We must implement a wrapper to try-catch the execution, OR just provide the config
     * so the caller can switch. 
     * 
     * For simplicity/stability, we will return the GenerativeModel instance for the PRIMARY first.
     * The Caller (Agent Loop) will need to handle errors and retry with checkSecondary if needed.
     * 
     * However, to keep it simple for the existing codebase, we can expose a method 
     * to get the 'Best Available' model layout or just the Primary one.
     */
    getPrimaryModel(config = {}) {
        return this.genAI.getGenerativeModel({
            model: this.primaryModelName,
            ...config
        });
    }

    getSecondaryModel(config = {}) {
        return this.genAI.getGenerativeModel({
            model: this.secondaryModelName,
            ...config
        });
    }

    /**
     * Helper to execute a standard prompt with failover
     */
    async generateContentWithFailover(prompt, config = {}) {
        try {
            const model = this.getPrimaryModel(config);
            return await model.generateContent(prompt);
        } catch (error) {
            console.warn(`[GeminiManager] Primary model (${this.primaryModelName}) failed. Trying secondary (${this.secondaryModelName}). Error: ${error.message}`);
            // Simple 404/429 check could be added here
            try {
                const model = this.getSecondaryModel(config);
                return await model.generateContent(prompt);
            } catch (secError) {
                console.error(`[GeminiManager] Secondary model also failed.`, secError);
                throw secError; // Re-throw if both fail
            }
        }
    }
}

export const geminiManager = new GeminiModelManager();
