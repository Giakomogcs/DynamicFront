/**
 * Resource Enricher
 * Analyzes raw MCP tools to generate high-level "Resource Profiles" and Knowledge Graphs.
 */
export class ResourceEnricher {

    /**
     * Analyzes a list of tools and groups them into Resources with capabilities.
     * @param {Array} tools - List of MCP tools
     * @returns {Object} { resources: Map<string, ResourceProfile>, summary: string }
     */
    analyzeTools(tools) {
        if (!tools || tools.length === 0) return { resources: new Map(), summary: "No resources connected." };

        const resources = new Map();

        tools.forEach(tool => {
            // 1. Identify Resource Name
            let resourceName = "Default";
            if (tool.name.includes('__')) {
                const parts = tool.name.split('__');
                resourceName = parts[0].replace('api_', '').replace('db_', '');
            }

            if (!resources.has(resourceName)) {
                resources.set(resourceName, {
                    id: resourceName,
                    name: resourceName,
                    tools: [],
                    domains: new Set(),     // e.g. "Education", "Enterprise", "BI"
                    entities: new Set(),    // e.g. "School", "Course", "User"
                    capabilities: new Set(),
                    authRequired: false
                });
            }

            const profile = resources.get(resourceName);
            profile.tools.push(tool);

            // 2. Deep Analysis
            this._analyzeTool(tool, profile);
        });

        // 3. Generate Rich Summary
        const summary = this._generateSummary(resources);

        return { resources, summary };
    }

    _analyzeTool(tool, profile) {
        const name = tool.name.toLowerCase();

        // --- 1. DOMAIN RECOGNITION (Business Context) ---
        if (name.includes('school') || name.includes('unit') || name.includes('senai')) {
            profile.domains.add('🏢 SENAI Units');
            profile.entities.add('Schools');
        }
        if (name.includes('course') || name.includes('training') || name.includes('class')) {
            profile.domains.add('📚 Education & Courses');
            profile.entities.add('Courses');
        }
        if (name.includes('company') || name.includes('enterprise') || name.includes('cnpj')) {
            profile.domains.add('🏭 Enterprise/Companies');
            profile.entities.add('Companies');
        }
        if (name.includes('dashboard') || name.includes('chart') || name.includes('kpi') || name.includes('analytics')) {
            profile.domains.add('📊 BI & Dashboards');
        }
        if (name.includes('request') || name.includes('solicitation') || name.includes('demand')) {
            profile.domains.add('📩 Service Requests');
        }
        if (name.includes('auth') || name.includes('login') || name.includes('session')) {
            profile.authRequired = true;
            profile.domains.add('🔐 Security');
        }

        // --- 2. CAPABILITY DETECTION ---
        if (name.includes('get') || name.includes('list') || name.includes('search') || name.includes('find')) {
            profile.capabilities.add('Read');
        }
        if (name.includes('create') || name.includes('add') || name.includes('send') || name.includes('upload')) {
            profile.capabilities.add('Write');
        }
        if (name.includes('delete') || name.includes('remove')) {
            profile.capabilities.add('Delete');
        }
    }

    _generateSummary(resources) {
        if (resources.size === 0) return "No resources available.";

        let lines = ["**🚀 CONNECTED RESOURCES & CAPABILITIES:**\n"];

        resources.forEach(profile => {
            const domains = Array.from(profile.domains).join(', ');
            const entities = Array.from(profile.entities).slice(0, 8).join(', ');

            lines.push(`### 📦 Resource: ${profile.name}`);
            if (profile.authRequired) lines.push(`   *⚠️ Authentication Required*`);

            if (domains) lines.push(`   - **Key Domains**: ${domains}`);
            if (entities) lines.push(`   - **Entities Managed**: ${entities}`);

            // lines.push(`   - **Total Tools**: ${profile.tools.length}`);
            lines.push(''); // spacing
        });

        lines.push("**💡 PRO TIP**: You can ask for \"Dashboard visualizations\", \"Course recommendations\", or \"Unit locations\".");

        return lines.join('\\n');
    }
}

export const resourceEnricher = new ResourceEnricher();
