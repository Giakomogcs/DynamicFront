import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const STORAGE_FILE = path.join(DATA_DIR, 'canvases.json');

// Ensure data directory exists
async function initStorage() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }

    try {
        await fs.access(STORAGE_FILE);
    } catch {
        await fs.writeFile(STORAGE_FILE, JSON.stringify({}, null, 2));
    }
}

async function readStorage() {
    await initStorage();
    const data = await fs.readFile(STORAGE_FILE, 'utf-8');
    return JSON.parse(data);
}

async function writeStorage(data) {
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2));
}

export const storageService = {
    async getAllCanvases() {
        const data = await readStorage();
        return Object.values(data).map(c => ({
            id: c.id,
            title: c.title,
            updatedAt: c.updatedAt,
            widgetCount: c.widgets?.length || 0,
            messageCount: c.messages?.length || 0,
            groupId: c.groupId || null,
            linkedCanvases: c.linkedCanvases || []
        }));
    },

    async getCanvas(id) {
        const data = await readStorage();
        return data[id] || null;
    },

    async saveCanvas(id, title, widgets, messages = null, groupId = null) {
        const data = await readStorage();
        const now = new Date().toISOString();

        if (data[id]) {
            // Update
            data[id] = {
                ...data[id],
                title: title !== undefined ? title : data[id].title,
                widgets: widgets !== undefined ? widgets : data[id].widgets,
                messages: messages !== undefined ? messages : data[id].messages,
                groupId: groupId !== undefined ? groupId : data[id].groupId,
                updatedAt: now
            };
        } else {
            // Create
            data[id] = {
                id,
                title: title || 'Untitled Canvas',
                widgets: widgets || [],
                messages: messages || [],
                groupId: groupId || null,
                linkedCanvases: [],
                createdAt: now,
                updatedAt: now
            };
        }

        await writeStorage(data);
        return data[id];
    },

    async appendWidgets(id, newWidgets) {
        const data = await readStorage();
        if (!data[id]) {
            throw new Error('Canvas not found');
        }

        data[id].widgets = [...(data[id].widgets || []), ...newWidgets];
        data[id].updatedAt = new Date().toISOString();

        await writeStorage(data);
        return data[id];
    },

    async linkCanvases(fromId, toId, label = null) {
        const data = await readStorage();
        if (!data[fromId] || !data[toId]) {
            throw new Error('Canvas not found');
        }

        // Add bidirectional link
        if (!data[fromId].linkedCanvases) data[fromId].linkedCanvases = [];
        if (!data[toId].linkedCanvases) data[toId].linkedCanvases = [];

        const linkExists = data[fromId].linkedCanvases.some(l => l.id === toId);
        if (!linkExists) {
            data[fromId].linkedCanvases.push({ id: toId, label });
            data[toId].linkedCanvases.push({ id: fromId, label });
        }

        await writeStorage(data);
        return { from: data[fromId], to: data[toId] };
    },

    async getRelatedCanvases(id) {
        const data = await readStorage();
        const canvas = data[id];
        if (!canvas) return [];

        const related = [];

        // Get linked canvases
        if (canvas.linkedCanvases) {
            for (const link of canvas.linkedCanvases) {
                if (data[link.id]) {
                    related.push({
                        ...data[link.id],
                        linkLabel: link.label
                    });
                }
            }
        }

        // Get canvases in same group
        if (canvas.groupId) {
            for (const c of Object.values(data)) {
                if (c.groupId === canvas.groupId && c.id !== id) {
                    const alreadyLinked = related.some(r => r.id === c.id);
                    if (!alreadyLinked) {
                        related.push({
                            ...c,
                            linkLabel: 'Same Group'
                        });
                    }
                }
            }
        }

        return related;
    },

    async deleteCanvas(id) {
        const data = await readStorage();
        if (data[id]) {
            // Remove links from other canvases
            for (const canvas of Object.values(data)) {
                if (canvas.linkedCanvases) {
                    canvas.linkedCanvases = canvas.linkedCanvases.filter(l => l.id !== id);
                }
            }

            delete data[id];
            await writeStorage(data);
            return true;
        }
        return false;
    }
};
