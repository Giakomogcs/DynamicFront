import express from 'express';
import { sessionService } from '../services/SessionService.js';
import { versioningService } from '../services/VersioningService.js';

const router = express.Router();

/**
 * SESSSION MANAGEMENT
 */

// List all sessions (for Showcase)
router.get('/', async (req, res) => {
    try {
        // In the future: filter by req.user.id
        // For now list all or filter by query param conversationId
        const { conversationId } = req.query;
        if (conversationId) {
            const session = await sessionService.createSession(conversationId);
            return res.json([session]);
        }
        // TODO: listAll() not implemented in service yet, but needed for Showcase
        // defaulting to empty or mock for now
        res.json([]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create New Session (Project)
router.post('/', async (req, res) => {
    try {
        const { title, conversationId } = req.body;
        // Generate a random conversationId if not provided (for new clean projects)
        const finalConvId = conversationId || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const session = await sessionService.createSession(finalConvId, null, title);
        res.json(session);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Session Structure (Project)
router.get('/:id/structure', async (req, res) => {
    try {
        const session = await sessionService.getSessionStructure(req.params.id);
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json(session);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Session Details (Keep legacy /:id for now or alias)
router.get('/:id', async (req, res) => {
    try {
        const session = await sessionService.getSessionStructure(req.params.id);
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json(session);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create/Get Session by Conversation ID
router.post('/init', async (req, res) => {
    try {
        const { conversationId } = req.body;
        const session = await sessionService.createSession(conversationId);
        res.json(session);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Auto-Name Session
router.post('/:id/autoname', async (req, res) => {
    try {
        const { context } = req.body;
        const title = await sessionService.autoNameSession(req.params.id, context);
        res.json({ title });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * CANVAS (PAGES)
 */
router.post('/:sessionId/pages', async (req, res) => {
    try {
        const { route, type, title } = req.body;
        const canvas = await sessionService.createCanvas(req.params.sessionId, route, type, title);
        res.json(canvas);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * VERSIONING
 */
router.post('/canvas/:canvasId/snapshot', async (req, res) => {
    try {
        const { description } = req.body;
        const version = await versioningService.createSnapshot(req.params.canvasId, description);
        res.json(version);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/canvas/:canvasId/history', async (req, res) => {
    try {
        const history = await versioningService.getHistory(req.params.canvasId);
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/canvas/:canvasId/restore/:versionId', async (req, res) => {
    try {
        const restored = await versioningService.restoreSnapshot(req.params.versionId);
        res.json(restored);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
