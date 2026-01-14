import axios from 'axios';

class CopilotService {
    constructor() {
        this.baseUrl = 'https://api.githubcopilot.com'; // Standard Copilot API, but ref uses models.github.ai. Let's support both or follow ref.
        // Ref repo uses:
        // Auth: https://github.com/login/device/code
        // Token: https://github.com/login/oauth/access_token
        // Models: https://models.github.ai/catalog/models
        // Chat: https://models.github.ai/inference/chat/completions

        this.userAgent = 'DynamicFront/1.0';
    }

    /**
     * Step 1: Request Device Code
     */
    async requestDeviceCode(clientId) {
        try {
            console.log(`[CopilotService] Requesting device code for client: ${clientId}`);
            const res = await axios.post(
                'https://github.com/login/device/code',
                {
                    client_id: clientId,
                    scope: "read:user"
                },
                {
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "User-Agent": this.userAgent
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
        try {
            const res = await axios.post(
                'https://github.com/login/oauth/access_token',
                {
                    client_id: clientId,
                    device_code: deviceCode,
                    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                },
                {
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "User-Agent": this.userAgent
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
     * Get Available Models
     */
    async getModels(accessToken) {
        if (!accessToken) throw new Error("No access token provided");

        try {
            // Using logic from reference repo
            const res = await axios.get("https://models.github.ai/catalog/models", {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": this.userAgent
                }
            });

            if (Array.isArray(res.data)) {
                // Map to a standard format if needed, or return as is
                return res.data;
            }
            return [];
        } catch (error) {
            console.error('[CopilotService] Get Models Error:', error.message);
            // If 401, token might be invalid
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
        try {
            const res = await axios.get("https://api.github.com/user", {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "User-Agent": this.userAgent
                }
            });
            return res.data; // { login, id, ... }
        } catch (error) {
            throw new Error("Failed to fetch user");
        }
    }
}

export const copilotService = new CopilotService();
