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
    async design(summaryText, data, modelName, steps = []) {
        console.log("[Designer] Generating Widgets...");

        // If no data check
        if ((!data || data.length === 0) && (!steps || steps.length === 0)) {
            return { text: summaryText, widgets: [] };
        }

        const serializedData = JSON.stringify(data);
        const MAX_DESIGNER_CONTEXT = 15000;
        const safeData = serializedData.length > MAX_DESIGNER_CONTEXT
            ? serializedData.substring(0, MAX_DESIGNER_CONTEXT) + "... [DATA TRUNCATED]"
            : serializedData;

        const designerPrompt = `
You are the UI DESIGNER Agent.
Your input: A summary text, a set of raw data blocks, and the EXECUTION PLAN used to get this data.
Your goal: Generate a JSON array of "Widgets" to visualize this data and the process.

Input Text: "${summaryText}"
Input Data: ${safeData}
Execution Strategy (Steps): ${JSON.stringify(steps)}

WIDGET TYPES (Use these to tell a STORY):
1. **process**: { "type": "process", "title": "Execution Pipeline", "steps": [{ "name": "Step 1", "status": "completed", "description": "..." }] }
   - ALWAYS start with this to show *how* you got the data. Reflect the "Execution Strategy".
2. **stat**: { "type": "stat", "data": [{ "label": "X", "value": "Y", "change": "+10%", "icon": "trending_up" }] }
   - Use for Key Performance Indicators or simple counts (e.g., "Total Schools Found").
3. **chart**: { "type": "chart", "config": { "chartType": "bar|line|pie|area", "title": "Meaningful Title", "description": "What this chart shows" }, "data": [...] }
   - Use 'bar' for comparisons (e.g. Courses per Branch).
   - Use 'pie' for distribution (e.g. Schools by City).
4. **table**: { "type": "table", "title": "Detailed Data", "data": [...] }
   - Use for granular listings.
5. **insight**: { "type": "insight", "title": "Analysis / Status", "content": ["Bullet point 1", "Bullet point 2"], "sentiment": "neutral|warning|success" }
   - Use to summarize findings, give warnings (e.g. "No schools found in X"), or provide recommendations.

INSTRUCTIONS:
- Return ONLY the JSON array inside \`\`\`json\`\`\` code blocks.
- **Visual Storytelling**: The widgets should flow logically: Process -> Stats -> Charts -> Details.
- **Contextualize**: Don't just show numbers. Use Titles and Descriptions.
- **Analysis**: If the user asked for "most repeated" or "top", calculate it from the raw list (e.g. Top 5 Bar Chart).
- **Empty/Error State**: If data is missing/error, use an "insight" widget to explain why (e.g. "Try removing accents") AND a "process" widget showing where it failed.
- **Completeness**: Aim for at least 3 widgets: Process, Insight, and Data (Table/Chart).

CRITICAL DATA FORMATTING RULES:
1. **Chart Data Structure**: EVERY chart data item MUST have exactly these keys: { "name": "Label", "value": 123 }
   - ❌ WRONG: { "city": "São Paulo", "count": 5 }
   - ✅ CORRECT: { "name": "São Paulo", "value": 5 }
2. **Table Data Completeness**: Include ALL rows from the input data. DO NOT truncate or sample.
   - If input has 18 items, table MUST show all 18 items.
   - Only limit if explicitly asked (e.g., "top 5").
3. **Data Transformation**: Extract and transform raw API responses into clean, user-friendly formats.
   - Remove internal IDs, technical fields, null values.
   - Format dates, numbers, and text for readability.
4. **Multi-Tool Results**: If multiple tools were called, create separate widgets for each result set.
   - Example: One table for "SENAI Units", another table for "Courses".
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
