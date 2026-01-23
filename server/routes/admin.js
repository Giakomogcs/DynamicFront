import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key';

// Middleware to check Admin role
const requireAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Double check DB
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user || user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied: Admins only' });
        }
        req.user = user;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

router.use(requireAdmin);

// GET All Users
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                avatarUrl: true,
                createdAt: true
            }
        });
        res.json(users);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// GET User Details
router.get('/users/:id', async (req, res) => {
    // ... detail view if needed
});

// TOGGLE Status
router.patch('/users/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({ where: { id } });
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Prevent self-lockout
        if (user.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }

        const updated = await prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive }
        });
        
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Update failed' });
    }
});

export default router;
