import { modelManager } from '../services/ai/ModelManager.js';


export class DesignerAgent {
   constructor() { }

   /**
    * Generates UI widgets based on the execution result.
    * @param {string} summaryText 
    * @param {Array} data 
    * @param {string} modelName 
    * @param {Array} steps - Execution steps
    * @param {Object} canvasContext - Existing canvas context { widgets, messages, mode }
    * @returns {Promise<{text: string, widgets: Array}>}
    */
   async design(summaryText, data, modelName, steps = [], canvasContext = null) {
      console.log("[Designer] Generating Widgets...");
      console.log("[Designer] Canvas Context:", canvasContext ? `Mode: ${canvasContext.mode}, Existing Widgets: ${canvasContext.widgets?.length || 0}` : 'None');

      // If no data check
      if ((!data || data.length === 0) && (!steps || steps.length === 0)) {
         return { text: summaryText, widgets: [] };
      }

      const MAX_DESIGNER_CONTEXT = 15000;
      let safeData = JSON.stringify(data);

      // Intelligent Truncation to ensure VALID JSON
      if (safeData.length > MAX_DESIGNER_CONTEXT) {
         console.log(`[Designer] ⚠️ Data too large (${safeData.length} chars). Truncating safely...`);

         // If data is array (most likely), try to fit items
         if (Array.isArray(data)) {
            let currentSize = 2; // []
            const safeArray = [];
            for (const item of data) {
               const itemStr = JSON.stringify(item);
               if (currentSize + itemStr.length + 1 > MAX_DESIGNER_CONTEXT) {
                  break;
               }
               safeArray.push(item);
               currentSize += itemStr.length + 1; // +1 for comma
            }
            safeData = JSON.stringify(safeArray);
            console.log(`[Designer] ✂️  Truncated to ${safeArray.length} items to fit context.`);
         } else {
            // If object, just substring and hope? No, better to send empty or error.
            // Or try to strip large fields? 
            // Fallback: Send summary only
            safeData = JSON.stringify({ message: "Data too large for visualization", count: data.length || Object.keys(data).length });
         }
      }

      // Build context information
      let contextInfo = '';
      if (canvasContext) {
         const { mode, widgets, messages } = canvasContext;

         if (mode === 'append' && widgets && widgets.length > 0) {
            contextInfo = `\n\nEXISTING CANVAS CONTEXT (APPEND MODE):
- Current widgets on canvas: ${widgets.length}
- Widget types: ${widgets.map(w => w.type).join(', ')}
- Recent chat: ${messages?.slice(-3).map(m => m.text).join(' | ') || 'None'}

IMPORTANT: You are in APPEND mode. The user wants to ADD to existing content, not replace it.
- Build upon existing data
- Reference previous widgets when relevant
- Detect relationships with existing information
- Avoid duplicating information already shown
- Create complementary visualizations`;
         }
      }

      const designerPrompt = `
You are the UI DESIGNER Agent.
Your input: A summary text, a set of raw data blocks, and the EXECUTION PLAN used to get this data.
Your goal: Generate a JSON array of "Widgets" to visualize this data and the process.

Input Text: "${summaryText}"
Input Data: ${safeData}
Execution Strategy (Steps): ${JSON.stringify(steps)}${contextInfo}

WIDGET TYPES (Use these to tell a STORY):
1. **process**: { "type": "process", "title": "Execution Pipeline", "steps": [{ "name": "Step 1", "status": "completed", "description": "..." }] }
   - ALWAYS start with this to show *how* you got the data. Reflect the "Execution Strategy".
2. **stat**: { "type": "stat", "data": [{ "label": "X", "value": "Y", "change": "+10%", "icon": "trending_up" }] }
   - Use for Key Performance Indicators or simple counts (e.g., "Total Schools Found").
3. **chart**: { "type": "chart", "config": { "chartType": "bar|line|pie|area", "title": "Meaningful Title", "description": "What this chart shows", "actions": [] }, "data": [...] }
   - Use 'bar' for comparisons (e.g. Courses per Branch).
   - Use 'pie' for distribution (e.g. Schools by City).
4. **table**: { "type": "table", "title": "Detailed Data", "data": [...], "actions": [] }
   - Use for granular listings.
5. **insight**: { "type": "insight", "title": "Analysis / Status", "content": ["Bullet point 1", "Bullet point 2"], "sentiment": "neutral|warning|success", "actions": [] }
   - Use to summarize findings, give warnings (e.g. "No schools found in X"), or provide recommendations.
6. **expandable**: { "type": "expandable", "title": "Detailed Breakdown", "sections": [{ "title": "Section 1", "content": "...", "data": [...] }] }
   - Use for hierarchical data (e.g., Courses → Units → Lessons).
7. **comparison**: { "type": "comparison", "title": "Side-by-Side Comparison", "items": [{ "name": "Item A", "metrics": {...} }, { "name": "Item B", "metrics": {...} }] }
   - Use to compare similar entities.

**INTERACTIVITY & ACTIONS (NEW)**:
You can add an "actions" array to widgets (chart, table, insight) to make them interactive.
Action Schema: \` { "label": "Button Text", "type": "tool_call", "tool": "tool_name", "args": { "arg1": "value" }, "style": "primary|secondary" } \`
OR for Navigation: \` { "label": "Open Analysis", "type": "navigate_canvas", "canvasId": "new_id_or_null_to_create", "style": "link" } \`

**WHEN TO USE ACTIONS:**
1. **Drill Down**: If showing a list of entities (e.g. Schools), add an action to fetch details (e.g. "View Courses").
   - Example: For a table of Schools, each row acts as context, but you can add a global action "Analyze All Courses".
   - *Advanced*: You can currently only add Global Actions to the widget.
2. **Follow-up**: If a process failed or had warnings, add an action to "Retry with X" or "Search Y instead".
3. **New Analysis**: If the data is dense, add an action "Create Dedicated Canvas" (\`navigate_canvas\`).

INTELLIGENT INSIGHTS (CRITICAL):
When analyzing data, you MUST:
1. **Detect Relationships**: Identify duplicate or similar items across different locations/categories
2. **Proximity Grouping**: When dealing with location data, group by:
   - Nearest/closest items (top 3-5)
   - Regional grouping (same city/state)
   - Overall distribution
3. **Complete Details**: For courses, schools, or services, include:
   - Full descriptions
   - Units/modules/components breakdown
   - Prerequisites, duration, certification
   - Contact information
   - Availability and schedules
4. **Cross-References**: Link related information
   - "This course is also available in 3 other locations"
   - "Similar to Course X but with focus on Y"
5. **Professional Structure**: Create nested, expandable views for complex data
   - Main overview → Detailed breakdown → Specific items

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
         // Use ModelManager with Failover
         const result = await modelManager.generateContent(designerPrompt, {
            model: modelName,
            jsonMode: true // Force JSON response
         });
         const designText = result.response.text();
         const widgets = this.extractJsonArray(designText) || [];

         return { text: summaryText, widgets };

      } catch (e) {
         console.error("[Designer] Failed:", e);

         // Better fallback: Return text with empty widgets
         return {
            text: this._createFallbackText(summaryText, data),
            widgets: []
         };
      }
   }

   _createFallbackText(summaryText, data) {
      // Create a simple text summary if Designer fails
      let text = summaryText || "Processamento concluído.";

      if (data && data.length > 0) {
         text += `\n\nDados coletados: ${data.length} registro(s).`;
      }

      return text;
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
