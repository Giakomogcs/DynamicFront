/**
 * Auth Profile Routes - FASE 5.2
 * API endpoints para gerenciar perfis de autenticação por resource
 */

import express from 'express';
import prisma from '../registry.js';

const router = express.Router();

/**
 * GET /api/resources/:id/auth-profiles
 * Lista todos os perfis de autenticação de um resource
 */
router.get('/:resourceId/auth-profiles', async (req, res) => {
    try {
        const { resourceId } = req.params;

        const profiles = await prisma.authProfile.findMany({
            where: { resourceId },
            orderBy: { role: 'asc' }
        });

        res.json({
            success: true,
            profiles,
            count: profiles.length
        });

    } catch (error) {
        console.error('[AuthProfileRoutes] Error listing profiles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/resources/:id/auth-profiles
 * Cria novo perfil de autenticação
 */
router.post('/:resourceId/auth-profiles', async (req, res) => {
    try {
        const { resourceId } = req.params;
        const { label, role, description, credentials } = req.body;

        // Validação
        if (!label || !role) {
            return res.status(400).json({
                success: false,
                error: 'Label e role são obrigatórios'
            });
        }

        const profile = await prisma.authProfile.create({
            data: {
                resourceId,
                label,
                role,
                description,
                credentials: credentials || {}
            }
        });

        res.status(201).json({
            success: true,
            profile,
            message: `Perfil "${label}" criado com sucesso`
        });

    } catch (error) {
        console.error('[AuthProfileRoutes] Error creating profile:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PATCH /api/resources/:id/auth-profiles/:profileId
 * Atualiza perfil existente
 */
router.patch('/:resourceId/auth-profiles/:profileId', async (req, res) => {
    try {
        const { profileId } = req.params;
        const { label, role, description, credentials } = req.body;

        const updateData = {};
        if (label !== undefined) updateData.label = label;
        if (role !== undefined) updateData.role = role;
        if (description !== undefined) updateData.description = description;
        if (credentials !== undefined) updateData.credentials = credentials;

        const profile = await prisma.authProfile.update({
            where: { id: profileId },
            data: updateData
        });

        res.json({
            success: true,
            profile,
            message: `Perfil atualizado com sucesso`
        });

    } catch (error) {
        console.error('[AuthProfileRoutes] Error updating profile:', error);

        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: 'Perfil não encontrado'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/resources/:id/auth-profiles/:profileId
 * Remove perfil de autenticação
 */
router.delete('/:resourceId/auth-profiles/:profileId', async (req, res) => {
    try {
        const { profileId } = req.params;

        await prisma.authProfile.delete({
            where: { id: profileId }
        });

        res.json({
            success: true,
            message: 'Perfil removido com sucesso'
        });

    } catch (error) {
        console.error('[AuthProfileRoutes] Error deleting profile:', error);

        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: 'Perfil não encontrado'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/resources/:id/auth-profiles/:profileId/test
 * Testa um perfil de autenticação
 */
router.post('/:resourceId/auth-profiles/:profileId/test', async (req, res) => {
    try {
        const { profileId } = req.params;

        const profile = await prisma.authProfile.findUnique({
            where: { id: profileId },
            include: { resource: true }
        });

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Perfil não encontrado'
            });
        }

        // TODO: Implementar teste real via MCP
        // Por enquanto, apenas valida se credentials existem
        const hasCredentials = profile.credentials && Object.keys(profile.credentials).length > 0;

        res.json({
            success: true,
            valid: hasCredentials,
            profile: {
                id: profile.id,
                label: profile.label,
                role: profile.role
            }
        });

    } catch (error) {
        console.error('[AuthProfileRoutes] Error testing profile:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
