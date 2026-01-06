import { geminiManager } from '../config/gemini.js';

export class DesignerAgent {
    constructor() { }

    /**
     * Generates UI widgets based on the execution result.
     * @param {string} summaryText 
     * @param {Array} data 
     * @param {string} modelName 
     * @returns {Promise<{text: string, widgets: Array}>}
     */
    async design(summaryText, data, modelName) {
        // If no data, minimal design needed? Actually user might want just text.
        if (!data || data.length === 0) {
            return { text: summaryText, widgets: [] };
        }

        console.log("[Designer] Generating Widgets...");

        const serializedData = JSON.stringify(data);
        const MAX_DESIGNER_CONTEXT = 15000;
        const safeData = serializedData.length > MAX_DESIGNER_CONTEXT
            ? serializedData.substring(0, MAX_DESIGNER_CONTEXT) + "... [DATA TRUNCATED]"
            : serializedData;

        const designerPrompt = `
You are the UI DESIGNER Agent.
Your input: A summary text and a set of raw data blocks.
Your goal: Generate a JSON array of "Widgets" to visualize this data.

Input Text: "${summaryText}"
Input Data: ${safeData}

WIDGET TYPES:
1. stat (KPIs): { "type": "stat", "data": [{ "label": "X", "value": "Y", "change": "+10%" }] }
2. chart: { "type": "chart", "config": { "chartType": "bar|line|pie", "dataKey": "key", "valueKey": "val", "title": "..." }, "data": [...] }
3. table: { "type": "table", "data": [...] }
4. insight: { "type": "insight", "title": "...", "content": ["..."] }

INSTRUCTIONS:
- Return ONLY the JSON array inside \`\`\`json\`\`\` code blocks.
- Create at least one widget if the data permits.
`;

        try {
            // Use Queue with Failover
            const result = await geminiManager.generateContentWithFailover(designerPrompt, { model: modelName });
            const designText = result.response.text();
            const widgets = this.extractJsonArray(designText) || [];

            return { text: summaryText, widgets };

        } catch (e) {
            console.error("[Designer] Failed:", e);
            // Fallback
            return { text: summaryText, widgets: [] };
        }
    }

    extractJsonArray(text) {
        try {
            const match = text.match(/```json\s*([\s\S]*?)\s*```/);
            if (match) {
                const parsed = JSON.parse(match[1]);
                return Array.isArray(parsed) ? parsed : [parsed];
            }
            const start = text.indexOf('[');
            const end = text.lastIndexOf(']');
            if (start !== -1 && end !== -1) return JSON.parse(text.substring(start, end + 1));
        } catch (e) { return []; }
        return [];
    }
}

export const designerAgent = new DesignerAgent();
