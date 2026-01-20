/**
 * User Manager Authentication Module
 * Handles communication with User Manager resource with caching
 */

import { USER_MANAGER_CONFIG, KNOWN_USERS, isUserManagerConfigured } from '../config/userManager';
import type { User } from '@/types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache
const cache = new Map<string, CacheEntry<any>>();

/**
 * Check if cache entry is still valid
 */
function isCacheValid(timestamp: number): boolean {
  const now = Date.now();
  const ttlMs = USER_MANAGER_CONFIG.cache.ttlSeconds * 1000;
  return now - timestamp < ttlMs;
}

/**
 * Get all valid users from User Manager
 * Falls back to KNOWN_USERS if User Manager is unavailable
 */
export async function getAllValidUsers(): Promise<User[]> {
  const cacheKey = 'all_users';
  const cached = cache.get(cacheKey);

  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  // If User Manager is not configured, use fallback
  if (!isUserManagerConfigured()) {
    console.warn('User Manager not configured, using KNOWN_USERS fallback');
    return KNOWN_USERS;
  }

  try {
    const response = await fetch(
      `${USER_MANAGER_CONFIG.baseUrl}${USER_MANAGER_CONFIG.endpoints.listUsers}`,
      {
        headers: {
          Authorization: `Bearer ${USER_MANAGER_CONFIG.auth.bearerToken}`,
          'X-API-Key': USER_MANAGER_CONFIG.auth.apiKey || '',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    const users = await response.json();
    cache.set(cacheKey, { data: users, timestamp: Date.now() });
    return users;
  } catch (error) {
    console.error('Failed to fetch users from User Manager:', error);
    // Fallback to known users on error
    return KNOWN_USERS;
  }
}

/**
 * Validate a specific user by ID
 * Returns null if user is not found or invalid
 */
export async function validateUser(userId: string): Promise<User | null> {
  const cacheKey = `user_${userId}`;
  const cached = cache.get(cacheKey);

  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  if (!isUserManagerConfigured()) {
    const knownUser = KNOWN_USERS.find(u => u.id === userId);
    return knownUser || null;
  }

  try {
    const response = await fetch(
      `${USER_MANAGER_CONFIG.baseUrl}${USER_MANAGER_CONFIG.endpoints.getUser(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${USER_MANAGER_CONFIG.auth.bearerToken}`,
        },
      }
    );

    if (!response.ok) return null;

    const user = await response.json();
    cache.set(cacheKey, { data: user, timestamp: Date.now() });
    return user;
  } catch (error) {
    console.error(`Failed to validate user ${userId}:`, error);
    return null;
  }
}

/**
 * Get default user (admin if available, otherwise first user)
 */
export async function getDefaultUser(): Promise<User> {
  const users = await getAllValidUsers();
  return users.find(u => u.role === 'admin') || users[0] || KNOWN_USERS[0];
}

/**
 * Get user by email address
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const users = await getAllValidUsers();
  return users.find(u => u.email === email) || null;
}

/**
 * Validate a bearer token and return associated user
 * This would typically call the User Manager's validate endpoint
 */
export async function validateToken(token: string): Promise<User | null> {
  if (!isUserManagerConfigured()) {
    // In fallback mode, any token returns default user
    return getDefaultUser();
  }

  try {
    const response = await fetch(
      `${USER_MANAGER_CONFIG.baseUrl}${USER_MANAGER_CONFIG.endpoints.validateToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Failed to validate token:', error);
    return null;
  }
}

/**
 * Clear all cached data
 * Useful when User Manager credentials are updated
 */
export function clearCache(): void {
  cache.clear();
  console.log('User Manager cache cleared');
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return {
    size: cache.size,
    entries: Array.from(cache.keys()),
  };
}
