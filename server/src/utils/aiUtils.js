/**
 * Robust JSON extraction from LLM responses.
 * Handles markdown backticks, preamble text, and common JSON formatting issues.
 */
export const aiUtils = {
    /**
     * Extracts a single JSON object from text.
     * @param {string} text 
     * @returns {Object|null}
     */
    extractJson(text) {
        if (!text || typeof text !== 'string') return null;
        
        try {
            // 1. Try to find JSON inside markdown blocks
            const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match) {
                const jsonStr = match[1].trim();
                return JSON.parse(jsonStr);
            }
            
            // 2. Try to find the first '{' and last '}'
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                const jsonStr = text.substring(start, end + 1);
                return JSON.parse(jsonStr);
            }
        } catch (e) {
            console.warn('[aiUtils] Failed to parse JSON:', e.message);
            return null;
        }
        
        return null;
    },

    /**
     * Extracts a JSON array from text.
     * @param {string} text 
     * @returns {Array|null}
     */
    extractJsonArray(text) {
        if (!text || typeof text !== 'string') return null;
        
        try {
            // 1. Try to find JSON inside markdown blocks
            const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match) {
                const jsonStr = match[1].trim();
                const parsed = JSON.parse(jsonStr);
                return Array.isArray(parsed) ? parsed : [parsed];
            }
            
            // 2. Try to find the first '[' and last ']'
            const start = text.indexOf('[');
            const end = text.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                const jsonStr = text.substring(start, end + 1);
                const parsed = JSON.parse(jsonStr);
                return Array.isArray(parsed) ? parsed : [parsed];
            }
        } catch (e) {
            console.warn('[aiUtils] Failed to parse JSON Array:', e.message);
            return null;
        }
        
        return null;
    }
};
