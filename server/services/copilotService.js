import axios from 'axios';

const DEFAULT_CLIENT_ID = 'Iv1.b507a08c87ecfe98'; // VS Code ID

// Headers from ia-chat reference
const DEFAULT_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "GeminiChat-App/1.0",
    "Editor-Version": "vscode/1.85.0",
    "Editor-Plugin-Version": "copilot/1.145.0"
};

class CopilotService {
    constructor() {
        this.baseUrl = 'https://api.githubcopilot.com';
        this.userAgent = DEFAULT_HEADERS["User-Agent"];
    }

    /**
     * Step 1: Request Device Code
     */
    async requestDeviceCode(clientId) {
        // Use env var or passed clientId or default
        const finalClientId = process.env.COPILOT_CLIENT_ID || clientId || DEFAULT_CLIENT_ID;

        try {
            console.log(`[CopilotService] Requesting device code for client: ${finalClientId}`);
            const res = await axios.post(
                'https://github.com/login/device/code',
                {
                    client_id: finalClientId,
                    scope: "read:user"
                },
                {
                    headers: {
                        ...DEFAULT_HEADERS,
                        "Content-Type": "application/json"
                    },
                }
            );
            return res.data;
        } catch (error) {
            console.error('[CopilotService] Request Code Error:', error.message);
            throw new Error(error.response?.data?.error_description || error.message);
        }
    }

    /**
     * Step 2: Exchange Device Code for Token (Single Attempt)
     * The frontend or caller should handle the polling loop/interval.
     */
    async fetchToken(clientId, deviceCode) {
        const finalClientId = process.env.COPILOT_CLIENT_ID || clientId || DEFAULT_CLIENT_ID;

        try {
            const res = await axios.post(
                'https://github.com/login/oauth/access_token',
                {
                    client_id: finalClientId,
                    device_code: deviceCode,
                    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                },
                {
                    headers: {
                        ...DEFAULT_HEADERS,
                        "Content-Type": "application/json"
                    },
                }
            );

            if (res.data.error) {
                // Returns object like { error: 'authorization_pending', ... }
                return res.data;
            }

            return {
                access_token: res.data.access_token,
                token_type: res.data.token_type,
                scope: res.data.scope
            };
        } catch (error) {
            console.error('[CopilotService] Token Fetch Error:', error.message);
            throw new Error(error.response?.data?.error_description || error.message);
        }
    }

    /**
     * Step 3: Exchange OAuth Token for Internal API Token
     * This is the crucial step for VS Code compatibility.
     */
    async exchangeToken(oauthToken) {
        try {
            console.log('[CopilotService] Exchanging OAuth token for Internal Token...');
            const res = await axios.get(
                'https://api.github.com/copilot_internal/v2/token',
                {
                    headers: {
                        ...DEFAULT_HEADERS,
                        "Authorization": `token ${oauthToken}`
                    }
                }
            );

            // Response: { token: "tid_...", endpoints: { api: "https://api.githubcopilot.com" }, expires_at: 123... }
            return res.data;
        } catch (error) {
            console.error('[CopilotService] Token Exchange Error:', error.message);
            // If 401, the oauth token might be invalid
            if (error.response?.status === 401) {
                throw new Error("Unauthorized: Invalid OAuth Token during exchange");
            }
            throw new Error(error.response?.data?.message || "Failed to exchange token");
        }
    }

    /**
     * Get Available Models (Using the exchanged token or performing exchange implicitly?)
     * Get Available Models
     * Automatically attempts token exchange if an OAuth token is provided.
     */
    async getModels(accessToken) {
        if (!accessToken) throw new Error("No access token provided");

        let tokenToUse = accessToken;
        let endpointBase = "https://api.githubcopilot.com"; // Correct default for VS Code-like behavior

        // If it looks like an OAuth token, exchange it first to get the correct endpoint and token
        if (accessToken.startsWith('gho_')) {
            try {
                const exchange = await this.exchangeToken(accessToken);
                tokenToUse = exchange.token;
                if (exchange.endpoints && exchange.endpoints.api) {
                    endpointBase = exchange.endpoints.api;
                }
            } catch (e) {
                console.warn("[CopilotService] Token exchange failed in getModels, trying direct access...", e.message);
                // If exchange fails, we might still try standard endpoint if the token is valid for it
            }
        }

        try {
            // Reference says: GET <api_endpoint>/models
            const url = `${endpointBase}/models`;

            const res = await axios.get(url, {
                headers: {
                    ...DEFAULT_HEADERS,
                    "Authorization": `Bearer ${tokenToUse}`,
                    "Copilot-Integration-Id": "vscode-chat"
                }
            });

            if (res.data && res.data.data) {

                const validModels = res.data.data.filter((m) => {
                    // model_picker_enabled === true
                    if (m.model_picker_enabled !== true) return false;
                    // capabilities.type === "chat"
                    if (m.capabilities?.type !== "chat") return false;
                    // policy.state === "enabled"
                    if (m.policy?.state !== "enabled") return false;
                    return true;
                });
                return validModels;
            }

            if (Array.isArray(res.data)) {
                // Filter
                const validModels = res.data.filter((m) => {
                    // model_picker_enabled === true
                    if (m.model_picker_enabled !== true) return false;
                    // capabilities.type === "chat"
                    if (m.capabilities?.type !== "chat") return false;
                    // policy.state === "enabled"
                    if (m.policy?.state !== "enabled") return false;
                    return true;
                });
                return validModels;
            }
            return [];
        } catch (error) {
            console.error('[CopilotService] Get Models Error:', error.message);
            if (error.response?.status === 401) {
                throw new Error("Unauthorized: Invalid Token");
            }
            return [];
        }
    }

    /**
     * Validate Token (User Info)
     */
    async getUser(accessToken) {
        // This still uses standard GitHub API with OAuth token
        try {
            const res = await axios.get("https://api.github.com/user", {
                headers: {
                    ...DEFAULT_HEADERS,
                    "Authorization": `Bearer ${accessToken}`
                }
            });
            return res.data; // { login, id, ... }
        } catch (error) {
            throw new Error("Failed to fetch user");
        }
    }
}

export const copilotService = new CopilotService();
