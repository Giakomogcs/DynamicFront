import prisma from '../registry.js';

export class VersioningService {

    /**
     * Creates a snapshot of the current canvas state.
     * @param {string} canvasId 
     * @param {string} changeDescription - Optional manual log
     */
    async createSnapshot(canvasId, changeDescription = "Auto-save") {
        const canvas = await prisma.canvas.findUnique({
            where: { id: canvasId },
            include: { widgets: true }
        });

        if (!canvas) throw new Error("Canvas not found");

        const snapshot = {
            title: canvas.title,
            theme: canvas.theme,
            layoutType: canvas.layoutType,
            widgets: canvas.widgets,
            route: canvas.route
        };

        return await prisma.canvasVersion.create({
            data: {
                canvasId,
                snapshot,
                changeLog: changeDescription
            }
        });
    }

    /**
     * Restores a canvas to a specific version.
     * @param {string} versionId 
     */
    async restoreSnapshot(versionId) {
        const version = await prisma.canvasVersion.findUnique({
            where: { id: versionId }
        });

        if (!version) throw new Error("Version not found");

        const snapshot = version.snapshot;
        if (!snapshot) throw new Error("Snapshot data is empty");

        // Transactional restore
        return await prisma.$transaction(async (tx) => {
            // 1. Delete current widgets
            await tx.widget.deleteMany({
                where: { canvasId: version.canvasId }
            });

            // 2. Restore widgets from snapshot
            // Note: We generate NEW IDs for widgets to avoid conflicts or complex upserts
            if (snapshot.widgets && Array.isArray(snapshot.widgets)) {
                for (const w of snapshot.widgets) {
                    await tx.widget.create({
                        data: {
                            canvasId: version.canvasId,
                            type: w.type,
                            title: w.title,
                            config: w.config,
                            position: w.position
                        }
                    });
                }
            }

            // 3. Restore Canvas Metadata
            return await tx.canvas.update({
                where: { id: version.canvasId },
                data: {
                    title: snapshot.title,
                    theme: snapshot.theme,
                    layoutType: snapshot.layoutType,
                    route: snapshot.route
                },
                include: { widgets: true }
            });
        });
    }

    /**
     * Get version history for a timeline UI.
     */
    async getHistory(canvasId) {
        return await prisma.canvasVersion.findMany({
            where: { canvasId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                changeLog: true,
                createdAt: true
            }
        });
    }
}

export const versioningService = new VersioningService();
