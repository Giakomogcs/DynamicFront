/**
 * Resource Enricher
 * Analyzes raw MCP tools to generate high-level "Resource Profiles" and Knowledge Graphs.
 * NOW BACKED BY POSTGRESQL (Prisma).
 */
import prisma from '../registry.js';
import { log } from '../utils/logger.js';
import {
    ProfileNotFoundError,
    ProfileMismatchError,
    NoProfilesAvailableError
} from '../errors/AuthErrors.js';

export class ResourceEnricher {
    constructor() {
        this.resources = new Map();
        this.authRegistry = {};
        // loadProfiles() must be called explicitly and awaited at startup
    }

    /**
     * Loads all Auth Profiles from DB into memory cache
     */
    async loadProfiles() {
        try {
            log.info('Loading profiles from database', { component: 'ResourceEnricher' });
            const resources = await prisma.resource.findMany({
                include: { authProfiles: true }
            });

            this.authRegistry = {};

            for (const res of resources) {
                if (res.authProfiles && res.authProfiles.length > 0) {
                    // Map by Resource Name (e.g. 'schools_db')
                    this.authRegistry[res.name] = res.authProfiles.map(p => ({
                        ...p,
                        // Prisma Json is already object, but handle edge case
                        credentials: typeof p.credentials === 'string' ? JSON.parse(p.credentials) : p.credentials
                    }));
                }
            }

            // Map "default_registry" (DB name) to "default" (Code name)
            if (this.authRegistry['default_registry']) {
                this.authRegistry['default'] = this.authRegistry['default_registry'];
            }

            log.auth.profileLoaded('all', resources.length);
            log.debug(`Loaded profiles for ${resources.length} resources`, {
                component: 'ResourceEnricher',
                resourceCount: resources.length
            });
        } catch (e) {
            log.error('Failed to load profiles from database', {
                component: 'ResourceEnricher',
                error: e.message,
                stack: e.stack
            });
            // Non-fatal? System continues without profiles.
            this.authRegistry = {};
        }
    }

    getAllProfiles() {
        const all = [];
        const seen = new Set();
        // authRegistry is object { resourceId: [profiles] }
        if (this.authRegistry) {
            for (const list of Object.values(this.authRegistry)) {
                if (Array.isArray(list)) {
                    for (const p of list) {
                        if (p && p.id && !seen.has(p.id)) {
                            seen.add(p.id);
                            all.push(p);
                        }
                    }
                }
            }
        }
        return all;
    }

    /**
     * Get profiles for SPECIFIC resource only (no fallback)
     * @param {string} resourceId - Resource identifier (UUID or shortened prefix)
     * @returns {Array} Array of profiles for this resource (empty if none)
     */
    getProfiles(resourceId) {
        log.debug(`Getting profiles for resource`, {
            component: 'ResourceEnricher',
            resourceId
        });

        let profiles = this.authRegistry[resourceId] || [];

        // FALLBACK: Handle shortened IDs (8 chars) from McpClient tool naming
        if (profiles.length === 0 && resourceId.length === 8) {
            const fullId = Object.keys(this.authRegistry).find(k => k.startsWith(resourceId));
            if (fullId) {
                log.debug(`Matched shortened ID ${resourceId} to full ID ${fullId}`, { component: 'ResourceEnricher' });
                profiles = this.authRegistry[fullId] || [];
            }
        }

        if (profiles.length === 0) {
            log.auth.noProfilesAvailable(resourceId);
        } else {
            log.debug(`Found profiles for resource`, {
                component: 'ResourceEnricher',
                resourceId,
                profileCount: profiles.length
            });
        }

        return profiles;
    }

    /**
     * NOVO: Valida que perfil pertence ao resource específico
     * @param {string} profileId - Profile UUID
     * @param {string} resourceId - Expected resource identifier
     * @throws {ProfileNotFoundError} Se perfil não existe
     * @throws {ProfileMismatchError} Se perfil pertence a outro resource
     * @returns {Promise<Object>} Profile object if valid
     */
    async validateProfileBelongsToResource(profileId, resourceId) {
        const profile = await prisma.authProfile.findUnique({
            where: { id: profileId },
            include: { resource: true }
        });

        if (!profile) {
            throw new ProfileNotFoundError(resourceId, profileId);
        }

        if (profile.resource.name !== resourceId) {
            throw new ProfileMismatchError(
                profileId,
                resourceId,
                profile.resource.name
            );
        }

        log.auth.validationSuccess(profile.id, resourceId);
        log.debug('Profile validated successfully', {
            component: 'ResourceEnricher',
            profileLabel: profile.label,
            resourceId
        });

        return profile;
    }

    /**
     * NOVO: Obter profile ou falhar explicitamente
     * @param {string} resourceId - Resource identifier
     * @param {string|null} preferredRole - Optional preferred role
     * @throws {NoProfilesAvailableError} Se não houver perfis
     * @returns {Object} Selected profile
     */
    getProfileOrFail(resourceId, preferredRole = null) {
        const profiles = this.getProfiles(resourceId);

        if (profiles.length === 0) {
            throw new NoProfilesAvailableError(resourceId);
        }

        // Se há role preferencial, tentar encontrar
        if (preferredRole) {
            const match = profiles.find(p => p.role === preferredRole);
            if (match) {
                log.auth.profileSelected(match.id, resourceId, match.label);
                log.debug('Selected profile with preferred role', {
                    component: 'ResourceEnricher',
                    profileLabel: match.label,
                    role: match.role,
                    resourceId
                });
                return match;
            }
        }

        // Retornar primeiro disponível
        const selected = profiles[0];
        log.auth.profileSelected(selected.id, resourceId, selected.label);
        log.debug('Selected first available profile', {
            component: 'ResourceEnricher',
            profileLabel: selected.label,
            role: selected.role,
            resourceId
        });
        return selected;
    }

    async addProfile(resourceId, profile) {
        // 1. Find or Create Resource
        // We assume resource exists in DB if we are adding profile to it?
        // Or we might need to create it.
        // resourceId in argument is typically the Name (e.g. schools_db).

        let resource = await prisma.resource.findUnique({ where: { name: resourceId } });
        if (!resource) {
            // Create on fly?
            resource = await prisma.resource.create({
                data: {
                    name: resourceId,
                    type: 'API' // Default
                }
            });
        }

        // 2. Check if Profile already exists
        const existingProfile = await prisma.authProfile.findFirst({
            where: {
                resourceId: resource.id,
                label: profile.label || 'New Profile',
                role: profile.role || 'user'
            }
        });

        let savedProfile;
        if (existingProfile) {
            log.info('Updating existing profile', { component: 'ResourceEnricher', profileId: existingProfile.id });
            savedProfile = await prisma.authProfile.update({
                where: { id: existingProfile.id },
                data: {
                    credentials: profile.credentials || {}
                }
            });
        } else {
            savedProfile = await prisma.authProfile.create({
                data: {
                    resourceId: resource.id,
                    label: profile.label || 'New Profile',
                    role: profile.role || 'user',
                    credentials: profile.credentials || {}
                }
            });
        }

        // 3. Update Cache
        await this.loadProfiles();
        this._updateRuntimeResource(resourceId);

        return savedProfile;
    }

    async updateProfile(resourceId, profileId, updates) {
        try {
            // update in DB
            const updated = await prisma.authProfile.update({
                where: { id: profileId },
                data: {
                    label: updates.label,
                    role: updates.role,
                    credentials: updates.credentials
                }
            });

            // Update Cache
            await this.loadProfiles();
            this._updateRuntimeResource(resourceId);
            return updated;
        } catch (e) {
            console.error("Failed to update profile:", e);
            return null;
        }
    }

    async removeProfile(resourceId, profileId) {
        try {
            await prisma.authProfile.delete({ where: { id: profileId } });
            await this.loadProfiles();
            this._updateRuntimeResource(resourceId);
        } catch (e) {
            console.error("Failed to remove profile:", e);
        }
    }

    _updateRuntimeResource(resourceId) {
        if (this.resources.has(resourceId)) {
            const res = this.resources.get(resourceId);
            res.authProfiles = this.getProfiles(resourceId);
        }
    }

    /**
     * Analyzes a list of tools and groups them into Resources with capabilities.
     * @param {Array} tools - List of MCP tools
     * @returns {Object} { resources: Map<string, ResourceProfile>, summary: string }
     */
    analyzeTools(tools) {
        if (!tools || tools.length === 0) return { resources: new Map(), summary: "No resources connected." };

        // Clear and Rebuild
        this.resources.clear();

        tools.forEach(tool => {
            // 1. Identify Resource Name
            let resourceName = "Default";
            if (tool.name.includes('__')) {
                const parts = tool.name.split('__');
                resourceName = parts[0].replace('api_', '').replace('db_', '');
            }

            if (!this.resources.has(resourceName)) {
                this.resources.set(resourceName, {
                    id: resourceName,
                    name: resourceName,
                    tools: [],
                    domains: new Set(),
                    entities: new Set(),
                    capabilities: new Set(),
                    authRequired: false,
                    authProfiles: this.getProfiles(resourceName)
                });
            }

            const profile = this.resources.get(resourceName);
            profile.tools.push(tool);

            // 2. Deep Analysis
            this._analyzeTool(tool, profile);
        });

        // 3. Generate Rich Summary
        const summary = this._generateSummary(this.resources);

        return { resources: this.resources, summary };
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

        // --- 3. AUTH ROLE HINTING ---
        // Add a hint to the tool description about who should use it
        let recommendedRole = null;

        // Priority 1: Unit Specific Actions (Response, Unit Dashboard)
        if (name.includes('dashboardunit') || name.includes('myunit') || name.includes('responserequest')) {
            recommendedRole = 'SENAI User (Unit)';
        }
        // Priority 2: Admin Actions (Global Dashboard)
        else if (name.includes('dashboard') || name.includes('admin')) {
            recommendedRole = 'SENAI Admin';
        }
        // Priority 3: Company Actions (Create Request, Enterprise Data)
        else if (name.includes('enterprise') || name.includes('createrequest') || name.includes('company')) {
            recommendedRole = 'Company (CNPJ)';
        }

        if (recommendedRole && tool.description) {
            tool.description += ` [🔐 Auth: ${recommendedRole}]`;
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

            // Show Auth Profiles in Summary (so the UI/User knows they exist)
            if (profile.authProfiles && profile.authProfiles.length > 0) {
                const users = profile.authProfiles.map(u => `👤 ${u.label} (${u.role})`).join(', ');
                lines.push(`   - **Available Users**: ${users}`);
            }

            if (domains) lines.push(`   - **Key Domains**: ${domains}`);
            if (entities) lines.push(`   - **Entities Managed**: ${entities}`);

            lines.push(''); // spacing
        });

        lines.push("**💡 PRO TIP**: You can ask for \"Dashboard visualizations\", \"Course recommendations\", or \"Unit locations\".");

        return lines.join('\\n');
    }
}

export const resourceEnricher = new ResourceEnricher();
