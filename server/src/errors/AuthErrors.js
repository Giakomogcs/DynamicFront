/**
 * Custom Error Classes for Authentication
 * Provides structured, traceable errors for auth flow debugging
 */

export class AuthenticationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'AuthenticationError';
        this.details = details;
    }
}

export class ProfileNotFoundError extends AuthenticationError {
    constructor(resourceId, profileId) {
        super(`Profile ${profileId} not found for resource ${resourceId}`);
        this.resourceId = resourceId;
        this.profileId = profileId;
    }
}

export class ProfileMismatchError extends AuthenticationError {
    constructor(profileId, expectedResource, actualResource) {
        super(
            `Profile ${profileId} belongs to resource '${actualResource}' ` +
            `but was used for '${expectedResource}'`
        );
        this.profileId = profileId;
        this.expectedResource = expectedResource;
        this.actualResource = actualResource;
    }
}

export class NoProfilesAvailableError extends AuthenticationError {
    constructor(resourceId) {
        super(
            `No authentication profiles available for resource '${resourceId}'. ` +
            `Please register a user in the User Manager for this resource.`
        );
        this.resourceId = resourceId;
    }
}
