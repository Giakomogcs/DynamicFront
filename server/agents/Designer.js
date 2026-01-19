import { modelManager } from '../services/ai/ModelManager.js';

// Phase 3 & 4: Canvas Management & Layout
import { canvasMerger } from '../src/canvas/CanvasMerger.js';
import { layoutOptimizer } from '../src/layout/LayoutOptimizer.js';


export class DesignerAgent {
   constructor() { }

   /**
    * Generates UI widgets based on the execution result.
    * @param {string} summaryText 
    * @param {Array} data 
    * @param {string} modelName 
    * @param {Array} steps - Execution steps
    * @param {Object} canvasContext - Existing canvas context { widgets, messages, mode }
    * @param {Object} canvasDecision - Canvas decision from CanvasGroupManager  
    * @returns {Promise<{text: string, widgets: Array}>}
    */
   async design(summaryText, data, modelName, steps = [], canvasContext = null, canvasDecision = null) {
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

*** DESIGN PHILOSOPHY: "DASHBOARD FIRST" ***
You are NOT generating a chat response. You are generating a PROPRIETARY DATA DASHBOARD (PowerBI / Tableau Style).
Every screen must look like a built-for-purpose mini-application.

WIDGET TYPES (Visual Hierarchy):

1. **process**: { "type": "process", "title": "Execution Pipeline", "steps": [...] }
   - ALWAYS start with this. show the journey.

2. **stat**: { "type": "stat", "data": [{ "label": "X", "value": "Y", "change": "+10%", "icon": "trending_up" }] }
   - EXTRACT KPIS from lists.
   - If input is a list of 10 schools -> Stat: "Total Schools: 10".
   - If input is orders -> Stat: "Total Value: $500".
   - MAKE UP meaningful stats from the raw data.

3. **table**: { "type": "table", "title": "Main Data View", "data": [...], "actions": [] }
   - THE CORE WIDGET.
   - Put ALL list data here.
   - **MANDATORY**: Add "actions" to table configuration for drill-down.
   - Action Example: { "label": "View Courses", "type": "tool_call", "tool": "dn_coursescontroller_searchorderrecommendedcourses", "args_map": { "schoolsCnpj": "cnpj" }, "style": "primary" } (Smart mapping)

4. **chart**: { "type": "chart", "config": { ... }, "data": [{ "name": "Label", "value": 123 }] }
   - AGGREGATE data. Count items by city, by type, by status.
   - Show distributions (Pie) or comparisons (Bar).

5. **insight**: { "type": "insight", "title": "Executive Summary", "content": [], "sentiment": "neutral", "actions": [] }
   - Summarize the finding like an analyst.

**ACTIONS & NAVIGATION (Interactivity):**
- Use \`navigate_canvas\` to "Create New Analysis" for complex drill-downs.
- Use \`tool_call\` for immediate actions (e.g. "Enroll", "Details").

**CRITICAL RULES:**
1. **NO SIMPLE LISTS**: Never just dump text. Use Tables.
2. **KPIs ARE KING**: Always find at least 2 numbers to show in a 'stat' widget.
3. **INTERACTIVITY**: Every table should ideally have an action.
4. **DATA COMPLETENESS**: Show all data, but organize it visually.
5. **NO DUPLICATES**: Check 'Input Data' vs 'Existing Canvas Context'. If you are just refreshing the same data, provide an 'insight' or 'stat' update, but DO NOT re-render large tables unless the data changed significantly.
`;

      try {
         // Use ModelManager with Failover
         const result = await modelManager.generateContent(designerPrompt, {
            model: modelName,
            jsonMode: true // Force JSON response
         });
         const designText = result.response.text();
         let widgets = this.extractJsonArray(designText) || [];

         // PHASE 3: Canvas Merge (if needed)
         if (canvasDecision && canvasDecision.action === 'merge' && canvasContext) {
            console.log('[Designer] Merging new widgets into existing canvas...');
            const mergeResult = await canvasMerger.mergeIntoCanvas(
               canvasContext,
               summaryText,
               data,
               widgets
            );
            widgets = mergeResult.canvas.widgets || widgets;
            console.log(`[Designer] Merge complete: ${mergeResult.summary}`);
         }

         // PHASE 4: Layout Optimization
         if (widgets && widgets.length > 0) {
            console.log('[Designer] Optimizing layout...');
            const optimizedWidgets = await layoutOptimizer.optimizeLayout(widgets, {
               strategy: 'auto',
               spacing: 20
            });
            widgets = optimizedWidgets;
            console.log(`[Designer] Layout optimized: ${widgets.length} widgets positioned`);
         }

         // PHASE 5: Data Source Enrichment (Auto-Refresh Metadata)
         if (widgets && widgets.length > 0 && steps && steps.length > 0) {
            console.log('[Designer] Adding auto-refresh metadata...');
            widgets = widgets.map(widget => {
               // Only add dataSource to data-driven widgets
               if (!['stat', 'table', 'chart', 'list'].includes(widget.type)) {
                  return widget;
               }

               // Find which tool provided data for this widget
               const toolStep = steps.find(s => s.tool);

               if (toolStep && toolStep.tool) {
                  widget.dataSource = {
                     tool: toolStep.tool,
                     authProfile: toolStep.authProfile || 'default',
                     params: toolStep.args || {},
                     refreshInterval: this._getRefreshInterval(widget.type),
                     lastUpdate: new Date().toISOString()
                  };
                  console.log(`[Designer] Added auto-refresh to ${widget.type}: ${toolStep.tool}`);
               }

               return widget;
            });
         }

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

   /**
    * Determines refresh interval based on widget type
    * @private
    */
   _getRefreshInterval(widgetType) {
      // Stats need fresh data more frequently
      if (widgetType === 'stat') return 300000;  // 5 minutes

      // Tables can wait longer
      if (widgetType === 'table') return 600000; // 10 minutes
      if (widgetType === 'list') return 600000;  // 10 minutes

      // Charts somewhere in between
      if (widgetType === 'chart') return 450000; // 7.5 minutes

      // Default
      return 600000; // 10 minutes
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
