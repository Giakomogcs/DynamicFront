import { sessionService } from '../services/SessionService.js';
import prisma from '../registry.js';

export const pageManagerTool = {
    name: 'manage_pages',
    description: 'Manage pages (canvases) in the current project (session). Use this to CREATE new pages (e.g. "Add a Settings page") or DELETE pages.',
    inputSchema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['create', 'delete', 'list'],
                description: 'The action to perform.'
            },
            title: {
                type: 'string',
                description: 'Title of the page (required for create).'
            },
            slug: {
                type: 'string',
                description: 'URL-friendly identifier (e.g. "settings", "reports"). If not provided, will be generated from title.'
            },
            sessionId: {
                type: 'string',
                description: 'The Session/Project ID. Usually provided by context, but can be explicit.'
            },
            targetSlug: {
                type: 'string',
                description: 'The slug of the page to delete (required for delete).'
            }
        },
        required: ['action']
    }
};

export async function handlePageManager(name, args) {
    // If called with single arg (legacy/direct), handle it
    if (arguments.length === 1) {
        args = name;
    }
    
    const { action, title, sessionId, targetSlug } = args;
    let { slug } = args;

    // TODO: SessionID should be injected from context if missing.
    // For now we rely on the Planner/Executor passing it or it being null (which might fail validation).
    if (!sessionId) {
        return { isError: true, content: [{ type: 'text', text: 'Session ID is required.' }] };
    }

    try {
        if (action === 'create') {
            if (!title) return { isError: true, content: [{ type: 'text', text: 'Title is required for create.' }] };

            // Generate slug if missing
            if (!slug) {
                slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            }

            // Check if exists
            const existing = await prisma.canvas.findFirst({
                where: { sessionId, slug }
            });
            if (existing) {
                return { isError: true, content: [{ type: 'text', text: `Page with slug '${slug}' already exists.` }] };
            }

            const canvas = await sessionService.createCanvas(sessionId, `/${slug}`, slug, title, false);
            return {
                content: [{ type: 'text', text: `Page '${title}' created successfully.` }],
                metadata: {
                    action: 'navigate_canvas',
                    targetSlug: slug,
                    title: title
                }
            };
        }

        if (action === 'delete') {
            if (!targetSlug) return { isError: true, content: [{ type: 'text', text: 'targetSlug is required for delete.' }] };

            // Don't delete Home
            if (targetSlug === 'home') return { isError: true, content: [{ type: 'text', text: 'Cannot delete Home page.' }] };

            const canvas = await prisma.canvas.findFirst({ where: { sessionId, slug: targetSlug } });
            if (!canvas) return { isError: true, content: [{ type: 'text', text: 'Page not found.' }] };

            await prisma.canvas.delete({ where: { id: canvas.id } });
            return { content: [{ type: 'text', text: `Page '${canvas.title}' deleted.` }] };
        }

        if (action === 'list') {
            const structure = await sessionService.getSessionStructure(sessionId);
            const pages = structure.canvases.map(c => `- ${c.title} (${c.slug})`).join('\n');
            return { content: [{ type: 'text', text: `Pages:\n${pages}` }] };
        }

    } catch (e) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${e.message}` }] };
    }

    return { isError: true, content: [{ type: 'text', text: 'Invalid action.' }] };
}
