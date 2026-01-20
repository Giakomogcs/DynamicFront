/**
 * Canvas Service
 * CRUD operations for canvases with version control
 */

import type { Canvas, CanvasVersion, ApiResponse } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * Create a new canvas
 */
export async function createCanvas(data: {
  sessionId: string;
  name: string;
  htmlContent?: string;
  cssContent?: string;
  jsContent?: string;
}): Promise<ApiResponse<Canvas>> {
  try {
    const response = await fetch(`${API_BASE}/api/canvases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        htmlContent: data.htmlContent || '',
        cssContent: data.cssContent || '',
        jsContent: data.jsContent || '',
        version: 1,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versions: [],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to create canvas');
    }

    const canvas = await response.json();

    return {
      success: true,
      data: canvas,
    };
  } catch (error) {
    console.error('Error creating canvas:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update a canvas
 */
export async function updateCanvas(
  id: string,
  updates: Partial<Canvas>,
  createVersion: boolean = false
): Promise<ApiResponse<Canvas>> {
  try {
    const url = createVersion
      ? `${API_BASE}/api/canvases/${id}?createVersion=true`
      : `${API_BASE}/api/canvases/${id}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...updates,
        updatedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update canvas');
    }

    const canvas = await response.json();

    return {
      success: true,
      data: canvas,
    };
  } catch (error) {
    console.error('Error updating canvas:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a canvas by ID
 */
export async function getCanvas(id: string): Promise<ApiResponse<Canvas>> {
  try {
    const response = await fetch(`${API_BASE}/api/canvases/${id}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Canvas not found');
      }
      throw new Error('Failed to fetch canvas');
    }

    const canvas = await response.json();

    return {
      success: true,
      data: canvas,
    };
  } catch (error) {
    console.error('Error fetching canvas:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all versions of a canvas
 */
export async function getVersions(canvasId: string): Promise<ApiResponse<CanvasVersion[]>> {
  try {
    const response = await fetch(`${API_BASE}/api/canvases/${canvasId}/versions`);

    if (!response.ok) {
      throw new Error('Failed to fetch versions');
    }

    const versions = await response.json();

    return {
      success: true,
      data: versions,
    };
  } catch (error) {
    console.error('Error fetching versions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [],
    };
  }
}

/**
 * Revert canvas to a specific version
 */
export async function revertToVersion(
  canvasId: string,
  versionId: string
): Promise<ApiResponse<Canvas>> {
  try {
    const response = await fetch(
      `${API_BASE}/api/canvases/${canvasId}/versions/${versionId}/revert`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to revert to version');
    }

    const canvas = await response.json();

    return {
      success: true,
      data: canvas,
    };
  } catch (error) {
    console.error('Error reverting version:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Publish a canvas version
 */
export async function publishVersion(
  canvasId: string,
  versionId: string
): Promise<ApiResponse<CanvasVersion>> {
  try {
    const response = await fetch(
      `${API_BASE}/api/canvases/${canvasId}/versions/${versionId}/publish`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to publish version');
    }

    const version = await response.json();

    return {
      success: true,
      data: version,
    };
  } catch (error) {
    console.error('Error publishing version:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a canvas
 */
export async function deleteCanvas(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE}/api/canvases/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete canvas');
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error deleting canvas:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
