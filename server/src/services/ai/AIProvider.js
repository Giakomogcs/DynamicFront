export class AIProvider {
    constructor(config) {
        this.config = config;
        this.name = "AbstractProvider";
        this.id = "abstract";
    }

    /**
     * Generates content from a prompt or chat history.
     * @param {string | Array<{role: string, content: string}>} input - Prompt string or Messages array
     * @param {object} options { model: string, temperature: number, tools: [], jsonMode: boolean, systemInstruction: string }
     * @returns {Promise<{text: string, toolCalls: Array}>}
     */
    async generateContent(input, options = {}) {
        throw new Error("Not implemented");
    }

    /**
     * @returns {Promise<Array<{name: string, displayName: string, description: string}>>}
     */
    async listModels() {
        throw new Error("Not implemented");
    }

    async validate() {
        try {
            const models = await this.listModels();
            return models && models.length > 0;
        } catch (e) {
            return false;
        }
    }
}
