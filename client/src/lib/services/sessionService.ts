/**
 * Session Service
 * CRUD operations for sessions with proper error handling
 */

import type { Session, ApiResponse } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * Create a new session
 */
export async function createSession(data: {
  name: string;
  description?: string;
  ownerId: string;
}): Promise<ApiResponse<Session>> {
  try {
    const response = await fetch(`${API_BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
        canvases: [],
        messages: [],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to create session');
    }

    const session = await response.json();

    return {
      success: true,
      data: session,
    };
  } catch (error) {
    console.error('Error creating session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a session by ID
 */
export async function getSession(id: string): Promise<ApiResponse<Session>> {
  try {
    const response = await fetch(`${API_BASE}/api/sessions/${id}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Session not found');
      }
      throw new Error('Failed to fetch session');
    }

    const session = await response.json();

    return {
      success: true,
      data: session,
    };
  } catch (error) {
    console.error('Error fetching session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all sessions for current user
 */
export async function getSessions(userId?: string): Promise<ApiResponse<Session[]>> {
  try {
    const url = userId
      ? `${API_BASE}/api/sessions?userId=${userId}`
      : `${API_BASE}/api/sessions`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch sessions');
    }

    const sessions = await response.json();

    return {
      success: true,
      data: sessions,
    };
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [], // Return empty array on error
    };
  }
}

/**
 * Update a session
 */
export async function updateSession(
  id: string,
  updates: Partial<Session>
): Promise<ApiResponse<Session>> {
  try {
    const response = await fetch(`${API_BASE}/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...updates,
        updatedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update session');
    }

    const session = await response.json();

    return {
      success: true,
      data: session,
    };
  } catch (error) {
    console.error('Error updating session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a session
 */
export async function deleteSession(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE}/api/sessions/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete session');
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error deleting session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Archive a session (soft delete)
 */
export async function archiveSession(id: string): Promise<ApiResponse<Session>> {
  return updateSession(id, { status: 'archived' });
}
