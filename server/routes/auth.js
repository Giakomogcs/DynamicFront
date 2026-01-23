import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key';

// CREDENTIALS FROM CLI REFERENCE (https://github.com/marcos2872/ia-chat)
const CLI_CLIENT_ID = process.env.GEMINI_CLI_CLIENT_ID;
const CLI_CLIENT_SECRET = process.env.GEMINI_CLI_CLIENT_SECRET;

// The reference implementation uses http://localhost:3003/oauth2callback
// But we are running on 3000. 
// If the Google Client is configured strictly for 3003, we might need to spawn a temp server or the user needs to update the port.
// However, 'redirect_uri_mismatch' usually implies checking against the whitelist.
// Let's try to match the reference logic exactly if possible, or assume 3000 is allowed if the user says "use this base".
// Actually, if this is a NATIVE APP client type (likely for CLI), it might allow localhost anywhere.
const DEFAULT_REDIRECT_URI = process.env.GEMINI_CLI_REDIRECT_URI || 'http://localhost:3000/auth/gemini-cli/callback';
import { OAuth2Client } from 'google-auth-library';
import { modelManager } from '../services/ai/ModelManager.js';


// Google Auth Trigger
router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google Auth Callback
router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=auth_failed', session: false }),
    (req, res) => {
        // Successful authentication
        const user = req.user;

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Redirect to frontend with token
        // In production, use secure cookies or a redirect page that posts the token
        // For now, passing as query param (safe enough for localhost/dev)
        res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
    }
);


// Manual Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const existing = await prisma.user.findFirst({
            where: { email }
        });

        if (existing) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const adminEmail = 'giakomogcs@gmail.com';
        const role = email === adminEmail ? 'ADMIN' : 'USER';

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || email.split('@')[0],
                role: role
            }
        });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Manual Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.password) {
            // No user or user has no password (Google only?)
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        if (!user.isActive) return res.status(403).json({ error: 'Account deactivated' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (e) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get Current User (via JWT)
router.get('/me', async (req, res) => {
    // Expect "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch fresh user data from DB to ensure isActive/role/limits are up to date
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatarUrl: true,
                isActive: true,
                expiresAt: true,
                projectLimit: true
            }
        });

        if (!user) return res.status(401).json({ error: 'User not found' });

        res.json(user);
    } catch (err) {
        console.error("Auth check error:", err);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// --- Gemini CLI Connection Routes ---

router.get('/gemini-cli/connect', (req, res) => {
    // Check for overridden redirect uri from query param (useful for dev tunnels)
    // BE CAREFUL: This allows open redirects potentially if not validated, 
    // but the OAuth provider (Google) will reject if not whitelisted anyway.
    const customRedirect = req.query.redirect_uri;
    const redirectUri = customRedirect || DEFAULT_REDIRECT_URI;

    const client = new OAuth2Client(CLI_CLIENT_ID, CLI_CLIENT_SECRET, redirectUri);
    const url = client.generateAuthUrl({
        access_type: 'offline', // Required for Refresh Token
        scope: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/userinfo.email'],
        prompt: 'consent' // Force prompts to ensure Refresh Token is returned
    });

    console.log("[Auth] Generatred Gemini CLI Auth URL:", url);
    console.log("[Auth] Using Redirect URI:", redirectUri);

    // Pass state
    const userId = req.query.userId;
    const redirectUrl = req.query.redirect;

    // Create state object
    const state = {
        userId,
        // Save the redirectUri used so we can reuse it in callback
        callbackUri: redirectUri
    };
    if (redirectUrl) state.redirect = redirectUrl;

    const urlObj = new URL(url);
    urlObj.searchParams.append('state', JSON.stringify(state));
    res.redirect(urlObj.toString());
});

router.get('/gemini-cli/callback', async (req, res) => {
    const code = req.query.code;
    const stateStr = req.query.state;

    // Default redirect to resources page
    let finalRedirect = 'http://localhost:5173/resources?success=gemini_connected';

    // Determine the redirect URI to use for verification
    // It MUST match what was used in generateAuthUrl
    let redirectUri = DEFAULT_REDIRECT_URI;

    if (!code) return res.redirect('http://localhost:5173/resources?error=no_code');

    try {
        let userId = null;
        try {
            if (stateStr) {
                const state = JSON.parse(stateStr);
                userId = state.userId;

                // RESTORE URI used in connect
                if (state.callbackUri) {
                    redirectUri = state.callbackUri;
                    console.log(`[Gemini CLI] Restored redirect URI from state: ${redirectUri}`);
                }

                if (state.redirect) {
                    finalRedirect = state.redirect;
                    // Preserve success/error params if needed, or append them
                    if (!finalRedirect.includes('?')) finalRedirect += '?success=gemini_connected';
                    else finalRedirect += '&success=gemini_connected';
                }
            }
        } catch { }

        const client = new OAuth2Client(CLI_CLIENT_ID, CLI_CLIENT_SECRET, redirectUri);

        // This fails if redirectUri doesn't match the one used to get the code
        const { tokens } = await client.getToken(code);

        // Identify who authenticated (email)
        client.setCredentials(tokens);
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: CLI_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const email = payload.email;

        console.log(`[Gemini CLI] Connected for ${email}`);

        // Store as ConnectedProvider (not VerifiedApi - that's for MCP resources)
        let provider = await prisma.connectedProvider.findFirst({
            where: {
                providerId: 'gemini-internal',
                accountEmail: email
            }
        });

        if (provider) {
            await prisma.connectedProvider.update({
                where: { id: provider.id },
                data: {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                    updatedAt: new Date()
                }
            });
        } else {
            await prisma.connectedProvider.create({
                data: {
                    providerId: 'gemini-internal',
                    providerName: 'Gemini Internal (CLI)',
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                    accountEmail: email,
                    config: JSON.stringify({ client_id: CLI_CLIENT_ID }),
                    isEnabled: true
                }
            });
        }

        // Ensure provider is enabled globally in settings
        await prisma.systemSetting.upsert({
            where: { key: 'PROVIDER_ENABLED_GEMINI-INTERNAL' },
            update: { value: 'true' },
            create: { key: 'PROVIDER_ENABLED_GEMINI-INTERNAL', value: 'true' }
        });

        // RELOAD MODEL MANAGER to pick up new provider
        try {
            await modelManager.reload(true);
        } catch (reloadErr) {
            console.error("Failed to reload ModelManager:", reloadErr);
        }

        res.redirect(finalRedirect);

    } catch (e) {
        console.error('Gemini CLI Callback Error:', e);
        // Try to respect redirect even on error if possible, or fallback
        if (stateStr) {
            try {
                const state = JSON.parse(stateStr);
                if (state.redirect) {
                    const failUrl = state.redirect.includes('?') ? state.redirect + '&error=connection_failed' : state.redirect + '?error=connection_failed';
                    return res.redirect(failUrl);
                }
            } catch { }
        }
        res.redirect('http://localhost:5173/resources?error=connection_failed');
    }
});

router.post('/gemini-cli/disconnect', async (req, res) => {
    try {
        // Just disable it instead of deleting, to preserve tokens if they want to re-enable
        await prisma.connectedProvider.updateMany({
            where: { providerId: 'gemini-internal' },
            data: { isEnabled: false }
        });

        // Also update the global setting
        await prisma.systemSetting.upsert({
            where: { key: 'PROVIDER_ENABLED_GEMINI-INTERNAL' },
            update: { value: 'false' },
            create: { key: 'PROVIDER_ENABLED_GEMINI-INTERNAL', value: 'false' }
        });

        // Also force a reload of ModelManager
        try {
            await modelManager.reload(true);
        } catch (reloadErr) {
            console.error("Failed to reload ModelManager:", reloadErr);
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Disconnect failed", e);
        res.status(500).json({ error: 'Disconnect failed' });
    }
});

export default router;
