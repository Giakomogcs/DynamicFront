
import prisma from '../registry.js';

export async function getSettings(req, res) {
    try {
        const settings = await prisma.systemSetting.findMany();
        const settingsMap = {};
        settings.forEach(s => {
            try {
                settingsMap[s.key] = JSON.parse(s.value);
            } catch {
                settingsMap[s.key] = s.value;
            }
        });
        res.json(settingsMap);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

export async function updateSetting(req, res) {
    const { key, value } = req.body;
    try {
        const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

        const setting = await prisma.systemSetting.upsert({
            where: { key: key },
            update: { value: strValue },
            create: { key: key, value: strValue }
        });

        // Parse back for response
        let parsed = setting.value;
        try { parsed = JSON.parse(setting.value); } catch { }

        res.json({ key: setting.key, value: parsed });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
