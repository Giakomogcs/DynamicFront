import { z } from "zod";

/**
 * Validates and fetches an OpenAPI spec from a URL
 */
export async function validateApiSpec(url, auth = null) {
    try {
        const options = {};
        if (auth) {
            options.headers = {};
            if (auth.username && auth.password) {
               // Basic Auth
               const creds = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
               options.headers['Authorization'] = `Basic ${creds}`;
            } else if (auth.token) {
               // Bearer Token
               options.headers['Authorization'] = `Bearer ${auth.token}`;
            } else if (auth.apiKey && auth.headerName) {
               // API Key in Header
               options.headers[auth.headerName] = auth.apiKey;
            }
        }
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`Failed to fetch spec: ${response.statusText}`);
        const spec = await response.json();
        // Basic validation: check for 'openapi' or 'swagger' version
        if (!spec.openapi && !spec.swagger) {
            throw new Error("Invalid OpenAPI/Swagger spec");
        }
        return spec;
    } catch (error) {
        throw new Error(`Spec validation failed: ${error.message}`);
    }
}

/**
 * Generates MCP Tools from a Registered API
 */
export async function getApiTools(api) {
    let globalAuth = null;
    let profiles = {};
    try {
        if (api.authConfig) {
            const parsed = JSON.parse(api.authConfig);
            if (parsed.api) {
                globalAuth = parsed.api.default;
                profiles = parsed.api.profiles || {};
            } else {
                globalAuth = parsed;
            }
        }
    } catch { /* ignore */ }

    // 1. Check for Pre-Generated Tool Config (LLM Hallucinated or Stored)
    if (api.toolConfig) {
        try {
            const config = JSON.parse(api.toolConfig);
            if (config.tools && Array.isArray(config.tools)) {
                return config.tools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                    _exec: {
                        type: 'api',
                        apiId: api.idString,
                        method: tool.apiConfig.method,
                        path: tool.apiConfig.path || tool.apiConfig.pathTemplate,
                        baseUrl: tool.apiConfig.baseUrl || api.baseUrl,
                        paramLocation: tool.apiConfig.paramLocation,
                        path: tool.apiConfig.path || tool.apiConfig.pathTemplate,
                        baseUrl: tool.apiConfig.baseUrl || api.baseUrl,
                        paramLocation: tool.apiConfig.paramLocation,
                        auth: tool.apiConfig.auth || globalAuth,
                        profiles: profiles
                    }
                }));
            }
        } catch (e) {
            console.error(`Error parsing stored toolConfig for API ${api.name}:`, e);
            // Fallthrough to dynamic generation if stored config is corrupt
        }
    }

    // 2. Standard OpenAPI Parsing (Dynamic)
    const tools = [];
    const specUrl = api.specUrl;
    if (!specUrl) return tools;

    try {
        const spec = await validateApiSpec(specUrl);
        const paths = spec.paths || {};

        for (const [path, methods] of Object.entries(paths)) {
            for (const [method, operation] of Object.entries(methods)) {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
                    const pathSuffix = path.replace(/[\/{}]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                    const operationId = operation.operationId || `${method}_${pathSuffix}`;
                    const toolName = `${api.name.toLowerCase().replace(/\s+/g, '_')}_${operationId}`.toLowerCase();

                    tools.push({
                        name: toolName,
                        description: operation.summary || operation.description || `Call ${method.toUpperCase()} ${path}`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                params: {
                                    type: "object",
                                    description: "Parameters for the API call (path variables, query params, body)"
                                },
                                _authProfile: {
                                    type: "string",
                                    description: `Optional: Auth profile to use. Available: ${Object.keys(profiles).length ? Object.keys(profiles).join(', ') : 'none'}`,
                                    enum: Object.keys(profiles).length > 0 ? Object.keys(profiles) : undefined,
                                    nullable: true
                                }
                            },
                        },
                        _exec: {
                            type: 'api',
                            apiId: api.idString,
                            method: method,
                            path: path,
                            baseUrl: api.baseUrl,
                            path: path,
                            baseUrl: api.baseUrl,
                            auth: globalAuth,
                            profiles: profiles
                        }
                    });
                }
            }
        }
    } catch (e) {
        console.error(`Error generating tools for API ${api.name}:`, e);
    }

    return tools;
}

/**
 * Executes an API Tool Call
 */
export async function executeApiTool(toolExecConfig, args) {
    const { method, path, baseUrl, profiles } = toolExecConfig;
    let auth = toolExecConfig.auth;

    if (args._authProfile && profiles && profiles[args._authProfile]) {
        auth = profiles[args._authProfile];
    }

    let url = baseUrl ? baseUrl.replace(/\/$/, '') + path : path;

    // Replace Path Variables
    const params = args.params || {};
    // Extract dynamic headers if present (Agent-Driven Auth)
    const dynamicHeaders = args._headers || {};

    let finalUrl = url;


    // 1. Path Params replacement
    for (const [key, value] of Object.entries(params)) {
        if (finalUrl.includes(`{${key}}`)) {
            finalUrl = finalUrl.replace(`{${key}}`, value);
        }
    }

    const fetchOptions = {
        method: method.toUpperCase(),
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // --- Authentication Handling ---
    if (auth) {
        if (auth.type === 'bearer' && auth.token) {
            fetchOptions.headers['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'apiKey' && auth.paramName) {
            const keyName = auth.paramName;
            const keyValue = auth.value || process.env[auth.envVar];
            const location = auth.paramLocation || 'query'; // 'header' | 'query' (default)

            if (keyValue) {
                if (location === 'header') {
                    fetchOptions.headers[keyName] = keyValue;
                } else {
                    // Default to Query
                    const separator = finalUrl.includes('?') ? '&' : '?';
                    finalUrl += `${separator}${keyName}=${encodeURIComponent(keyValue)}`;
                }
            }
        } else if (auth.type === 'basic' && auth.username && auth.password) {
            const creds = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            fetchOptions.headers['Authorization'] = `Basic ${creds}`;
        }
    }

    // --- Dynamic Headers Override (Agent-Driven) ---
    if (dynamicHeaders && typeof dynamicHeaders === 'object') {
        Object.assign(fetchOptions.headers, dynamicHeaders);
    }

    // DEBUG LOG
    console.log(`[API Exec] ${method} ${finalUrl}`);
    console.log(`[API Headers]`, JSON.stringify(fetchOptions.headers).replace(/("Authorization":\s*")[^"]+(")/, '$1[REDACTED]$2'));


    // 2. Query Params / Body Logic
    if (method.toLowerCase() === 'get') {
        const urlObj = new URL(finalUrl);
        for (const [key, value] of Object.entries(params)) {
            // Avoid duplicating if we just added it via auth, or path var
            if (!url.includes(`{${key}}`) && key !== auth?.paramName) {
                urlObj.searchParams.append(key, value);
            }
        }
        finalUrl = urlObj.toString();
    } else {
        const body = {};
        let hasBody = false;
        for (const [key, value] of Object.entries(params)) {
            if (!url.includes(`{${key}}`) && key !== auth?.paramName) {
                body[key] = value;
                hasBody = true;
            }
        }
        if (hasBody) fetchOptions.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(finalUrl, fetchOptions);
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }

        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
    } catch (error) {
        return {
            content: [{ type: "text", text: `Error calling API: ${error.message}` }],
            isError: true
        };
    }
}
