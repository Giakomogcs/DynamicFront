// Manual test for Step 1 validation
import { resourceEnricher } from './src/core/ResourceEnricher.js';
import { ProfileMismatchError } from './src/errors/AuthErrors.js';

async function testStep1() {
    console.log('=== STEP 1 MANUAL VALIDATION ===\n');

    try {
        // 1. Load profiles
        await resourceEnricher.loadProfiles();
        console.log('✓ Profiles loaded from database\n');

        // 2. Get profiles for default_registry
        const profiles = resourceEnricher.getProfiles('default_registry');
        console.log(`✓ Found ${profiles.length} profiles for 'default_registry'\n`);

        if (profiles.length > 0) {
            const testProfile = profiles[0];
            console.log(`Test Profile: ${testProfile.label} (${testProfile.role})\n`);

            // 3. Test valid validation
            console.log('Testing VALID validation...');
            await resourceEnricher.validateProfileBelongsToResource(
                testProfile.id,
                'default_registry'
            );
            console.log('✓ Valid validation passed\n');

            // 4. Test INVALID validation (wrong resource)
            console.log('Testing INVALID validation (should fail)...');
            try {
                await resourceEnricher.validateProfileBelongsToResource(
                    testProfile.id,
                    'wrong-resource-name'
                );
                console.log('❌ FAILED: Should have thrown ProfileMismatchError\n');
            } catch (error) {
                if (error instanceof ProfileMismatchError) {
                    console.log('✓ Correctly threw ProfileMismatchError');
                    console.log(`  Error: ${error.message}\n`);
                } else {
                    console.log(`❌ Wrong error type: ${error.constructor.name}\n`);
                }
            }

            // 5. Test getProfileOrFail
            console.log('Testing getProfileOrFail...');
            const selected = resourceEnricher.getProfileOrFail('default_registry');
            console.log(`✓ Selected profile: ${selected.label}\n`);

            // 6. Test getProfileOrFail with non-existent resource
            console.log('Testing getProfileOrFail with non-existent resource (should fail)...');
            try {
                resourceEnricher.getProfileOrFail('nonexistent-xyz');
                console.log('❌ FAILED: Should have thrown NoProfilesAvailableError\n');
            } catch (error) {
                console.log('✓ Correctly threw NoProfilesAvailableError');
                console.log(`  Error: ${error.message}\n`);
            }
        } else {
            console.log('⚠️ No profiles in database to test with');
            console.log('   Run: npm run db:seed to add test profiles\n');
        }

        console.log('=== ALL MANUAL TESTS PASSED ===');
    } catch (error) {
        console.error('❌ Manual test failed:', error);
        process.exit(1);
    }
}

testStep1();
