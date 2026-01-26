import express from 'express';
import { toolService } from '../services/toolService.js';
import { authStrategyManager } from '../auth/AuthStrategyManager.js';

const router = express.Router();

/**
 * POST /api/widgets/refresh
 * Refreshes widget data by re-executing its datasource
 */
router.post('/refresh', async (req, res) => {
    try {
        const { tool, authProfile, params } = req.body;

        if (!tool) {
            return res.status(400).json({ error: 'Tool name required' });
        }

        console.log(`[Widget Refresh] Refreshing ${tool} with profile ${authProfile}`);

        // 1. Resolve auth profile if needed
        let authCredentials = {};
        if (authProfile && authProfile !== 'default') {
            const profile = authStrategyManager.selectProfile([tool], authProfile);
            if (profile) {
                authCredentials = profile.credentials;
                console.log(`[Widget Refresh] Using auth profile: ${profile.label}`);
            }
        }

        // 2. Execute tool with params
        const result = await toolService.executeTool(tool, {
            ...params,
            ...authCredentials
        });

        // 3. Extract value from result
        let value = null;
        let data = null;

        if (result.content && result.content[0]) {
            const text = result.content[0].text;
            try {
                const parsed = JSON.parse(text);

                // Handle different response formats
                if (Array.isArray(parsed)) {
                    data = parsed;
                    value = parsed.length;  // Count for stats
                } else if (parsed.data) {
                    data = parsed.data;
                    value = parsed.data.length || parsed.total || Object.keys(parsed.data).length;
                } else if (parsed.value !== undefined) {
                    value = parsed.value;
                    data = parsed;
                } else {
                    data = parsed;
                    value = Object.keys(parsed).length;
                }
            } catch (e) {
                // Not JSON, use raw text
                value = text;
                data = { raw: text };
            }
        }

        res.json({
            success: true,
            value,
            data,
            timestamp: new Date().toISOString(),
            tool
        });

    } catch (error) {
        console.error('[Widget Refresh] Error:', error.message);
        res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

/**
 * POST /api/widgets/refresh-batch
 * Refreshes multiple widgets at once (optimization)
 */
router.post('/refresh-batch', async (req, res) => {
    try {
        const { widgets } = req.body;

        if (!Array.isArray(widgets)) {
            return res.status(400).json({ error: 'Widgets array required' });
        }

        console.log(`[Widget Refresh] Batch refresh for ${widgets.length} widgets`);

        // Group by tool to avoid duplicate calls
        const toolGroups = new Map();
        widgets.forEach(w => {
            const key = `${w.tool}-${JSON.stringify(w.params)}`;
            if (!toolGroups.has(key)) {
                toolGroups.set(key, { ...w, widgetIds: [] });
            }
            toolGroups.get(key).widgetIds.push(w.widgetId);
        });

        console.log(`[Widget Refresh] Optimized to ${toolGroups.size} unique calls`);

        // Execute all unique calls
        const results = [];
        for (const [key, widgetData] of toolGroups) {
            try {
                const result = await toolService.executeTool(widgetData.tool, widgetData.params);

                // Parse result
                let value = null;
                let data = null;
                if (result.content && result.content[0]) {
                    try {
                        const parsed = JSON.parse(result.content[0].text);
                        data = parsed;
                        value = Array.isArray(parsed) ? parsed.length : parsed.value || parsed.total;
                    } catch (e) {
                        value = result.content[0].text;
                    }
                }

                // Add result for all widget IDs that share this datasource
                widgetData.widgetIds.forEach(id => {
                    results.push({
                        widgetId: id,
                        success: true,
                        value,
                        data,
                        timestamp: new Date().toISOString()
                    });
                });
            } catch (error) {
                // Mark all as failed
                widgetData.widgetIds.forEach(id => {
                    results.push({
                        widgetId: id,
                        success: false,
                        error: error.message
                    });
                });
            }
        }

        res.json({
            success: true,
            results,
            totalRequested: widgets.length,
            uniqueCalls: toolGroups.size
        });

    } catch (error) {
        console.error('[Widget Batch Refresh] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
