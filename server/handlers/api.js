import { z } from "zod";

/**
 * Validates and fetches an OpenAPI spec from a URL
 */
export async function validateApiSpec(url, auth = null) {
    console.log(`[API Handler] Validating/Fetching spec: ${url}`);
    try {
        const options = {
            signal: AbortSignal.timeout(5000) // 5s timeout
        };
        if (auth) {
            if (auth.type === 'basic' && auth.username && auth.password) {
                const creds = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
                options.headers = { 'Authorization': `Basic ${creds}` };
            } else if (auth.type === 'bearer' && auth.token) {
                options.headers = { 'Authorization': `Bearer ${auth.token}` };
            } else if (auth.type === 'apiKey' && auth.paramName && auth.value) {
                if (auth.paramLocation === 'header') {
                    options.headers = { [auth.paramName]: auth.value };
                } else {
                    // Assume query param
                    const separator = url.includes('?') ? '&' : '?';
                    url += `${separator}${auth.paramName}=${encodeURIComponent(auth.value)}`;
                }
            }
        }
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`Failed to fetch spec: ${response.statusText}`);
        const spec = await response.json();

        // Basic validation: check for 'openapi' or 'swagger' version
        if (!spec.openapi && !spec.swagger) {
            throw new Error("Invalid OpenAPI/Swagger spec");
        }
        console.log(`[API Handler] Spec fetched successfully: ${url}`);
        return spec;
    } catch (error) {
        console.error(`[API Handler] Spec validation failed for ${url}: ${error.message}`);
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
            } else if (parsed.type) {
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
        // Use docs auth if available, otherwise fallback to global default auth
        // We need to parse authConfig again if not passed explicitly, but api object has it as string
        let specAuth = null;
        try {
            const ac = JSON.parse(api.authConfig || '{}');
            specAuth = ac.docs || ac.api?.default || null;
        } catch { }

        const spec = await validateApiSpec(specUrl, specAuth);

        // Determine Effective Base URL
        let effectiveBaseUrl = api.baseUrl;
        if (!effectiveBaseUrl) {
            if (spec.servers && spec.servers.length > 0) {
                // OpenApi 3
                let serverUrl = spec.servers[0].url;
                if (!serverUrl.startsWith('http') && specUrl) {
                    try {
                        const specObj = new URL(specUrl);
                        // Handle root-relative or just relative
                        if (serverUrl.startsWith('/')) {
                            effectiveBaseUrl = specObj.origin + serverUrl;
                        } else {
                            // Resolve relative path (e.g. 'v1') against spec path? 
                            // Usually servers url is root relative or absolute. simpler to just join with origin if it starts with /
                            // If it doesn't start with /, it is complicated. But let's assume root relative or absolute for now.
                            // Actually, let's use the URL constructor to resolve it properly if possible, but specUrl might be deep.
                            // Safe fallback:
                            effectiveBaseUrl = new URL(serverUrl, specObj.origin).toString();
                        }
                    } catch (e) {
                        effectiveBaseUrl = serverUrl; // Fallback
                    }
                } else {
                    effectiveBaseUrl = serverUrl;
                }
            } else if (spec.host) {
                // Swagger 2
                const scheme = (spec.schemes && spec.schemes.length > 0) ? spec.schemes[0] : 'https';
                effectiveBaseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
            }
        }

        // 3. Fallback: Use Spec URL Origin
        if (!effectiveBaseUrl && specUrl) {
            try {
                const u = new URL(specUrl);
                effectiveBaseUrl = u.origin;
            } catch (e) {
                console.warn("[API Handler] Failed to parse specUrl for fallback base:", e);
            }
        }

        console.log(`[API Handler] Resolved Effective Base URL for '${api.name}': ${effectiveBaseUrl}`);

        const paths = spec.paths || {};

        for (const [path, methods] of Object.entries(paths)) {
            for (const [method, operation] of Object.entries(methods)) {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
                    const pathSuffix = path.replace(/[\/{}]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                    const operationId = operation.operationId || `${method}_${pathSuffix}`;
                    const toolName = `${api.name.toLowerCase().replace(/\s+/g, '_')}_${operationId}`.toLowerCase();

// ... Inside getApiTools loop ...
                    
                    // Flatten Parameters for Better LLM Compatibility
                    const flatProperties = {};
                    const requiredParams = [];

                    // 1. Path Params
                    if (operation.parameters) {
                        operation.parameters.forEach(p => {
                            if (p.in === 'path' || p.in === 'query') {
                                flatProperties[p.name] = {
                                    type: p.schema?.type || "string",
                                    description: p.description
                                };
                                if (p.required) requiredParams.push(p.name);
                            }
                        });
                    }

                    // 2. Body Params?
                    // Simplified: specific keys if defined, or just 'body' object
                    // 2. Body Params
                    // Support parsing application/json body schema to top-level args (Flattened)
                    if (operation.requestBody && operation.requestBody.content && operation.requestBody.content['application/json']) {
                        let schema = operation.requestBody.content['application/json'].schema;
                        
                        // Resolve Reference if present
                        if (schema && schema.$ref) {
                            const refPath = schema.$ref.replace('#/', '').split('/');
                            let resolved = spec;
                            for (const part of refPath) {
                                resolved = resolved && resolved[part];
                            }
                            if (resolved) schema = resolved;
                        }

                        if (schema && schema.properties) {
                            for (const [key, prop] of Object.entries(schema.properties)) {
                                flatProperties[key] = {
                                    type: prop.type || "string",
                                    description: prop.description,
                                    nullable: prop.nullable,
                                    enum: prop.enum
                                };

                                // Handle Array Items
                                if (prop.type === 'array') {
                                    let items = prop.items;
                                    
                                    if (!items) {
                                        // Fallback if spec is missing items
                                        items = { type: "string" }; 
                                    } else if (items.$ref) {
                                        // Resolve Ref in Items
                                        const refPath = items.$ref.replace('#/', '').split('/');
                                        let resolved = spec;
                                        for (const part of refPath) {
                                            resolved = resolved && resolved[part];
                                        }
                                        if (resolved) items = resolved;
                                    }
                                    
                                    // Sanitize Items: Remove boolean required, internal refs
                                    const sanitizedItems = { type: items.type || "string" };
                                    
                                    // CRITICAL FIX: If items is ALSO an array (nested array), Gemini often chokes if spec is weird.
                                    // Flatten nested arrays to 'object' to allow any structure and bypass validation errors.
                                    if (sanitizedItems.type === 'array') {
                                        sanitizedItems.type = 'object';
                                        sanitizedItems.description = 'List of items (Nested structure)';
                                        delete sanitizedItems.items; // Remove recursive requirement
                                    } else if (items.properties) {
                                         sanitizedItems.type = "object";
                                    }
                                    
                                    if (items.enum) sanitizedItems.enum = items.enum;

                                    flatProperties[key].items = sanitizedItems;
                                }

                                if (schema.required && Array.isArray(schema.required) && schema.required.includes(key)) {
                                    requiredParams.push(key);
                                }
                            }
                        }
                    }

                    // Add reserved auth param
                    flatProperties['_authProfile'] = {
                        type: "string",
                        description: `Optional: Auth profile to use. Available: ${Object.keys(profiles).length ? Object.keys(profiles).join(', ') : 'none'}`,
                        enum: Object.keys(profiles).length > 0 ? Object.keys(profiles) : undefined,
                        nullable: true
                    };

                    tools.push({
                        name: toolName,
                        description: operation.summary || operation.description || `Call ${method.toUpperCase()} ${path}`,
                        inputSchema: {
                            type: "object",
                            properties: flatProperties,
                            required: requiredParams
                        },
                        _exec: {
                            type: 'api',
                            apiId: api.idString,
                            method: method,
                            path: path,
                            baseUrl: effectiveBaseUrl,
                            auth: globalAuth,
                            profiles: profiles,
                            // Flag to tell executor to re-pack params? No, executor needs to handle flat params.
                            flatParams: true 
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
    const { method, path, baseUrl, profiles, flatParams } = toolExecConfig;
    let auth = toolExecConfig.auth;

    if (args._authProfile && profiles && profiles[args._authProfile]) {
        auth = profiles[args._authProfile];
    }

    let url = baseUrl ? baseUrl.replace(/\/$/, '') + path : path;

    // Handle Params (Flat or Legacy)
    let params = {};
    const dynamicHeaders = args._headers || {};

    if (flatParams) {
        // Exclude internal keys
        for (const [k, v] of Object.entries(args)) {
            if (k !== '_authProfile' && k !== '_headers') {
                params[k] = v;
            }
        }
    } else {
        params = args.params || {};
    }

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
    // --- Authentication Handling ---
    if (auth) {
        // Token Exchange / Login Flow
        if (auth.type === 'basic' && auth.loginUrl) {
            try {
                // Determine Login URL (Absolute or Relative)
                const cleanLoginUrl = auth.loginUrl.trim();
                const loginFullUrl = cleanLoginUrl.startsWith('http') ? cleanLoginUrl : `${baseUrl.trim().replace(/\/$/, '')}${cleanLoginUrl.startsWith('/') ? '' : '/'}${cleanLoginUrl}`;

                let loginBody = {};
                if (auth.loginParams && Array.isArray(auth.loginParams)) {
                    auth.loginParams.forEach(p => {
                        if (p.key) loginBody[p.key] = p.value || '';
                    });
                } else {
                    // Legacy
                    const userKey = auth.usernameKey || 'username';
                    const passKey = auth.passwordKey || 'password';
                    loginBody[userKey] = auth.username;
                    loginBody[passKey] = auth.password;

                    if (auth.extraBody) {
                        try { Object.assign(loginBody, JSON.parse(auth.extraBody)); } catch (e) { }
                    }
                }

                console.log(`[API Exec] Authenticating via ${loginFullUrl}...`);
                const loginRes = await fetch(loginFullUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loginBody),
                    signal: AbortSignal.timeout(5000)
                });

                if (loginRes.ok) {
                    const loginData = await loginRes.json();
                    let tokenPath = auth.tokenPath || 'access_token';

                    // 1. Try Configured Path
                    let token = tokenPath.split('.').reduce((o, k) => (o || {})[k], loginData);

                    // 2. Smart Fallback if not found
                    if (!token) {
                        console.warn(`[API Exec] Token not found at '${tokenPath}'. Attempting smart search...`);
                        const candidateKeys = ['access_token', 'token', 'accessToken', 'jwt', 'id_token', 'key'];

                        // BFS/Recursive search for these keys in the object? 
                        // For safety, let's just check top level and data level
                        for (const key of candidateKeys) {
                            if (loginData[key]) { token = loginData[key]; break; }
                            if (loginData.data && loginData.data[key]) { token = loginData.data[key]; break; }
                        }
                    }

                    if (token) {
                        console.log(`[API Exec] Auth success. Token found.`);
                        fetchOptions.headers['Authorization'] = `Bearer ${token}`;
                    } else {
                        console.error(`[API Exec] Auth success but token NOT found. Keys available: ${Object.keys(loginData).join(', ')}`);
                        // DO NOT throw, let the request try (maybe it doesn't need auth?) 
                        // Actually, if auth was requested, it probably needs it.
                    }
                } else {
                    console.error(`[API Exec] Auth failed: ${loginRes.status}`);
                }
            } catch (e) {
                console.error(`[API Exec] Auth flow error: ${e.message}`);
                // Proceeding without fresh token, might fail but let's try or should we throw?
                // For now, let's proceed (maybe manual one works?) 
                // actually if login fails, usually the call fails.
            }

        } else if (auth.type === 'bearer' && auth.token) {
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

        if (!response.ok) {
            console.error(`[API Error] ${response.status} ${response.statusText} at ${finalUrl}`);
            console.error(`[API Error Body] ${text}`);
            throw new Error(`API Error ${response.status}: ${text.substring(0, 500)}`); // Truncate for safety
        }

        let data;
        try { data = JSON.parse(text); } catch { data = text; }

        return {
            content: [{ type: "text", text: JSON.stringify(data) }]
        };
    } catch (error) {
        console.error(`[API Handler] Execution Failed:`, error.message);
        return {
            content: [{ type: "text", text: `Error calling API: ${error.message}` }],
            isError: true
        };
    }
}
