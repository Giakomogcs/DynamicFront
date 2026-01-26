import prisma from '../registry.js';
import { validateApiSpec } from './api.js';
import { validateDbConnection } from './db.js';
import { generateApiToolsFromDocs } from './api_generator.js';
import { resourceEnricher } from '../core/ResourceEnricher.js'; // Added import

export const registerTools = [
    {
        name: "register_api",
        description: "Register a new API. Can provide OpenAPI Spec URL OR generic Documentation URL (which will be parsed by AI).",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "A friendly name for the API (e.g. 'Petstore')" },
                specUrl: { type: "string", description: "URL to the OpenAPI JSON/YAML OR Documentation Page" },
                baseUrl: { type: "string", description: "Optional Base URL override" },
                authConfig: { type: "string", description: "JSON string for auth. Supports simple legacy format OR advanced format: { \"docs\": { \"username\": \"...\", \"password\": \"...\" }, \"api\": { \"default\": {...}, \"profiles\": { \"admin\": {...} } } }" }
            },
            required: ["name", "specUrl"]
        }
    },
    {
        name: "register_db",
        description: "Register a new Database.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "A friendly name for the DB" },
                type: { type: "string", description: "Database type (postgres, mysql)", enum: ['postgres', 'mysql'] },
                connectionString: { type: "string", description: "Connection string" }
            },
            required: ["name", "connectionString", "type"]
        }
    }
];

import { testConnection } from './test_connection.js';

export async function processApiRegistration(name, specUrl, baseUrl, authConfigString, docsContent, clientAuthData = null) {
    let toolConfigString = null;
    let authConfig = {};
    try {
        authConfig = JSON.parse(authConfigString || "{}");
        console.log(`[Register] Auth Config Keys: ${Object.keys(authConfig).join(', ')}`);
        if (authConfig.docs) console.log(`[Register] Docs Auth Keys: ${Object.keys(authConfig.docs).join(', ')}`);
    } catch { }

    // Extract docs auth profile if it exists (for 401 Spec URLs)
    const docsAuth = authConfig.docs || null;
    let effectiveBaseUrl = baseUrl;

    try {
        if (!docsContent) {
            // 1. Try Standard OpenAPI Parsing (If no raw docs provided)
            console.log(`[Register] Attempting standard OpenAPI validation for: ${specUrl}`);
            const spec = await validateApiSpec(specUrl, docsAuth);
            console.log(`[Register] OpenAPI validation successful.`);

            // Extract Base URL from spec if not provided
            if (!effectiveBaseUrl) {
                if (spec.servers && spec.servers.length > 0) {
                    effectiveBaseUrl = spec.servers[0].url;
                } else if (spec.host) {
                    const scheme = (spec.schemes && spec.schemes.length > 0) ? spec.schemes[0] : 'https';
                    effectiveBaseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
                }
            }
        } else {
            console.log(`[Register] Raw docs content provided. Skipping URL validation.`);
            throw new Error("Skip to LLM");
        }
    } catch (openApiError) {
        // 2. Fallback: LLM Generation from Docs (or Raw Content)
        console.log(`[Register] OpenAPI validation failed or skipped. Attempting LLM extraction...`);
        try {
            let generatedConfig;
            if (docsContent) {
                // Mock the 'url' arg as 'Raw Text' for the generator
                generatedConfig = await generateApiToolsFromDocs(name, "RAW_TEXT_INPUT", authConfigString || "{}", docsContent);
            } else {
                generatedConfig = await generateApiToolsFromDocs(name, specUrl, authConfigString || "{}");
            }

            // Extract Base URL from generated tools if not provided
            if (!effectiveBaseUrl && generatedConfig.tools && generatedConfig.tools.length > 0) {
                const candidate = generatedConfig.tools.find(t => t.apiConfig && t.apiConfig.baseUrl);
                if (candidate) effectiveBaseUrl = candidate.apiConfig.baseUrl;
            }

            toolConfigString = JSON.stringify(generatedConfig);
            console.log(`[Register] LLM generation successful. Config length: ${toolConfigString.length}`);
        } catch (llmError) {
            console.error(`[Register] LLM generation failed: ${llmError.message}`);
            // If manual base URL is provided, we might still want to save the API even if tool generation fails? 
            // For now, fail hard to ensure quality.
            throw new Error(`Failed to register API. Not a valid OpenAPI spec, and LLM extraction failed: ${llmError.message}`);
        }
    }

    // --- CONNECTION TEST VERIFICATION ---
    let verificationAuthData = clientAuthData || null;
    if (effectiveBaseUrl && !verificationAuthData) {
        console.log(`[Register] Verifying connection to ${effectiveBaseUrl}...`);
        const testResult = await testConnection(effectiveBaseUrl, authConfig);
        if (!testResult.success) {
            const msg = testResult.results && testResult.results.length > 0
                ? testResult.results.map(r => `${r.profile}: ${r.message}`).join(', ')
                : testResult.message;

            throw new Error(`Connection Verification Failed: ${msg}`);
        }
        console.log(`[Register] Connection verified successfully.`);

        // Capture Auth Data from the first successful result if available
        if (testResult.results && testResult.results.length > 0) {
            const firstSuccess = testResult.results.find(r => r.success && r.authData);
            if (firstSuccess) verificationAuthData = firstSuccess.authData;
        }
    } else {
        console.warn(`[Register] Could not determine Base URL. Skipping connection test.`);
    }

    return {
        name,
        specUrl: specUrl || "RAW_TEXT",
        baseUrl: effectiveBaseUrl || baseUrl || "",
        authConfig: authConfigString || "{}",
        toolConfig: toolConfigString,
        authData: verificationAuthData
    };
}

export async function handleRegisterTool(name, args) {
    if (name === 'register_api') {
        try {
            const data = await processApiRegistration(args.name, args.specUrl, args.baseUrl, args.authConfig, args.docsContent, args.verificationAuthData);

            // Check if API already exists by specUrl or baseUrl
            let existingApi = null;
            if (data.specUrl && data.specUrl !== "RAW_TEXT") {
                existingApi = await prisma.verifiedApi.findFirst({ where: { specUrl: data.specUrl } });
            } else if (data.baseUrl) {
                existingApi = await prisma.verifiedApi.findFirst({ where: { baseUrl: data.baseUrl } });
            }

            let newApi;
            if (existingApi) {
                console.log(`[Register] Updating existing API: ${existingApi.name} (ID: ${existingApi.idString})`);
                newApi = await prisma.verifiedApi.update({
                    where: { idString: existingApi.idString },
                    data: {
                        name: data.name,
                        baseUrl: data.baseUrl,
                        authConfig: data.authConfig,
                        toolConfig: data.toolConfig
                    }
                });
            } else {
                newApi = await prisma.verifiedApi.create({
                    data: {
                        name: data.name,
                        specUrl: data.specUrl,
                        baseUrl: data.baseUrl,
                        authConfig: data.authConfig,
                        toolConfig: data.toolConfig
                    }
                });
            }

            // --- AUTO CREATE AUTH PROFILE ---
            if (data.authConfig) {
                try {
                    const parsed = JSON.parse(data.authConfig);
                    // Create a helper to get the actual auth object (handle nested { api: { default: ... } })
                    const auth = parsed.api?.default || parsed;

                    // Check if there's actual credentials to save
                    let hasCreds = false;
                    let label = "Initial User";
                    let role = "user";

                    // Try to extract from Auth Config
                    if (auth.username || auth.email) {
                        hasCreds = true;
                        label = auth.username || auth.email;
                    } else if (auth.loginParams && auth.loginParams.some(p => p.value)) {
                        hasCreds = true;
                        // Find email-like param
                        const emailParam = auth.loginParams.find(p => p.key.includes('email') || p.key.includes('user'));
                        if (emailParam) label = emailParam.value;
                    } else if (auth.token && auth.type === 'bearer') {
                        hasCreds = true;
                        label = "Bearer User";
                    }

                    // Enrich with AuthData from verification (REAL Role/Name)
                    if (data.authData) {
                        const ad = data.authData;
                        console.log(`[Register] Using Auth Data for Profile:`, JSON.stringify(ad));

                        if (ad.role || ad.type || (ad.user && ad.user.role)) {
                            role = ad.role || ad.type || ad.user.role;
                        }
                        if (ad.name || ad.username || (ad.user && ad.user.name)) {
                            label = ad.name || ad.username || ad.user.name;
                            // Append role nicely
                            if (role !== 'user') label += ` (${role})`;
                        }

                        // Sync Credentials from AuthData if available (e.g. detected CNPJ/Company)
                        if (ad.cnpj) auth.cnpj = ad.cnpj;
                        if (ad.companyId) auth.companyId = ad.companyId;

                        // If we have strong auth data (like a name/email/id), we effectively have crdentials/identity to save
                        if (ad.id || ad.email || ad.name) hasCreds = true;
                    }

                    if (hasCreds) {
                        console.log(`[Register] Auto-creating auth profile for ${newApi.name}...`);

                        // Check for duplicates (even though it's a new API, maybe the resource name existed or re-registering?)
                        // Usually new API = no profiles. But good practice.
                        const existingProfiles = resourceEnricher.getProfiles(newApi.idString);
                        const isDuplicate = existingProfiles.some(p => p.label === label);

                        if (!isDuplicate) {
                            // SANITIZE CREDENTIALS
                            // We don't want to save the entire config (urls, tokens paths) as "credentials"
                            let cleanCredentials = {};

                            if (auth.type === 'basic') {
                                if (auth.loginParams && Array.isArray(auth.loginParams)) {
                                    // Extract simple k/v pairs
                                    auth.loginParams.forEach(p => {
                                        if (p.key && p.value) cleanCredentials[p.key] = p.value;
                                    });
                                }
                            } else if (auth.type === 'bearer') {
                                cleanCredentials.token = auth.token;
                            } else if (auth.type === 'apiKey') {
                                cleanCredentials.apiKey = auth.apiKey.value; // Store value, maybe paramName too if needed
                                cleanCredentials.paramName = auth.apiKey.paramName;
                            } else {
                                // Default fallback (e.g. simple username/password basic)
                                if (auth.username) cleanCredentials.username = auth.username;
                                if (auth.password) cleanCredentials.password = auth.password;
                                // If nothing extracted but we have other properties, maybe keep them?
                                // Ideally we want to avoid saving nested objects like 'api' or 'docs'
                                if (Object.keys(cleanCredentials).length === 0) cleanCredentials = auth;
                            }

                            // Add enriched data if useful and simple
                            if (auth.cnpj) cleanCredentials.cnpj = auth.cnpj;
                            if (auth.companyId) cleanCredentials.companyId = auth.companyId;

                            await resourceEnricher.addProfile(newApi.idString, {
                                label,
                                role,
                                credentials: cleanCredentials
                            });
                        } else {
                            console.log(`[Register] Profile '${label}' already exists. Skipping auto-creation.`);
                        }
                    }
                } catch (profileErr) {
                    console.warn("[Register] Failed to auto-create profile (non-fatal):", profileErr);
                }
            }

            return {
                content: [{ type: "text", text: `Successfully registered API '${newApi.name}'. ${data.toolConfig ? "Tools were auto-generated from documentation." : "OpenAPI spec detected."}` }]
            };
        } catch (e) {
            return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
        }
    }

    if (name === 'register_db') {
        try {
            // Validate connection
            await validateDbConnection(args.connectionString);

            // Check if DB already exists
            const existingDb = await prisma.verifiedDb.findFirst({
                where: { connectionString: args.connectionString }
            });

            let newDb;
            if (existingDb) {
                console.log(`[Register] Updating existing DB: ${existingDb.name} (ID: ${existingDb.idString})`);
                newDb = await prisma.verifiedDb.update({
                    where: { idString: existingDb.idString },
                    data: {
                        name: args.name,
                        type: args.type
                    }
                });
            } else {
                newDb = await prisma.verifiedDb.create({
                    data: {
                        name: args.name,
                        connectionString: args.connectionString,
                        type: args.type
                    }
                });
            }
            return {
                content: [{ type: "text", text: `Successfully registered DB '${newDb.name}' (ID: ${newDb.idString}).` }]
            };
        } catch (e) {
            return { isError: true, content: [{ type: "text", text: `Failed to register DB: ${e.message}` }] };
        }
    }

    throw new Error(`Unknown registration tool: ${name}`);
}
