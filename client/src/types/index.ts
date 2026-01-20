/**
 * Core Domain Types for DynamicFront v2.0
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'admin' | 'user' | 'viewer';
  avatar?: string;
  createdAt?: Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChangeLog {
  type: 'html' | 'css' | 'js';
  description: string;
  timestamp: Date;
}

export interface CanvasVersion {
  id: string;
  canvasId: string;
  versionNumber: number;
  htmlContent: string;
  cssContent: string;
  jsContent: string;
  changeLog: ChangeLog[];
  changeDescription: string;
  createdAt: Date;
  createdBy: string;
  isPublished: boolean;
}

export interface Canvas {
  id: string;
  sessionId: string;
  name: string;
  htmlContent: string;
  cssContent: string;
  jsContent: string;
  version: number;
  versionId: string;
  status: 'draft' | 'active' | 'archived';
  versions: CanvasVersion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  name: string;
  description?: string;
  canvases: Canvas[];
  messages: Message[];
  currentCanvasId?: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
