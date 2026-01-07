// Native fetch is available in Node.js 18+

/**
 * Tests connectivity to a given Base URL with provided Auth Config.
 * Tries a simple HEAD or GET request to the root or health endpoint.
 */
export async function testConnection(baseUrl, authConfig) {
    if (!baseUrl) {
        return { success: false, message: "Base URL is required" };
    }

    let auth = authConfig;
    if (typeof authConfig === 'string') {
        try { auth = JSON.parse(authConfig); } catch { }
    }

    const results = [];

    // Helper: Test Single Auth Profile
    const testSingleProfile = async (profileName, profileId, auth) => {
        let url = baseUrl.replace(/\/$/, '');
        const headers = { 'Content-Type': 'application/json' };

        try {
            // Login Flow Support (Token Exchange)
            if (auth.type === 'basic' && auth.loginUrl) {
                console.log(`[TestConnection] Testing Profile '${profileName}' via Login Flow: ${auth.loginUrl}`);
                const loginFullUrl = auth.loginUrl.startsWith('http') ? auth.loginUrl : `${baseUrl.replace(/\/$/, '')}${auth.loginUrl.startsWith('/') ? '' : '/'}${auth.loginUrl}`;

                let loginBody = {};
                if (auth.loginParams && Array.isArray(auth.loginParams)) {
                    auth.loginParams.forEach(p => {
                        if (p.key) loginBody[p.key] = p.value || '';
                    });
                } else {
                    // Legacy Fallback
                    const userKey = auth.usernameKey || 'username';
                    const passKey = auth.passwordKey || 'password';
                    loginBody[userKey] = auth.username;
                    loginBody[passKey] = auth.password;
                    if (auth.extraBody) {
                        try { Object.assign(loginBody, JSON.parse(auth.extraBody)); } catch (e) { }
                    }
                }

                const loginRes = await fetch(loginFullUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loginBody),
                    signal: AbortSignal.timeout(10000)
                });

                if (!loginRes.ok) {
                    const t = await loginRes.text();
                    return { profile: profileName, success: false, message: `Login Failed (${loginRes.status})`, detail: t.substring(0, 200) };
                }

                const loginData = await loginRes.json();
                const tokenPath = auth.tokenPath || 'access_token';
                const token = tokenPath.split('.').reduce((obj, key) => obj?.[key], loginData);

                if (!token) {
                    return { profile: profileName, success: false, message: `Token not found at '${tokenPath}'`, detail: JSON.stringify(loginData).substring(0, 200) };
                }
                headers['Authorization'] = `Bearer ${token}`;
            }
            // Standard Static Auth
            else if (auth.type === 'bearer' && auth.token) {
                headers['Authorization'] = `Bearer ${auth.token}`;
            } else if (auth.type === 'basic' && auth.username && auth.password) {
                const creds = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
                headers['Authorization'] = `Basic ${creds}`;
            } else if (auth.type === 'apiKey' && auth.paramName && auth.value) {
                if (auth.paramLocation === 'header') {
                    headers[auth.paramName] = auth.value;
                } else {
                    url += `?${auth.paramName}=${encodeURIComponent(auth.value)}`;
                }
            }

            // Actual Test Request
            const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(5000) });
            if (response.ok) {
                return { profile: profileName, success: true, message: `Connected (Status: ${response.status})` };
            } else {
                if (response.status === 404) {
                    return { profile: profileName, success: true, message: `Server reachable (404 on root), but auth accepted.` };
                }
                const text = await response.text();
                return { profile: profileName, success: false, message: `Failed (${response.status} ${response.statusText})`, detail: text.substring(0, 200) };
            }

        } catch (e) {
            return { profile: profileName, success: false, message: `Error: ${e.message}` };
        }
    };

    // 1. Test Default Profile
    const defaultAuth = auth?.api?.default;
    if (defaultAuth) {
        results.push(await testSingleProfile('Default', 'default', defaultAuth));
    } else {
        results.push({ profile: 'Default', success: true, message: 'No default auth configured (Public Access?)' });
    }

    // 2. Test Additional Profiles
    if (auth?.api?.profiles) {
        for (const [name, profileAuth] of Object.entries(auth.api.profiles)) {
            results.push(await testSingleProfile(name, name, profileAuth));
        }
    }

    // Return structured results
    const allSuccess = results.every(r => r.success);
    return {
        success: allSuccess,
        message: allSuccess ? "All profiles connected successfully." : "Some profiles connection failed.",
        results: results
    };
}
