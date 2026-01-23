
import prisma from '../registry.js';

import { modelManager } from '../services/ai/ModelManager.js';

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

        console.log(`[Settings] updateSetting: ${key} = ${strValue}`);

        const setting = await prisma.systemSetting.upsert({
            where: { key: key },
            update: { value: strValue },
            create: { key: key, value: strValue }
        });

        console.log(`[Settings] DB Updated: ${setting.key} = ${setting.value}`);

        // Parse back for response
        let parsed = setting.value;
        try { parsed = JSON.parse(setting.value); } catch { }

        // Reload ModelManager to pick up new keys or toggles
        if (key.includes('API_KEY') || key.includes('TOKEN') || key.includes('URL') || key === 'enabledModels' || key.includes('PROVIDER_ENABLED') || key === 'FAILOVER_ENABLED') {

            // SPECIAL SYNC: If toggling Gemini Internal, sync to ConnectedProvider table
            if (key === 'PROVIDER_ENABLED_GEMINI-INTERNAL') {
                try {
                    const isEnabled = parsed === true || parsed === 'true';
                    await prisma.connectedProvider.updateMany({
                        where: { providerId: 'gemini-internal' },
                        data: { isEnabled: isEnabled }
                    });
                    console.log(`[Settings] Synced Gemini Internal status to ConnectedProviders: ${isEnabled}`);
                } catch (syncErr) {
                    console.error("[Settings] Failed to sync Gemini Internal status:", syncErr);
                }
            }

            try {
                // Run in background to not block response? No, we needed it to be synchronous-ish? 
                // Actually, if it takes too long, just fire and forget might be safer for stability, 
                // but then the UI might refresh before it's ready.
                // Compromise: Use debounced reload (false) to avoid thrashing when multiple keys save at once.
                // The OnboardingWizard validates explicitly which might trigger a refresh, so we don't need FULL reload here every time.
                await modelManager.reload(false);

                // CRITICAL: Force cache invalidation on provider toggle
                if (key.includes('PROVIDER_ENABLED')) {
                    modelManager.modelsCache = null;
                    modelManager.modelsCacheTimestamp = 0;
                    console.log(`[Settings] Invalidated models cache due to provider toggle: ${key}`);
                }
            } catch (reloadErr) {
                console.error("[Settings] CRITICAL: Failed to reload ModelManager", reloadErr);
                // Do not throw, keep server alive
            }
        }

        res.json({ key: setting.key, value: parsed });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
