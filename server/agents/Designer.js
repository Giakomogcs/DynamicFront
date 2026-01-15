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
      console.log("[Designer] Canvas Context:", canvasContext ? `Mode: ${canvasContext.mode}, IDs: ${canvasContext.widgets?.map(w => w.id).join(', ')}` : 'None');

      // If no data and no steps, nothing to visualize?
      // Actually, sometimes we might just want to re-arrange existing widgets? 
      // But usually we have at least text.
      if ((!data || data.length === 0) && (!steps || steps.length === 0) && (!canvasContext || canvasContext.widgets?.length === 0)) {
         return { text: summaryText, widgets: [] };
      }

      const MAX_DESIGNER_CONTEXT = 15000;
      let safeData = JSON.stringify(data);

      // Intelligent Truncation
      // Intelligent Sanitization & Truncation
      if (safeData.length > MAX_DESIGNER_CONTEXT) {
         console.log(`[Designer] ⚠️ Data too large (${safeData.length} chars). Sanitizing heavy fields...`);
         
         // 1. First pass: Remove likely heavy fields (base64, huge descriptions)
         const sanitizedData = this._stripHeavyFields(data);
         safeData = JSON.stringify(sanitizedData);

         // 2. Second pass: Truncate list if still too big
         if (safeData.length > MAX_DESIGNER_CONTEXT) {
             console.log(`[Designer] ⚠️ Still too large (${safeData.length} chars). Truncating list...`);
             if (Array.isArray(sanitizedData)) {
                let currentSize = 2;
                const safeArray = [];
                for (const item of sanitizedData) {
                   const itemStr = JSON.stringify(item);
                   if (currentSize + itemStr.length + 1 > MAX_DESIGNER_CONTEXT) break;
                   safeArray.push(item);
                   currentSize += itemStr.length + 1;
                }
                safeData = JSON.stringify(safeArray);
                console.log(`[Designer] ✂️  Truncated to ${safeArray.length} items to fit context.`);
             } else {
                safeData = JSON.stringify({ message: "Data too large", count: Object.keys(data).length });
             }
         }
      }

      // --- CONTEXT PREPARATION ---
      let contextInfo = '';
      let existingIds = [];
      if (canvasContext && canvasContext.widgets && canvasContext.widgets.length > 0) {
         const widgetSummaries = canvasContext.widgets.map(w => {
            existingIds.push(w.id);
            return `- ID: "${w.id}" | Type: ${w.type} | Title: "${w.title}"`;
         }).join('\n');

         contextInfo = `
*** CONTEXTUAL AWARENESS (EXISTING SCREEN) ***
The user is looking at a screen with these widgets:
${widgetSummaries}

*** LATEST USER SUMMARY ***
User Goal: "${summaryText}"

*** STRATEGIC LAYOUT INSTRUCTIONS ***
You must decide how to update the screen. Do NOT just wipe it unless the topic changed completely.
Choose a STRATEGY:
1. **FRESH_START**: Topic changed significantly? -> Clear all, create new.
2. **AUGMENT (Drill-Down)**: User asked for details on an item? -> KEEP the parent list, ADD the detail widget next to/below it.
3. **REFINE**: User filtered the list? -> REPLACE the target widget with new data, KEEP the rest.
4. **REORGANIZE**: User asked to change view? -> KEEP widgets but re-order.

*** OUTPUT FORMAT (JSON) ***
Return a JSON object with a "layout" array containing actions:
{
  "strategy": "augment",
  "reasoning": "Keeping the school list for context, adding course details below.",
  "layout": [
    { "action": "keep", "id": "widget_id_of_list" }, 
    { "action": "create", "widget": { "type": "table", "title": "New Courses", "data": [...] } }
  ]
}
Allowed Actions:
- "keep": { "action": "keep", "id": "..." } (Preserves state)
- "create": { "action": "create", "widget": { ... } } (New widget)
- "update": { "action": "update", "id": "...", "widget": { ... } } (Replace content of specific widget)
`;
      } else {
         contextInfo = `
*** OUTPUT FORMAT ***
Standard JSON array of widgets: [ { "type": "...", ... }, ... ]
`;
      }

      const designerPrompt = `
You are the AI UI DESIGNER.
Your goal: Generate or Update the "Widgets" to visualize the data and process.

Input Text: "${summaryText}"
Input Data: ${safeData}
Execution Steps: ${JSON.stringify(steps)}

${contextInfo}

*** WIDGET TYPES ***
1. **process**: { "type": "process", "title": "Pipeline", "steps": [...] } (ALWAYS include if Steps exist)
2. **stat**: { "type": "stat", "data": [{ "label": "X", "value": "Y" }] }
3. **table**: { "type": "table", "title": "Data", "data": [...], "actions": [] } (Core data view)
4. **chart**: { "type": "chart", "config": {...}, "data": [...] }
5. **insight**: { "type": "insight", "content": "..." }

*** CRITICAL DESIGN RULES ***
1. **INTERACTIVITY**: Add "actions" to tables (e.g. { "label": "View Details", "tool": "tool_name", "args_map": {"id": "id"} }).
2. **KPIs**: Always extract stats.
3. **AESTHETICS**: Use "style" properties (primary, success, danger) in actions.
`;

      try {
         const result = await modelManager.generateContent(designerPrompt, {
            model: modelName,
            jsonMode: true
         });
         const designText = result.response.text();
         const parsed = this.extractJson(designText);

         // --- HYBRID MERGE LOGIC ---
         if (parsed.layout && Array.isArray(parsed.layout)) {
            console.log(`[Designer] 🧠 Strategy: ${parsed.strategy} (${parsed.reasoning})`);
            
            const finalWidgets = [];
            const existingWidgetsMap = new Map(canvasContext?.widgets?.map(w => [w.id, w]) || []);

            for (const action of parsed.layout) {
               if (action.action === 'keep' && action.id) {
                  const w = existingWidgetsMap.get(action.id);
                  if (w) finalWidgets.push(w);
               } else if (action.action === 'create' && action.widget) {
                  // Assign ID if missing
                  if (!action.widget.id) action.widget.id = `gen_${Math.random().toString(36).substr(2, 9)}`;
                  finalWidgets.push(action.widget);
               } else if (action.action === 'update' && action.id && action.widget) {
                  // Merge or Replace? Usually Replace data but keep ID
                  const w = action.widget;
                  w.id = action.id; // Force ID match
                  finalWidgets.push(w);
               }
            }
            return { text: summaryText, widgets: finalWidgets };

         } else if (Array.isArray(parsed)) {
            // Legacy / Fresh Start format
            return { text: summaryText, widgets: parsed };
         } else {
            // Fallback
            return { text: summaryText, widgets: [] };
         }

      } catch (e) {
         console.error("[Designer] Failed:", e);
         return {
            text: this._createFallbackText(summaryText, data),
            widgets: []
         };
      }
   }

   extractJson(text) {
       try {
           const match = text.match(/```json\s*([\s\S]*?)\s*```/);
           if (match) return JSON.parse(match[1]);
           // Try parsing the whole text if it starts with { or [
           if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
               return JSON.parse(text);
           }
       } catch (e) { }
       return []; // Empty on failure
   }

   _createFallbackText(summaryText, data) {
      // Create a simple text summary if Designer fails
      let text = summaryText || "Processamento concluído.";

      if (data && data.length > 0) {
         text += `\n\nDados coletados: ${data.length} registro(s).`;
      }

      return text;
   }


   /**
    * Recursively removes heavy fields (base64, long html, etc)
    */
   _stripHeavyFields(obj, depth = 0) {
       if (depth > 5) return "[Deep Nested]";
       if (!obj) return obj;

       if (Array.isArray(obj)) {
           return obj.map(item => this._stripHeavyFields(item, depth + 1));
       }

       if (typeof obj === 'object') {
           const newObj = {};
           for (const [key, value] of Object.entries(obj)) {
               // 1. Remove obvious heavy keys
               if (/image|photo|base64|icon|svg|content|html|body/i.test(key)) {
                    // Only remove if it looks like a huge string
                    if (typeof value === 'string' && value.length > 500) {
                        continue; 
                    }
               }
               
               // 2. Truncate long strings
               if (typeof value === 'string' && value.length > 1000) {
                   newObj[key] = value.substring(0, 500) + '...[Truncated]';
               } else if (typeof value === 'object') {
                   newObj[key] = this._stripHeavyFields(value, depth + 1);
               } else {
                   newObj[key] = value;
               }
           }
           return newObj;
       }

       return obj;
   }
}

export const designerAgent = new DesignerAgent();
