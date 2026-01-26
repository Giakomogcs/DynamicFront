import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AuthStrategyManager - Phase 1
 * Manages authentication profiles and selects appropriate credentials
 */
export class AuthStrategyManager {
    constructor() {
        this.AUTH_REGISTRY = this._loadAuthRegistry();
        this.tokenCache = new Map(); // profileId → {token, expiresAt}
    }

    /**
     * Loads authentication registry from JSON file
     * @returns {Array} - Auth profiles
     */
    _loadAuthRegistry() {
        try {
            const authPath = path.join(__dirname, '../../data/auth_profiles.json');
            const authProfiles = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
            return authProfiles.default || [];
        } catch (error) {
            console.warn('[AuthStrategy] Could not load auth_profiles.json:', error.message);
            return [];
        }
    }

    /**
     * Builds a map of tool patterns to required permissions
     * @private
     */
    _buildPermissionMap() {
        return {
            // School-related tools
            'school': {
                patterns: ['school', 'getschools', 'listschools'],
                requiredRole: ['admin', 'school_manager', 'analyst'],
                description: 'School data access'
            },
            // Enterprise-related tools
            'enterprise': {
                patterns: ['enterprise', 'company', 'getenterprise', 'listenterprise'],
                requiredRole: ['admin', 'enterprise_manager', 'analyst'],
                description: 'Enterprise data access'
            },
            // Course-related tools
            'course': {
                patterns: ['course', 'getcourses', 'searchcourses'],
                requiredRole: ['admin', 'school_manager', 'analyst', 'student'],
                description: 'Course information access'
            },
            // Sensitive data (contracts, financial)
            'sensitive': {
                patterns: ['contract', 'financial', 'payment', 'invoice'],
                requiredRole: ['admin', 'finance_manager'],
                description: 'Sensitive financial data'
            },
            // User management
            'user_management': {
                patterns: ['createuser', 'updateuser', 'deleteuser', 'manageuser'],
                requiredRole: ['admin'],
                description: 'User management operations'
            },
            // Public data (no auth required)
            'public': {
                patterns: ['public', 'catalog', 'search'],
                requiredRole: [],
                description: 'Public data access'
            }
        };
    }

    /**
     * Selects the best authentication profile for a tool
     * @param {string} toolName - Name of the tool to execute
     * @param {Array<string>} requiredPermissions - Optional explicit permissions
     * @returns {Object|null} - Selected auth profile or null if none suitable
     */
    async selectAuthForTool(toolName, requiredPermissions = []) {
        console.log(`[AuthStrategy] Selecting auth for tool: ${toolName}`);

        // Determine required role based on tool name
        const toolCategory = this._categorizeTool(toolName);
        const permissionInfo = this.permissionMap[toolCategory];

        if (!permissionInfo) {
            console.log(`[AuthStrategy] Tool category unknown: ${toolCategory}`);
            return null;
        }

        // If public tool, no auth needed
        if (toolCategory === 'public') {
            console.log('[AuthStrategy] Public tool, no auth required');
            return null;
        }

        console.log(`[AuthStrategy] Tool requires role: ${permissionInfo.requiredRole.join(' or ')}`);

        // Find suitable accounts in AUTH_REGISTRY
        const suitableAccounts = this._findSuitableAccounts(
            permissionInfo.requiredRole,
            requiredPermissions
        );

        if (suitableAccounts.length === 0) {
            console.warn(`[AuthStrategy] ❌ No account found with required permissions!`);
            console.warn(`[AuthStrategy] Required: ${permissionInfo.requiredRole.join(' or ')}`);
            console.warn(`[AuthStrategy] Available accounts: ${this.AUTH_REGISTRY.map(a => `${a.credentials?.email || a.label} (${a.role})`).join(', ')}`);
            return null;
        }

        // Select best account (highest priority)
        const selectedAccount = this._selectBestAccount(suitableAccounts, toolCategory);

        console.log(`[AuthStrategy] ✅ Selected account: ${selectedAccount.email} (${selectedAccount.role})`);

        return selectedAccount;
    }

    /**
     * Categorizes a tool based on its name
     * @private
     */
    _categorizeTool(toolName) {
        const lowerTool = toolName.toLowerCase();

        // Check each category
        for (const [category, info] of Object.entries(this.permissionMap)) {
            if (info.patterns.some(pattern => lowerTool.includes(pattern))) {
                return category;
            }
        }

        // Default to requiring some basic auth
        return 'public';
    }

    /**
     * Finds accounts with suitable roles
     * @private
     */
    _findSuitableAccounts(requiredRoles, additionalPermissions = []) {
        return this.AUTH_REGISTRY.filter(account => {
            // Check if account has one of the required roles
            const hasRequiredRole = requiredRoles.length === 0 ||
                requiredRoles.includes(account.role);

            // Check additional permissions if specified
            const hasAdditionalPermissions = additionalPermissions.length === 0 ||
                additionalPermissions.every(perm =>
                    account.permissions?.includes(perm)
                );

            return hasRequiredRole && hasAdditionalPermissions;
        });
    }

    /**
     * Selects the best account from suitable candidates
     * @private
     */
    _selectBestAccount(accounts, toolCategory) {
        // Priority order: admin > specific managers > analyst > student
        const rolePriority = {
            'admin': 100,
            'finance_manager': 90,
            'enterprise_manager': 85,
            'school_manager': 80,
            'analyst': 70,
            'student': 50
        };

        // Sort by priority
        accounts.sort((a, b) => {
            const priorityA = rolePriority[a.role] || 0;
            const priorityB = rolePriority[b.role] || 0;
            return priorityB - priorityA;
        });

        return accounts[0];
    }

    /**
     * Authenticates and executes a tool with the correct profile
     * @param {string} toolName - Tool to execute
     * @param {Object} params - Tool parameters
     * @param {Object} authProfile - Authentication profile to use
     * @param {Function} executeFunction - Function to execute the tool
     * @returns {Promise<Object>} - Tool execution result
     */
    async authenticateAndExecute(toolName, params, authProfile, executeFunction) {
        const email = authProfile.credentials?.email || authProfile.email;
        console.log(`[AuthStrategy] Authenticating as: ${email}`);

        try {
            // Check if we have a cached token
            let token = this.tokenCache.get(email);

            if (!token || this._isTokenExpired(token)) {
                // Authenticate to get fresh token
                console.log('[AuthStrategy] Token missing or expired, authenticating...');
                token = await this._authenticate(authProfile);
                this.tokenCache.set(email, token);
            }

            // Execute tool with authentication
            const result = await executeFunction(toolName, params, {
                token: token.access_token,
                user: email,
                role: authProfile.role
            });

            console.log(`[AuthStrategy] ✅ Tool executed successfully with ${email}`);
            return result;

        } catch (error) {
            // Handle authentication errors
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error(`[AuthStrategy] ❌ Authentication failed: ${error.message}`);

                // Clear cached token and retry once
                this.tokenCache.delete(email);

                if (!error._retried) {
                    console.log('[AuthStrategy] Retrying with fresh authentication...');
                    error._retried = true;
                    return this.authenticateAndExecute(toolName, params, authProfile, executeFunction);
                }

                throw new Error(`Authentication failed for ${email}: ${error.message}`);
            }

            throw error;
        }
    }

    /**
     * Performs authentication with a profile
     * @private
     */
    async _authenticate(authProfile) {
        const email = authProfile.credentials?.email || authProfile.email;
        console.log(`[AuthStrategy] Authenticating ${email}...`);

        // Import auth service dynamically to avoid circular dependencies
        const { authService } = await import('../services/authService.js');

        // Call the appropriate auth method based on profile type
        const result = await authService.authenticate({
            email: authProfile.credentials?.email || authProfile.email,
            password: authProfile.credentials?.password || authProfile.password,
            type: authProfile.type || 'default'
        });

        if (!result || !result.access_token) {
            throw new Error('Authentication returned no token');
        }

        return {
            access_token: result.access_token,
            expires_at: Date.now() + (result.expires_in || 3600) * 1000
        };
    }

    /**
     * Checks if a token is expired
     * @private
     */
    _isTokenExpired(token) {
        if (!token.expires_at) return true;
        return Date.now() >= token.expires_at - 60000; // 1 minute buffer
    }

    /**
     * Generates a helpful error message when no suitable auth is found
     * @param {string} toolName 
     * @param {Array<string>} requiredRoles 
     * @returns {string}
     */
    generateMissingAuthMessage(toolName, requiredRoles) {
        const availableAccounts = this.AUTH_REGISTRY.map(a =>
            `  - ${a.credentials?.email || a.label} (${a.role})`
        ).join('\n');

        return `❌ Nenhuma conta com permissões necessárias encontrada!

🔧 Tool: ${toolName}
🎭 Requer uma das roles: ${requiredRoles.join(' ou ')}

📋 Contas disponíveis:
${availableAccounts}

💡 Sugestão: Registre uma conta com as permissões necessárias no arquivo auth_profiles.json`;
    }

    /**
     * Clears all cached tokens
     */
    clearTokenCache() {
        console.log('[AuthStrategy] Clearing token cache');
        this.tokenCache.clear();
    }

    /**
     * Gets current auth status summary
     */
    getAuthStatus() {
        return {
            registeredAccounts: this.AUTH_REGISTRY.length,
            cachedTokens: this.tokenCache.size,
            accounts: this.AUTH_REGISTRY.map(a => ({
                email: a.credentials?.email || a.label,
                role: a.role,
                hasCachedToken: this.tokenCache.has(a.credentials?.email)
            }))
        };
    }
}

export const authStrategyManager = new AuthStrategyManager();
