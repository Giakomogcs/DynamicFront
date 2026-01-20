import { describe, it, expect, beforeAll } from 'vitest';
import { resourceEnricher } from '../../src/core/ResourceEnricher.js';
import { toolService } from '../../services/toolService.js';
import { NoProfilesAvailableError } from '../../src/errors/AuthErrors.js';

describe('E2E: Complete Auth Flow', () => {
    beforeAll(async () => {
        // Load profiles from database
        await resourceEnricher.loadProfiles();
    });

    it('should complete authentication flow with real tool', async () => {
        // Get a valid profile
        const profiles = resourceEnricher.getProfiles('55552e89-e63d-4362-b061-1077b8289eef');

        if (profiles.length === 0) {
            console.log('[TEST] Skipping: no profiles available');
            return;
        }

        const testProfile = profiles[0];

        // Find auth tool
        const allTools = await toolService.getAllTools();
        const authTool = allTools.find(t =>
            t.name.includes('55552e89-e63d-4362-b061-1077b8289eef') &&
            t.name.includes('auth')
        );

        if (!authTool) {
            console.log('[TEST] Skipping: auth tool not found');
            return;
        }

        // Execute tool with profile credentials
        const result = await toolService.executeTool(authTool.name, testProfile.credentials);

        expect(result).toBeDefined();
        expect(result.isError).toBeFalsy();

        // Should return authenticated user data
        const output = result.content[0]?.text;
        expect(output).toBeDefined();

        console.log(`[TEST] ✅ Auth successful with profile: ${testProfile.label}`);
    });

    it('should fail gracefully when no profiles available', async () => {
        try {
            // Try to get profile for non-existent resource
            resourceEnricher.getProfileOrFail('nonexistent-resource-id');

            // Should not reach here
            expect(true).toBe(false);
        } catch (error) {
            expect(error).toBeInstanceOf(NoProfilesAvailableError);
            expect(error.message).toContain('No authentication profiles available');
        }
    });

    it('should validate profile belongs to correct resource', async () => {
        const profiles = resourceEnricher.getProfiles('55552e89-e63d-4362-b061-1077b8289eef');

        if (profiles.length === 0) {
            console.log('[TEST] Skipping: no profiles available');
            return;
        }

        const testProfile = profiles[0];

        // Should succeed with correct resource
        await expect(
            resourceEnricher.validateProfileBelongsToResource(
                testProfile.id,
                '55552e89-e63d-4362-b061-1077b8289eef'
            )
        ).resolves.toBeDefined();

        // Should fail with wrong resource
        await expect(
            resourceEnricher.validateProfileBelongsToResource(
                testProfile.id,
                'wrong-resource-id'
            )
        ).rejects.toThrow();
    });
});
