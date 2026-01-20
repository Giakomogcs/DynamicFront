import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log directory
const logDir = path.join(__dirname, '../../logs');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format with colors for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
    })
);

// Create Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Error log - only errors
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Combined log - all logs
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Console output with colors (development)
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
        })
    ]
});

// Authentication-specific logger
const authLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'auth.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        new winston.transports.Console({
            format: consoleFormat
        })
    ]
});

/**
 * Helper functions for structured logging
 */
export const log = {
    // General logging
    info: (message, metadata = {}) => logger.info(message, metadata),
    warn: (message, metadata = {}) => logger.warn(message, metadata),
    error: (message, metadata = {}) => logger.error(message, metadata),
    debug: (message, metadata = {}) => logger.debug(message, metadata),

    // Authentication-specific logging
    auth: {
        profileLoaded: (resourceId, profileCount) => {
            authLogger.info('Profiles loaded', {
                event: 'PROFILE_LOAD',
                resourceId,
                profileCount,
                timestamp: new Date().toISOString()
            });
        },

        profileSelected: (profileId, resourceId, label) => {
            authLogger.info('Profile selected', {
                event: 'PROFILE_SELECT',
                profileId,
                resourceId,
                label,
                timestamp: new Date().toISOString()
            });
        },

        validationSuccess: (profileId, resourceId) => {
            authLogger.info('Profile validation successful', {
                event: 'VALIDATION_SUCCESS',
                profileId,
                resourceId,
                timestamp: new Date().toISOString()
            });
        },

        validationFailure: (profileId, resourceId, reason) => {
            authLogger.warn('Profile validation failed', {
                event: 'VALIDATION_FAILURE',
                profileId,
                resourceId,
                reason,
                timestamp: new Date().toISOString()
            });
        },

        noProfilesAvailable: (resourceId) => {
            authLogger.warn('No profiles available for resource', {
                event: 'NO_PROFILES',
                resourceId,
                timestamp: new Date().toISOString()
            });
        },

        profileMismatch: (profileId, expectedResource, actualResource) => {
            authLogger.error('Profile resource mismatch', {
                event: 'PROFILE_MISMATCH',
                profileId,
                expectedResource,
                actualResource,
                timestamp: new Date().toISOString()
            });
        }
    }
};

export default logger;
