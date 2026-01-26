export class HybridModelFilter {
    /**
     * @param {Object} config
     * @param {string[]} config.priority - List of model IDs to show at the top (in order)
     * @param {RegExp[]} config.discovery - List of Regex patterns to include dynamic models
     * @param {string[]} config.exclude - List of partial strings to exclude (case-insensitive)
     */
    constructor({ priority = [], discovery = [], exclude = [] }) {
        this.priority = priority;
        this.discovery = discovery.map(d => d instanceof RegExp ? d : new RegExp(d));
        this.exclude = exclude.map(e => e.toLowerCase());
    }

    /**
     * Filters and sorts a list of raw model objects.
     * @param {Array} models - Array of model objects (must have 'id' or 'name' property)
     * @param {Function} idExtractor - Function to extract ID from model object (default: m => m.id || m.name)
     * @returns {Array} - Sorted and filtered models
     */
    process(models, idExtractor = (m) => m.id || m.name) {
        if (!Array.isArray(models)) return [];

        const seen = new Set();
        const result = [];

        // Pre-process: Identify "clean" base models to help filter out dated versions
        // e.g. if we have "gpt-4o", mark it so we can maybe exclude "gpt-4o-2024-05-13"
        const baseIds = new Set(models.map(idExtractor));

        // Helper to check if a model is a dated version of an existing base
        const isDatedVersionOfExistingBase = (id) => {
            // Regex for common date patterns: -YYYY-MM-DD, -YYYYMMDD, -001, -002, -1212 etc.
            // Simplified: look for trailing -digits or -date
            const baseMatch = id.match(/^(.*)-(\d{4}-?\d{2}-?\d{2}|\d{3,}|\d{2}\d{2})$/);
            if (baseMatch) {
                const baseName = baseMatch[1];
                // If the base name exists in our list (e.g. "gpt-4o-2024..." -> "gpt-4o"), matches!
                if (baseIds.has(baseName)) return true;

                // Specific Check for Anthropic/Gemini variations if needed
                if (baseIds.has(baseName + '-latest')) return true;
            }

            // Deduplicate Previews/Experimental if stable exists
            // e.g. "gemini-2.0-flash-preview" should convert to "gemini-2.0-flash" check
            const previewMatch = id.match(/^(.*)-(preview|experimental|exp)(?:-.*)?$/);
            if (previewMatch) {
                const baseName = previewMatch[1];
                if (baseIds.has(baseName)) return true;
                if (baseIds.has(baseName + '-latest')) return true;
            }

            return false;
        };

        // 1. First pass: Add Priority models
        for (const pid of this.priority) {
            const found = models.find(m => idExtractor(m) === pid);
            if (found && !seen.has(pid)) {
                result.push(found);
                seen.add(pid);
            }
        }

        // 2. Second pass: Add Discovered models that match patterns
        for (const model of models) {
            const id = idExtractor(model);
            if (seen.has(id)) continue;

            const lowerId = id.toLowerCase();

            // Check Explicit Exclusions
            if (this.exclude.some(ex => lowerId.includes(ex))) continue;

            // Check Deduplication (Date/Version cleanup)
            if (isDatedVersionOfExistingBase(id)) {
                // Skip specific dated version if we have the clean alias
                // UNLESS it is explicitly in priority (handled in pass 1)
                continue;
            }

            // Check discovery patterns
            if (this.discovery.some(regex => regex.test(id))) {
                result.push(model);
                seen.add(id);
            }
        }

        return result;
    }
}
