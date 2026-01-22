import { copilotService } from '../services/copilotService.js';

export async function startCopilotAuth(req, res) {
    const { clientId } = req.body || {}; // Handle potential undefined body
    // if (!clientId) return res.status(400).json({ error: "Missing clientId" }); // Remove strict check, let Service use default

    try {
        const data = await copilotService.requestDeviceCode(clientId);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

export async function pollCopilotToken(req, res) {
    let { clientId, deviceCode, device_code } = req.body || {};
    deviceCode = deviceCode || device_code; // Support both casings

    if (!deviceCode) return res.status(400).json({ error: "Missing deviceCode" }); // clientId is optional (handled by service)

    try {
        const result = await copilotService.fetchToken(clientId, deviceCode);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

export async function listCopilotModels(req, res) {
    // Expecting token in header: Authorization: Bearer <token>
    // OR in query param if easier, but header is standard.
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing Bearer token" });
    }

    const token = authHeader.split(' ')[1];

    try {
        const models = await copilotService.getModels(token);
        res.json(models);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

export async function getCopilotUser(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing Bearer token" });
    }
    const token = authHeader.split(' ')[1];

    try {
        const user = await copilotService.getUser(token);
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

export async function handleCallback(req, res) {
    const { code } = req.query;
    if (code) {
        res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: green;">Authentication Callback Received</h1>
                    <p>Code: <code>${code}</code></p>
                    <p>If you are using Device Flow, you shouldn't be here. If you are configuring a Web App for a custom implementation, please copy the code above.</p>
                </body>
            </html>
        `);
    } else {
        res.send("No code received.");
    }
}
