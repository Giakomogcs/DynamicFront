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
            widgetCount: c.widgets?.length || 0
        }));
    },

    async getCanvas(id) {
        const data = await readStorage();
        return data[id] || null;
    },

    async saveCanvas(id, title, widgets) {
        const data = await readStorage();
        const now = new Date().toISOString();

        if (data[id]) {
            // Update
            data[id] = {
                ...data[id],
                title: title || data[id].title,
                widgets: widgets || data[id].widgets,
                updatedAt: now
            };
        } else {
            // Create
            data[id] = {
                id,
                title: title || 'Untitled Canvas',
                widgets: widgets || [],
                createdAt: now,
                updatedAt: now
            };
        }

        await writeStorage(data);
        return data[id];
    },

    async deleteCanvas(id) {
        const data = await readStorage();
        if (data[id]) {
            delete data[id];
            await writeStorage(data);
            return true;
        }
        return false;
    }
};
