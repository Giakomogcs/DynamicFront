import express from 'express';
import { widgetDataService } from '../services/WidgetDataService.js';

const router = express.Router();

/**
 * POST /api/test/proxy
 * Body: { tool: "name", params: {} }
 */
router.post('/proxy', async (req, res) => {
    try {
        const { tool, params } = req.body;
        const result = await widgetDataService.executeProxy(tool, params);
        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

export default router;
