import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

try {
    const content = fs.readFileSync('./tool_output_sp_debug.json', 'utf8');

    // Try to find the JSON array/object strictly
    let jsonStr = "";

    // Strategy 1: Look for explicit markers
    const startMarker = '----- RESULT START -----';
    const endMarker = '----- RESULT END -----';
    const startIdx = content.indexOf(startMarker);
    const endIdx = content.indexOf(endMarker);

    if (startIdx > -1 && endIdx > -1) {
        // Extract content between markers
        let candidate = content.substring(startIdx + startMarker.length, endIdx).trim();
        // If it looks like log output, try to find the start of JSON
        const firstBrace = candidate.indexOf('{');
        const firstBracket = candidate.indexOf('[');
        let jsonStart = -1;

        if (firstBrace > -1 && (firstBracket === -1 || firstBrace < firstBracket)) jsonStart = firstBrace;
        else if (firstBracket > -1) jsonStart = firstBracket;

        if (jsonStart > -1) {
            jsonStr = candidate.substring(jsonStart);
        } else {
            jsonStr = candidate;
        }
    } else {
        // Fallback: simple search for first [ or {
        const firstBrace = content.indexOf('{');
        const firstBracket = content.indexOf('[');
        let jsonStart = -1;

        if (firstBrace > -1 && (firstBracket === -1 || firstBrace < firstBracket)) jsonStart = firstBrace;
        else if (firstBracket > -1) jsonStart = firstBracket;

        if (jsonStart > -1) jsonStr = content.substring(jsonStart);
    }

    // Clean up any trailing non-json garbage if possible (basic heuristic)
    // For now trust parse will fail if bad
    console.log("Snippet to parse:", jsonStr.substring(0, 50));

    const data = JSON.parse(jsonStr);

    console.log("Type:", Array.isArray(data) ? "Array" : typeof data);

    let items = Array.isArray(data) ? data : (data.results || data.data || []);

    if (!Array.isArray(items)) {
        // Maybe it's a single object?
        items = [data];
    }

    console.log("Count:", items.length);

    if (items.length > 0) {
        console.log("Sample Keys:", Object.keys(items[0]));

        // check specific state keys
        const hasState = items.some(i => i.uf || i.state || i.estado || i.sg_uf);
        console.log("Has State Data?", hasState);

        if (hasState) {
            console.log("First 3 States:", items.slice(0, 3).map(i => i.uf || i.state || i.estado || i.sg_uf));
        }
    }

} catch (e) {
    console.error("Error analyzing:", e.message);
}
