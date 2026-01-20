import { describe, it, expect, beforeAll, vi } from 'vitest';
import { plannerAgent } from '../../agents/Planner.js';
import { resourceEnricher } from '../../src/core/ResourceEnricher.js';
import { ProfileMismatchError } from '../../src/errors/AuthErrors.js';

describe('Planner - Auth Integration', () => {
    beforeAll(async () => {
        // Load profiles from database
        await resourceEnricher.loadProfiles();
    });

    it('should extract resource IDs from tool names', () => {
        const tools = [
            { name: 'api_55552e89-e63d-4362-b061-1077b8289eef__dn_courses_search' },
            { name: 'api_55552e89-e63d-4362-b061-1077b8289eef__dn_auth_session' },
            { name: 'filesystem__read_file' }
        ];

        const resources = plannerAgent._extractResourcesFromTools(tools);

        expect(resources).toContain('55552e89-e63d-4362-b061-1077b8289eef');
        expect(resources).not.toContain('filesystem');
        expect(resources.length).toBe(1);
    });

    it('should validate plan with valid auth_strategy', async () => {
        // Get an actual profile from the database
        const profiles = resourceEnricher.getProfiles('55552e89-e63d-4362-b061-1077b8289eef');

        if (profiles.length === 0) {
            console.log('[TEST] Skipping: no profiles available for resource');
            return;
        }

        const testProfile = profiles[0];

        const planOutput = {
            tools: [
                { name: 'api_55552e89-e63d-4362-b061-1077b8289eef__dn_courses_search', params: {} }
            ],
            reasoning: 'Test reasoning',
            auth_strategy: {
                profileId: testProfile.id,
                resourceId: '55552e89-e63d-4362-b061-1077b8289eef',
                reason: 'Testing'
            }
        };

        const validated = await plannerAgent._validatePlan(planOutput);

        expect(validated).toBeDefined();
        expect(validated.auth_strategy.profileId).toBe(testProfile.id);
    });

    it('should reject plan with invalid profileId', async () => {
        const planOutput = {
            tools: [
                { name: 'test_tool', params: {} }
            ],
            auth_strategy: {
                profileId: 'invalid-uuid-format',
                resourceId: '55552e89-e63d-4362-b061-1077b8289eef'
            }
        };

        await expect(
            plannerAgent._validatePlan(planOutput)
        ).rejects.toThrow();
    });

    it('should reject plan with profile from wrong resource', async () => {
        // Get a profile from any resource
        const allProfiles = resourceEnricher.getAllProfiles();

        if (allProfiles.length === 0) {
            console.log('[TEST] Skipping: no profiles available');
            return;
        }

        const testProfile = allProfiles[0];

        const planOutput = {
            tools: [
                { name: 'test_tool', params: {} }
            ],
            auth_strategy: {
                profileId: testProfile.id,
                resourceId: 'wrong-resource-id'  // Wrong resource
            }
        };

        await expect(
            plannerAgent._validatePlan(planOutput)
        ).rejects.toThrow(ProfileMismatchError);
    });

    it('should accept plan without auth_strategy', async () => {
        const planOutput = {
            tools: [
                { name: 'test_tool', params: {} }
            ],
            reasoning: 'No auth needed'
        };

        const validated = await plannerAgent._validatePlan(planOutput);

        expect(validated).toBeDefined();
        expect(validated.auth_strategy).toBeUndefined();
    });

    it('should reject plan with empty tools array', async () => {
        const planOutput = {
            tools: [],
            reasoning: 'Invalid plan'
        };

        await expect(
            plannerAgent._validatePlan(planOutput)
        ).rejects.toThrow('At least one tool is required');
    });
});
