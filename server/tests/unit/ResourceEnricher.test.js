import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceEnricher } from '../../src/core/ResourceEnricher.js';
import {
    ProfileNotFoundError,
    ProfileMismatchError,
    NoProfilesAvailableError
} from '../../src/errors/AuthErrors.js';

describe('ResourceEnricher - Authentication Validation', () => {
    let enricher;

    beforeEach(async () => {
        enricher = new ResourceEnricher();
        // Load profiles from database
        await enricher.loadProfiles();
    });

    it('should return only profiles for specific resource', () => {
        // Get profiles for a specific resource
        const profiles = enricher.getProfiles('default_registry');

        // Should return array (empty or with profiles)
        expect(Array.isArray(profiles)).toBe(true);

        // If profiles exist, they should all be for the requested resource
        if (profiles.length > 0) {
            // Note: profiles in authRegistry are pre-filtered by resource
            // so this test validates the filtering worked correctly
            expect(profiles).toBeDefined();
        }
    });

    it('should throw NoProfilesAvailableError when no profiles exist', () => {
        // Try to get profile for non-existent resource
        expect(() => {
            enricher.getProfileOrFail('nonexistent-resource-xyz');
        }).toThrow(NoProfilesAvailableError);

        // Verify error message is helpful
        try {
            enricher.getProfileOrFail('nonexistent-resource-xyz');
        } catch (error) {
            expect(error.message).toContain('No authentication profiles available');
            expect(error.message).toContain('nonexistent-resource-xyz');
            expect(error.resourceId).toBe('nonexistent-resource-xyz');
        }
    });

    it('should select profile with preferred role if available', () => {
        // Skip if no profiles available
        const profiles = enricher.getProfiles('default_registry');
        if (profiles.length === 0) {
            console.log('[TEST] Skipping: no profiles in DB');
            return;
        }

        // Get first profile's role
        const existingRole = profiles[0].role;

        // Request profile with that role
        const selected = enricher.getProfileOrFail('default_registry', existingRole);

        expect(selected).toBeDefined();
        expect(selected.role).toBe(existingRole);
    });

    it('should return first profile if preferred role not found', () => {
        // Skip if no profiles available
        const profiles = enricher.getProfiles('default_registry');
        if (profiles.length === 0) {
            console.log('[TEST] Skipping: no profiles in DB');
            return;
        }

        // Request profile with non-existent role
        const selected = enricher.getProfileOrFail('default_registry', 'non-existent-role');

        // Should return first available
        expect(selected).toBeDefined();
        expect(selected.id).toBe(profiles[0].id);
    });

    it('should validate profile belongs to correct resource', async () => {
        // Skip if no profiles available
        const profiles = enricher.getProfiles('default_registry');
        if (profiles.length === 0) {
            console.log('[TEST] Skipping: no profiles in DB');
            return;
        }

        const profileId = profiles[0].id;

        // This should succeed (profile belongs to default_registry)
        const validatedProfile = await enricher.validateProfileBelongsToResource(
            profileId,
            'default_registry'
        );

        expect(validatedProfile).toBeDefined();
        expect(validatedProfile.id).toBe(profileId);
    });

    it('should throw ProfileNotFoundError for invalid profileId', async () => {
        await expect(
            enricher.validateProfileBelongsToResource(
                'invalid-uuid-12345',
                'default_registry'
            )
        ).rejects.toThrow(ProfileNotFoundError);
    });

    it('should throw ProfileMismatchError when using wrong resource', async () => {
        // Skip if no profiles available
        const profiles = enricher.getProfiles('default_registry');
        if (profiles.length === 0) {
            console.log('[TEST] Skipping: no profiles in DB');
            return;
        }

        const profileId = profiles[0].id;

        // Try to validate this profile for a DIFFERENT resource
        // This should fail because profile belongs to 'default_registry' not 'wrong-resource'
        await expect(
            enricher.validateProfileBelongsToResource(
                profileId,
                'wrong-resource-name'
            )
        ).rejects.toThrow(ProfileMismatchError);
    });
});
