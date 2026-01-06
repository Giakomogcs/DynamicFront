import { geminiManager } from '../config/gemini.js';

// No manual init - usage is inside function via manager

/**
 * Fetches content from a URL (naive implementation).
 * Ideally uses a headless browser or specialized scraper for complex sites.
 */
async function fetchDocsContent(url, auth = null) {
  try {
    const options = {};
    if (auth && auth.type === 'basic') {
      const creds = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      options.headers = { 'Authorization': `Basic ${creds}` };
    }

    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Failed to fetch docs: ${response.statusText}`);
    const contentType = response.headers.get("content-type");

    let text = "";
    if (contentType && contentType.includes("json")) {
      const json = await response.json();
      text = JSON.stringify(json, null, 2);
    } else {
      text = await response.text();
      // Basic HTML cleanup to save context window (very naive)
      text = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    }
    return text.substring(0, 100000); // Limit context
  } catch (e) {
    throw new Error(`Could not fetch documentation: ${e.message}`);
  }
}

/**
 * Generates what the User calls "MCP Tool Config" from raw text.
 */
export async function generateApiToolsFromDocs(name, url, authConfigString) {
  let authConfig = {};
  try { authConfig = JSON.parse(authConfigString); } catch { }

  const docsAuth = authConfig.docs || null;
  const docsContent = await fetchDocsContent(url, docsAuth);

  const prompt = `
    You are an expert API Developer. Your task is to analyze the following API Documentation (which might be raw HTML, Markdown, or JSON) and extract the available endpoints to create a "Tool Configuration" for an MCP Server.
    
    API Name: ${name}
    Docs URL: ${url}
    Provided Auth Config (Use this to fill 'auth' fields): ${authConfigString}

    --- DOCUMENTATION CONTENT START ---
    ${docsContent}
    --- DOCUMENTATION CONTENT END ---

    **REQUIREMENTS:**
    1. Identify the most useful GET/POST endpoints.
    2. Create a JSON structure following EXACTLY this schema:
    {
      "serverInfo": {
        "name": "${name.toLowerCase().replace(/\s/g, '-')}",
        "version": "1.0.0"
      },
      "tools": [
        {
          "name": "snake_case_tool_name",
          "description": "Clear description of what it does",
          "inputSchema": {
            "type": "object",
            "properties": {
              "param_name": { "type": "string|number|boolean", "description": "...", "default": "optional_default" },
              "_headers": { "type": "object", "description": "Optional: Custom headers (e.g. { 'Authorization': 'Bearer <token>' })", "nullable": true },
              "_authProfile": { "type": "string", "description": "Optional: Auth profile to use (e.g. 'admin', 'viewer')", "nullable": true }
            },
            "required": ["param_name"]
          },
          "apiConfig": {
            "baseUrl": "The base domain (e.g. https://api.example.com)",
            "path": "/specific/path/or/{template}",
            "method": "GET|POST",
            "paramLocation": "query|path|body",
            "auth": {
               "type": "apiKey|bearer|basic|none", 
               "paramName": "if apiKey, the query param or header name", 
               "envVar": "API_KEY"
            }
          }
        }
      ]
    }

    3. If authentication is required but not clear, assume standard patterns (e.g. Bearer header or api_key query param) based on the provided Auth Config.
    4. ALWAYS add "_headers" as an optional object parameter to every tool.
    5. Return ONLY valid JSON. No markdown fencing.
    `;

  const result = await geminiManager.generateContentWithFailover(prompt);
  const response = await result.response;
  let text = response.text();

  // Cleanup markdown if Gemini adds it
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse LLM generated JSON", text);
    throw new Error("LLM generated invalid JSON for tools.");
  }
}
