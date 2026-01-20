/**
 * User Manager Configuration
 * Placeholder values until real credentials are provided
 */

export const USER_MANAGER_CONFIG = {
  baseUrl: import.meta.env.VITE_RESOURCE_BASE_URL || 'http://localhost:3000',
  endpoints: {
    listUsers: '/user-manager/users',
    getUser: (id: string) => `/user-manager/users/${id}`,
    validateToken: '/user-manager/validate',
    health: '/user-manager/health',
  },
  auth: {
    bearerToken: import.meta.env.VITE_USER_MANAGER_TOKEN || '',
    apiKey: import.meta.env.VITE_RESOURCE_API_KEY || '',
  },
  cache: {
    ttlSeconds: 300, // 5 minutes
  },
};

/**
 * Fallback users when User Manager is unavailable
 * These will be used until real User Manager credentials are provided
 */
export const KNOWN_USERS = [
  {
    id: 'user_admin',
    email: 'admin@dynamicfront.com',
    name: 'Admin User',
    role: 'admin' as const,
  },
  {
    id: 'user_dev',
    email: 'dev@dynamicfront.com',
    name: 'Developer',
    role: 'user' as const,
  },
];

/**
 * Check if User Manager is configured
 */
export function isUserManagerConfigured(): boolean {
  return !!(USER_MANAGER_CONFIG.auth.bearerToken && USER_MANAGER_CONFIG.baseUrl);
}
