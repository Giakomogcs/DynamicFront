import express from 'express';
import { canvasGroupManager } from '../canvas/CanvasGroupManager.js';

const router = express.Router();

// In-memory storage (replace with DB in production)
const conversationCanvases = new Map(); // conversationId → [{id, theme, widgets, createdAt}]

/**
 * GET /canvas/groups/:conversationId
 * Returns all canvas groups for a conversation
 */
router.get('/groups/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const canvases = conversationCanvases.get(conversationId) || [];

        // Group by theme
        const groups = canvasGroupManager.groupByTheme(canvases);

        // Convert to array format
        const groupsArray = Array.from(groups.entries()).map(([theme, canvasList]) => ({
            theme,
            count: canvasList.length,
            canvases: canvasList.map(c => ({
                id: c.id,
                createdAt: c.createdAt,
                widgetCount: c.widgets?.length || 0
            }))
        }));

        res.json({
            conversationId,
            totalGroups: groupsArray.length,
            totalCanvases: canvases.length,
            groups: groupsArray
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /canvas/navigation/:conversationId
 * Returns navigation structure for sidebar/menu
 */
router.get('/navigation/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const canvases = conversationCanvases.get(conversationId) || [];

        const navigation = await canvasGroupManager.generateNavigation(conversationId, canvases);

        res.json(navigation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /canvas/save
 * Saves a canvas to a conversation
 */
router.post('/save', async (req, res) => {
    try {
        const { conversationId, canvasId, theme, widgets } = req.body;

        if (!conversationId || !canvasId) {
            return res.status(400).json({ error: 'conversationId and canvasId required' });
        }

        const canvases = conversationCanvases.get(conversationId) || [];

        const newCanvas = {
            id: canvasId,
            theme,
            widgets,
            createdAt: new Date().toISOString()
        };

        canvases.push(newCanvas);
        conversationCanvases.set(conversationId, canvases);

        res.json({ success: true, canvas: newCanvas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /canvas/:conversationId/:canvasId
 * Retrieves a specific canvas
 */
router.get('/:conversationId/:canvasId', (req, res) => {
    try {
        const { conversationId, canvasId } = req.params;
        const canvases = conversationCanvases.get(conversationId) || [];

        const canvas = canvases.find(c => c.id === canvasId);

        if (!canvas) {
            return res.status(404).json({ error: 'Canvas not found' });
        }

        res.json(canvas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
