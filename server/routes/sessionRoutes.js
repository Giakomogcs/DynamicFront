import express from 'express';
import prisma from '../registry.js';

const router = express.Router();

// GET /api/sessions - List all sessions (Projects)
router.get('/', async (req, res) => {
    try {
        const sessions = await prisma.session.findMany({
            orderBy: { lastActiveAt: 'desc' },
            include: {
                _count: {
                    select: { canvases: true }
                }
            }
        });

        const formatted = sessions.map(s => ({
            id: s.id,
            title: s.title || 'Untitled Project',
            description: s.description,
            pageCount: s._count.canvases,
            lastActive: s.lastActiveAt,
            thumbnail: s.thumbnail,
            createdAt: s.createdAt
        }));

        res.json(formatted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/sessions - Create new session
router.post('/', async (req, res) => {
    try {
        const { title, description } = req.body;
        // Generate a conversation ID if not provided (server-side generation preferred for uniqueness)
        const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const session = await prisma.session.create({
            data: {
                title: title || 'New Project',
                description: description || '',
                conversationId,
                lastActiveAt: new Date()
            }
        });

        // Auto-create a "Home" canvas for this session
        const homeCanvas = await prisma.canvas.create({
            data: {
                sessionId: session.id,
                title: 'Home',
                slug: 'home',
                isHome: true,
                type: 'dashboard'
                // widgets: [] // REMOVED: Prisma handles empty relations by default, invalid syntax to pass []
            }
        });

        // Update session with last active canvas
        await prisma.session.update({
            where: { id: session.id },
            data: { lastActiveCanvasId: homeCanvas.id }
        });

        res.json({ ...session, startCanvasId: homeCanvas.id });
    } catch (e) {
        console.error("[Session] Create Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/sessions/:id/structure - Get full structure (pages list) for Sidebar
router.get('/:id/structure', async (req, res) => {
    try {
        const { id } = req.params;
        const session = await prisma.session.findUnique({
            where: { id },
            include: {
                canvases: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        isHome: true,
                        icon: true,
                        updatedAt: true
                    },
                    orderBy: { isHome: 'desc' } // Home first, then others? Or createdAt?
                }
            }
        });

        if (!session) return res.status(404).json({ error: 'Session not found' });

        res.json(session);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.session.delete({ where: { id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
