import prisma from '../registry.js';
import { modelManager } from './ai/ModelManager.js';

export class SessionService {

    /**
     * Creates a new session (Project).
     * @param {string} conversationId - The chat conversation ID.
     * @param {string} userId - Optional user ID (future).
     */
    async createSession(conversationId, userId = null, title = "New Project") {
        // Check if session exists for this conversation
        let session = await prisma.session.findUnique({
            where: { conversationId }
        });

        if (!session) {
            session = await prisma.session.create({
                data: {
                    conversationId,
                    userId,
                    title: title, // Use provided title
                    description: "Project Space"
                }
            });
            // Create default Home Page (App Builder Structure)
            // Note: We use the helper which we will also update below
            await this.createCanvas(session.id, '/home', 'home', 'Home', true);
        }

        return session;
    }

    /**
     * Creates a new Canvas (Page) within a session.
     */
    // Helper to create initial canvas
    async createCanvas(sessionId, route, slug, title, isHome = false) {
        return prisma.canvas.create({
            data: {
                sessionId,
                route,   // Legacy support
                slug,    // New routing ID
                title,
                isHome,  // Entry point?
                icon: isHome ? 'House' : 'File', // Default icon
                type: 'dashboard',
                layoutType: 'grid',
                widgets: {
                    create: [] // Start empty, let the user/AI fill it
                }
            }
        });
    }

    /**
     * Gets the full structure of a session (Project).
     */
    async getSessionStructure(sessionId) {
        return await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                canvases: {
                    select: {
                        id: true,
                        route: true,
                        slug: true,   // Needed for App Builder link
                        title: true,
                        isHome: true, // Needed for Home icon
                        icon: true,   // Needed for Sidebar
                        type: true,
                        updatedAt: true
                        // Don't fetch widgets here, too heavy
                    }
                }
            }
        });
    }

    /**
     * Gets a specific Canvas by Session ID and Route.
     */
    async getCanvasByRoute(sessionId, route) {
        return await prisma.canvas.findFirst({
            where: { sessionId, route },
            include: {
                widgets: {
                    orderBy: { position: 'asc' }
                },
                outgoingLinks: true,
                incomingLinks: true
            }
        });
    }

    /**
     * Uses LLM to generate a better title for the session based on context.
     * @param {string} sessionId 
     * @param {string} userMessage - Context
     */
    async autoNameSession(sessionId, userMessage) {
        try {
            const prompt = `
                Generate a short, professional title (max 4-5 words) for a Business Intelligence project 
                based on this user request: "${userMessage}".
                Return ONLY the title, no quotes.
                Examples: "Sales Analysis June", "HR Dashboard", "Logistics Overview".
            `;

            // Use a lightweight model if possible, or default
            const title = await modelManager.generateText(prompt, 'gemini-2.0-flash');

            if (title) {
                const cleanTitle = title.trim().replace(/^"|"$/g, '');
                await prisma.session.update({
                    where: { id: sessionId },
                    data: { title: cleanTitle }
                });
                return cleanTitle;
            }
        } catch (e) {
            console.warn("[SessionService] Auto-naming failed:", e);
        }
        return null;
    }
}

export const sessionService = new SessionService();
