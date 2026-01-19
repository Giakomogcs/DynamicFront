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
            updatedAt: c.updatedAt.toISOString(),
            widgetCount: c.widgets.length,
            messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
            groupId: c.conversationId,
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
            messages: canvas.messages || [],
            groupId: canvas.conversationId,
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
            if (messages !== undefined) updateData.messages = messages;
            if (groupId !== undefined) updateData.conversationId = groupId;

            await tx.canvas.upsert({
                where: { id },
                create: {
                    id,
                    title,
                    conversationId: groupId || 'default',
                    theme: {},
                    messages: messages || [],
                    layoutType: 'dashboard'
                },
                update: updateData
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
                            position: index
                        }))
                    });
                }
            }

            // Return full object
            return this.getCanvas(id);
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
    }
};


