/**
 * Authentication Routes for v2.0
 * Endpoints for User Manager integration
 */

import express from 'express';

const router = express.Router();

// Mock User Manager integration (until real credentials are provided)
const KNOWN_USERS = [
  {
    id: 'user_admin',
    email: 'admin@dynamicfront.com',
    name: 'Admin User',
    role: 'admin',
  },
  {
    id: 'user_dev',
    email: 'dev@dynamicfront.com',
    name: 'Developer',
    role: 'user',
  },
];

/**
 * GET /api/auth/current-user
 * Returns current authenticated user based on Bearer token or default user
 */
router.get('/current-user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    // If Authorization header with Bearer token is present
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // TODO: When User Manager credentials are provided, validate token here
      // const user = await validateTokenWithUserManager(token);
      // if (user) return res.json({ success: true, user });

      // For now, if token is present but not validated, return default user
      console.log('Token received but User Manager not configured, using default user');
    }

    // Return default user (admin if available, otherwise first user)
    const defaultUser = KNOWN_USERS.find(u => u.role === 'admin') || KNOWN_USERS[0];

    res.json({
      success: true,
      user: defaultUser,
      source: 'fallback', // indicates using KNOWN_USERS
    });
  } catch (error) {
    console.error('Error in /api/auth/current-user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/test/auth
 * Health check endpoint for User Manager integration
 * Returns status and available users
 */
router.get('/test', async (req, res) => {
  try {
    // Check if User Manager is configured
    const userManagerConfigured = !!(
      process.env.RESOURCE_BASE_URL &&
      process.env.USER_MANAGER_TOKEN
    );

    const response = {
      success: true,
      userManagerConfigured,
      totalUsers: KNOWN_USERS.length,
      defaultUser: KNOWN_USERS.find(u => u.role === 'admin') || KNOWN_USERS[0],
      message: userManagerConfigured
        ? 'User Manager is configured'
        : 'Using KNOWN_USERS fallback (User Manager credentials not provided)',
    };

    // If User Manager is configured, test connection
    if (userManagerConfigured) {
      try {
        // TODO: Test connection to User Manager
        // const healthCheck = await fetch(`${process.env.RESOURCE_BASE_URL}/user-manager/health`);
        // response.userManagerHealth = healthCheck.ok;
        response.userManagerHealth = 'not tested (placeholder)';
      } catch (error) {
        response.userManagerHealth = 'connection failed';
        response.userManagerError = error.message;
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Error in /api/test/auth:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/logout
 * Clear user session
 */
router.post('/logout', (req, res) => {
  // In a real implementation, this would clear session/cookies
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;
