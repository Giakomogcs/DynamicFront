import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateToken = async (req, res, next) => {
    // Check for token in Header OR Query (for dev ease)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1] || req.query.token;

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.sendStatus(403);

        // Optional: Fetch fresh user from DB to check status in real-time
        // This adds DB load but ensures instant ban enforcement.
        try {
            const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
            
            if (!dbUser) return res.sendStatus(403);
            
            if (!dbUser.isActive) {
                return res.status(403).json({ error: 'Account deactivated.' });
            }
            
            if (dbUser.expiresAt && new Date(dbUser.expiresAt) < new Date()) {
                return res.status(403).json({ error: 'Account expired.' });
            }

            req.user = dbUser;
            next();
        } catch (dbError) {
            console.error(dbError);
            res.sendStatus(500);
        }
    });
};

export const ensureAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required.' });
    }
};
