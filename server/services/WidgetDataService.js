import { toolService } from './toolService.js';
import { resourceEnricher } from '../src/core/ResourceEnricher.js';

export class WidgetDataService {

    /**
     * Executes the data gathering logic for a widget.
     * @param {string} widgetId - ID of the widget (to look up config)
     * @param {object} overrideParams - Optional params from UI (e.g. filters)
     */
    async getWidgetData(widgetId, overrideParams = {}) {
        // TBD: Fetch widget from DB to get 'dataSource' config
        // For now, accepting direct config for testing
        // const widget = await prisma.widget.findUnique(...)
        return { error: "Not implemented: DB lookup" };
    }

    /**
     * Direct Proxy Execution (for testing & Phase 1)
     * @param {string} toolName 
     * @param {object} params 
     */
    async executeProxy(toolName, params) {
        console.log(`[WidgetDataProxy] Executing ${toolName}...`);

        // 1. Intelligent Auth Injection (Simulated Planner Logic)
        // Check if params need auth
        if (!params.email || !params.password) {
            const profiles = await resourceEnricher.loadProfiles();
            // Simple logic: prefer Admin, then User
            const admin = profiles.find(p => p.role === 'Admin');
            if (admin && admin.credentials) {
                params.email = admin.credentials.email;
                params.password = admin.credentials.password;
                // params._authProfile = admin.id; // Helper for some tools
                console.log(`[WidgetDataProxy] Injected Admin Credentials (${admin.label})`);
            }
        }

        // 2. Execute
        const result = await toolService.executeTool(toolName, params);

        // 3. Parse JSON content if possible
        if (result.content && result.content[0] && result.content[0].text) {
            try {
                const data = JSON.parse(result.content[0].text);
                return { data };
            } catch (e) {
                // Return raw text if not JSON
                return { data: result.content[0].text, raw: true };
            }
        }

        return result;
    }
}

export const widgetDataService = new WidgetDataService();
