import prisma from '../registry.js';

export const storageService = {
    async getAllCanvases() {
        const canvases = await prisma.canvas.findMany({
            include: { widgets: true, incomingLinks: true, outgoingLinks: true },
            orderBy: { updatedAt: 'desc' }
        });
        return canvases.map(c => ({
            id: c.id,
            title: c.title || 'Untitled',
            slug: c.slug,
            isHome: c.isHome,
            icon: c.icon,
            updatedAt: c.updatedAt.toISOString(),
            widgetCount: c.widgets.length,
            messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
            groupId: c.sessionId,
            linkedCanvases: [
                ...c.outgoingLinks.map(l => ({ id: l.toCanvasId, label: l.label })),
                ...c.incomingLinks.map(l => ({ id: l.fromCanvasId, label: l.label })),
            ]
        }));
    },

    async getCanvas(id) {
        const canvas = await prisma.canvas.findUnique({
            where: { id },
            include: { widgets: { orderBy: { position: 'asc' } }, outgoingLinks: true, incomingLinks: true }
        });
        if (!canvas) return null;

        return {
            ...canvas,
            title: canvas.title || 'Untitled',
            slug: canvas.slug,
            isHome: canvas.isHome,
            icon: canvas.icon,
            messages: canvas.messages || [],
            groupId: canvas.sessionId,
            widgets: canvas.widgets.map(w => ({
                id: w.id,
                type: w.type,
                title: w.title,
                // Map config back to root properties or content as needed
                // If config contains content, expose it.
                // We return both config and spread it for max compatibility
                config: w.config,
                ...(typeof w.config === 'object' ? w.config : {})
            })),
            linkedCanvases: [
                ...canvas.outgoingLinks.map(l => ({ id: l.toCanvasId, label: l.label })),
                ...canvas.incomingLinks.map(l => ({ id: l.fromCanvasId, label: l.label })),
            ]
        };
    },

    async saveCanvas(id, title, widgets, messages = null, groupId = null) {
        // Upsert Canvas
        return prisma.$transaction(async (tx) => {
            // 1. Upsert Canvas
            // Prepare update data (ignore undefined)
            const updateData = {};
            if (title !== undefined) updateData.title = title;
            // Phase 2: Persist new fields if provided in update (implicit via body usually, but explicit here for safety)
            // Note: saveCanvas args are limited, so we might need to rely on '...rest' pattern or just extend args later.
            // For now, let's assume updateData can take more if we passed an object.
            // BUT, since we are strict on args:
            if (groupId !== undefined) updateData.sessionId = groupId;

            await tx.canvas.upsert({
                where: { id },
                create: {
                    id,
                    title,
                    slug: await this._generateUniqueSlug(title, id, groupId),
                    sessionId: groupId, // Must be a valid Session ID now
                    theme: {},
                    layoutType: 'dashboard'
                },
                update: updateData // Note: Update usually preserves slug unless we add logic to change it
            });

            // 2. Handle Widgets (Full Replacement if provided)
            if (widgets !== undefined) {
                // Delete all existing for this canvas
                await tx.widget.deleteMany({ where: { canvasId: id } });

                // Create new
                if (widgets.length > 0) {
                    await tx.widget.createMany({
                        data: widgets.map((w, index) => ({
                            canvasId: id,
                            type: w.type,
                            title: w.title,
                            config: w.config || w.content || w, // Fallback to whole object if no config/content
                            dataSource: w.dataSource || null,
                            position: index
                        }))
                    });
                }
            }

            // UPDATE PARENT SESSION TIMESTAMP
            if (groupId) {
                await tx.session.updateMany({
                    where: { id: groupId },
                    data: { lastActiveAt: new Date() } // Use lastActiveAt as standard "Updated" for sessions
                });
            }

            // Return full object
            // 3. Return updated canvas using strict TX client to ensure visibility
            const saved = await tx.canvas.findUnique({
                where: { id },
                include: { widgets: { orderBy: { position: 'asc' } }, outgoingLinks: true, incomingLinks: true }
            });

            if (!saved) return null;

            return {
                ...saved,
                title: saved.title || 'Untitled',
                slug: saved.slug,
                isHome: saved.isHome,
                icon: saved.icon,
                messages: saved.messages || [],
                groupId: saved.sessionId,
                widgets: saved.widgets.map(w => ({
                    id: w.id,
                    type: w.type,
                    title: w.title,
                    config: typeof w.config === 'object' ? w.config : {}, // Validated object
                    ...((typeof w.config === 'object' ? w.config : {}) || {})
                })),
                linkedCanvases: [
                    ...saved.outgoingLinks.map(l => ({ id: l.toCanvasId, label: l.label })),
                    ...saved.incomingLinks.map(l => ({ id: l.fromCanvasId, label: l.label })),
                ]
            };
        });
    },

    async appendWidgets(id, newWidgets) {
        const maxPos = await prisma.widget.findFirst({
            where: { canvasId: id },
            orderBy: { position: 'desc' }
        });
        let startPos = (maxPos?.position || 0) + 1;

        await prisma.widget.createMany({
            data: newWidgets.map((w, i) => ({
                canvasId: id,
                type: w.type,
                title: w.title,
                config: w.config || w.content || w,
                dataSource: w.dataSource || null,
                position: startPos + i
            }))
        });

        await prisma.canvas.update({ where: { id }, data: { updatedAt: new Date() } });

        return this.getCanvas(id);
    },

    async linkCanvases(fromId, toId, label = null) {
        const existing = await prisma.navigationLink.findFirst({
            where: { fromCanvasId: fromId, toCanvasId: toId }
        });

        if (!existing) {
            await prisma.navigationLink.create({
                data: { fromCanvasId: fromId, toCanvasId: toId, label: label || 'Link', type: 'sidebar' }
            });
        }

        const existingReverse = await prisma.navigationLink.findFirst({
            where: { fromCanvasId: toId, toCanvasId: fromId }
        });
        if (!existingReverse) {
            await prisma.navigationLink.create({
                data: { fromCanvasId: toId, toCanvasId: fromId, label: label || 'Link', type: 'sidebar' }
            });
        }

        return { from: await this.getCanvas(fromId), to: await this.getCanvas(toId) };
    },

    async getRelatedCanvases(id) {
        const c = await this.getCanvas(id);
        if (!c) return [];
        const related = c.linkedCanvases.map(l => ({ id: l.id, linkLabel: l.label }));

        const siblings = await prisma.canvas.findMany({
            where: { conversationId: c.groupId, NOT: { id: id } }
        });

        siblings.forEach(s => {
            if (!related.find(r => r.id === s.id)) {
                related.push({ id: s.id, title: s.title, linkLabel: 'Same Group' });
            }
        });

        return related;
    },

    async deleteCanvas(id) {
        try {
            await prisma.canvas.delete({ where: { id } });
            return true;
        } catch {
            return false;
        }
    },

    async getSessionStructure(sessionId) {
        return prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                canvases: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        isHome: true,
                        _count: { select: { widgets: true } }
                    },
                    orderBy: { isHome: 'desc' }
                }
            }
        });
    },

    async _generateUniqueSlug(title, currentId, sessionId) {
        if (!title) return currentId;

        const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        let slug = baseSlug;
        let counter = 1;

        while (true) {
            const existing = await prisma.canvas.findFirst({
                where: {
                    sessionId: sessionId,
                    slug: slug
                }
            });

            if (!existing || existing.id === currentId) {
                return slug;
            }

            slug = `${baseSlug}-${counter}`;
            counter++;
        }
    },

    // --- CHAT PERSISTENCE ---

    async createChat(sessionId, title = "New Chat") {
        return prisma.chat.create({
            data: {
                sessionId,
                title,
                messages: []
            }
        });
    },

    async getChat(chatId) {
        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat) return null;
        return {
            ...chat,
            messages: Array.isArray(chat.messages) ? chat.messages : []
        };
    },

    async updateChat(chatId, messages, title = null) {
        const data = {};
        if (messages !== undefined) data.messages = messages;
        if (title !== null) data.title = title;

        return prisma.chat.update({
            where: { id: chatId },
            data
        });
    },

    async getProjectChats(sessionId) {
        const chats = await prisma.chat.findMany({
            where: { sessionId },
            orderBy: { updatedAt: 'desc' }
        });
        return chats.map(c => ({
            ...c,
            messages: Array.isArray(c.messages) ? c.messages : []
        }));
    },

    async deleteChat(chatId) {
        try {
            await prisma.chat.delete({ where: { id: chatId } });
            return true;
        } catch {
            return false;
        }
    }
};
