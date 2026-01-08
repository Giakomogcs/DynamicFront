import { geminiManager } from '../config/gemini.js';

/**
 * Fetches content from a URL (helper copied from api_generator to avoid circular deps for now)
 */
// Helper to recursively prune heavy fields from JSON
function pruneJson(obj, depth = 0) {
    if (depth > 10) return undefined; // Increased limit from 5 to 10 to capture nested schemas
    if (Array.isArray(obj)) {
        return obj.map(i => pruneJson(i, depth + 1)).filter(i => i !== undefined);
    }
    if (typeof obj === 'object' && obj !== null) {
        const newObj = {};
        for (const k in obj) {
            // Strip heavy fields aggressively
            if (['example', 'examples', 'x-amazon-apigateway-integration', 'x-amazon-apigateway-request-validators'].includes(k)) continue;
            // Skip empty objects if not critical
            const val = pruneJson(obj[k], depth + 1);
            if (val !== undefined && val !== null) {
                newObj[k] = val;
            }
        }
        return newObj;
    }
    return obj;
}

// Helper: Extract Referenced Schemas
function extractRefs(obj, refs = new Set()) {
    if (!obj) return refs;
    const str = JSON.stringify(obj);
    const regex = /"\$ref":\s*"#\/components\/schemas\/([^"]+)"/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
        refs.add(match[1]); // Corrected index to 1 for the captured group
    }
    return refs;
}

// Helper: Optimize Docs (Pruning + Tree Shaking)
function optimizeDocs(json) {
    const simplified = {};

    // 1. Keep Info
    if (json.info) simplified.info = { title: json.info.title || 'API', version: json.info.version || '1.0.0' };

    // 2. Prepare Components (Security & Schemas)
    simplified.components = {};
    if (json.components && json.components.securitySchemes) {
        simplified.components.securitySchemes = json.components.securitySchemes;
    }
    if (json.securityDefinitions) simplified.securityDefinitions = json.securityDefinitions;

    // 3. Filter Paths
    const filteredPaths = {};
    if (json.paths) {
        const authKeywords = ['login', 'auth', 'token', 'session', 'sign-in', 'signin', 'oauth'];
        for (const [path, methods] of Object.entries(json.paths)) {
            const lowerPath = path.toLowerCase();
            if (authKeywords.some(k => lowerPath.includes(k))) {
                filteredPaths[path] = pruneJson(methods);
            }
        }
        // Fallback
        if (Object.keys(filteredPaths).length === 0) {
            let count = 0;
            for (const [path, methods] of Object.entries(json.paths)) {
                if (count > 5) break;
                if (methods.post) {
                    filteredPaths[path] = { post: pruneJson(methods.post) };
                    count++;
                }
            }
        }
    }

    // 4. Tree Shake Schemas
    if (json.components && json.components.schemas) {
        const usedRefs = extractRefs(filteredPaths);
        if (usedRefs.size > 0) {
            simplified.components.schemas = {};
            let refsToResolve = [...usedRefs];
            let resolvedRefs = new Set();
            let iterations = 0;

            while (refsToResolve.length > 0 && iterations < 3) {
                const nextBatch = [];
                for (const ref of refsToResolve) {
                    if (resolvedRefs.has(ref)) continue;
                    resolvedRefs.add(ref);

                    const schema = json.components.schemas[ref];
                    if (schema) {
                        simplified.components.schemas[ref] = pruneJson(schema);
                        const nested = extractRefs(schema);
                        for (const n of nested) {
                            if (!resolvedRefs.has(n)) nextBatch.push(n);
                        }
                    }
                }
                refsToResolve = nextBatch;
                iterations++;
            }
        }
    }

    // 5. Assign Paths
    simplified.paths = filteredPaths;

    let text = JSON.stringify(simplified);
    if (text.length < 50) {
        text = JSON.stringify(pruneJson(json)).substring(0, 15000);
    }
    return text;
}

async function fetchDocsContent(url, auth = null) {
    try {
        const options = {};
        if (auth && auth.type === 'basic' && auth.username && auth.password) {
            const creds = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            options.headers = { 'Authorization': `Basic ${creds}` };
        }

        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`Failed to fetch docs: ${response.statusText}`);
        const contentType = response.headers.get("content-type");

        let text = "";
        if (contentType && contentType.includes("json")) {
            const json = await response.json();
            text = optimizeDocs(json);
        } else {
            text = await response.text();
            try {
                const json = JSON.parse(text);
                text = optimizeDocs(json);
            } catch (e) {
                text = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
            }
        }
        return text.substring(0, 25000);
    } catch (e) {
        throw new Error(`Could not fetch documentation: ${e.message}`);
    }
}

/**
 * Analyzes documentation to determine Authentication Configuration.
 */
export async function analyzeAuthFromDocs(docsUrl, docsContent, docsAuth = null) {
    let content = docsContent;
    if (!content && docsUrl) {
        console.log(`[AuthAnalyzer] Fetching docs from ${docsUrl}`);
        content = await fetchDocsContent(docsUrl, docsAuth);
    } else if (content) {
        // Optimizing provided text content (copy-paste case)
        try {
            const json = JSON.parse(content);
            console.log(`[AuthAnalyzer] Optimizing provided JSON content...`);
            content = optimizeDocs(json);
        } catch (e) {
            console.log(`[AuthAnalyzer] Provided content is not JSON, treating as raw text.`);
            // clean up raw text if needed
            content = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").substring(0, 25000);
        }
    }

    if (!content) {
        throw new Error("No documentation content provided to analyze.");
    }

    const prompt = `
    You are an expert API Integration Specialist.
    Your task is to analyze the following API Documentation and extract the **AUTHENTICATION MECHANISM** and **USER PERMISSIONS/ROLES**.

    --- DOCUMENTATION START ---
    ${content.substring(0, 50000)}
    --- DOCUMENTATION END ---

    **OBJECTIVE:**
    1. Identify the authentication flow. Look for a "Login", "Session", or "Token" endpoint.
       - It might accept credentials and return a token (Bearer).
       - It might accept credentials and return a session cookie or a success structure (Session/Cookie based).
    2. Identify any User Roles, Groups, or Permissions mentioned (e.g., dynamic roles, static types like 'Admin', 'Student', 'Company').

    **OUTPUT JSON SCHEMA (Strict ID: auth-config-v3):**
    {
      "type": "basic | bearer | apiKey | session | none",
      "description": "Short explanation of the found auth method",
      "loginUrl": "/path/to/login (e.g. /api/auth/login, /api/auth/session, /oauth/token)",
      "tokenPath": "path.to.token.in.response (e.g. access_token) OR 'cookie' if session based",
      "loginParams": [
        {
          "key": "field_name_in_body (e.g. username, email, cpf, client_id)",
          "label": "Human readable label (e.g. CPF, Email)",
          "placeholder": "Example value or hint (e.g. 123.456.789-00)",
          "value": "", 
          "type": "text | password | hidden"
        }
      ],
      "paramName": "If type is apiKey, the name of the header or query param (e.g. 'X-API-Key', 'api_key')",
      "paramLocation": "If type is apiKey: 'header' | 'query'",
      "roles": [
        {
          "name": "Role Name (e.g. Admin)",
          "description": "Brief description of what this role can do"
        }
      ]
    }

    **RULES:**
    1. **Login/Session Endpoint**: If there is a POST endpoint to exchange credentials for a token, set "type" to "basic" (returns token) or "session" (cookie). Populate "loginParams".
    2. **API Key**: If the docs say "Include X-API-KEY header" or "pass api_key in query", set "type": "apiKey", and fill "paramName" (e.g. 'X-API-KEY') and "paramLocation" ('header' or 'query').
    3. **Bearer Token (Static)**: If it just says "Use Bearer token in Authorization header" requiring a manual token (no login endpoint), set "type": "bearer".
    4. **Smart Config**: If there are static fields (like 'grant_type'), set "type": "hidden" and "value" in loginParams.
    5. **Token Path**: Return ONLY the dot-notation path (e.g. "data.token", "access_token").
    6. **Roles**: Look for enums, descriptions of user types, or permission scopes.
    7. Return ONLY valid JSON.
    `;

    try {
        const result = await geminiManager.generateContentWithFailover(prompt);
        const responseText = await result.response.text();

        // Clean and Parse JSON
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1) {
            throw new Error("LLM did not return valid JSON");
        }

        const jsonStr = cleanJson.substring(firstBrace, lastBrace + 1);
        const config = JSON.parse(jsonStr);

        console.log("[AuthAnalyzer] AI Identified Config:", config);
        return config;

    } catch (e) {
        console.error("[AuthAnalyzer] Analysis Failed:", e);
        throw new Error(`Auth Analysis Failed: ${e.message}`);
    }
}
