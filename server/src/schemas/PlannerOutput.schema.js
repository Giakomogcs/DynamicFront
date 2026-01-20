import { z } from 'zod';

/**
 * Schema for authentication strategy selected by Planner
 */
export const AuthStrategySchema = z.object({
    profileId: z.string().uuid('Profile ID must be a valid UUID'),
    resourceId: z.string().min(1, 'Resource ID is required'),
    reason: z.string().optional(),
    role: z.string().optional()
});

/**
 * Schema for tool call in plan
 */
export const ToolCallSchema = z.object({
    name: z.string().min(1, 'Tool name is required'),
    params: z.record(z.any()).optional().default({})
});

/**
 * Complete schema for Planner output
 */
export const PlannerOutputSchema = z.object({
    tools: z.array(ToolCallSchema).min(1, 'At least one tool is required'),
    reasoning: z.string().optional(),
    auth_strategy: AuthStrategySchema.optional()
});
