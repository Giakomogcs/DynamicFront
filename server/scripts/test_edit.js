import { toolService } from '../services/toolService.js';
import prisma from '../registry.js';

async function testEdit() {
    console.log("Testing Resource Editing...");

    // 1. Create a Dummy API directly
    const api = await prisma.verifiedApi.create({
        data: {
            name: "Test API",
            specUrl: "http://example.com/spec.json",
            baseUrl: "http://example.com",
            authConfig: "{}"
        }
    });
    console.log("Created API:", api.idString);

    try {
        // 2. Update it
        console.log("Updating API...");
        // Mock fetch for validation bypass inside processApiRegistration if needed
        global.fetch = async () => ({
            ok: true, json: async () => ({ openapi: "3.0.0", paths: {} })
        });

        const updated = await toolService.updateResource('api', api.idString, {
            name: "Updated Test API",
            specUrl: "http://example.com/spec_v2.json", // Changed spec
            baseUrl: "http://apiv2.example.com",
            authConfig: '{"type":"bearer"}'
        });

        if (updated.name === "Updated Test API" && updated.baseUrl === "http://apiv2.example.com") {
            console.log("Update SUCCESS: Name and BaseURL updated.");
        } else {
            console.log("Update FAILED:", updated);
        }

    } catch (e) {
        console.error("Test Error:", e);
    } finally {
        // Cleanup
        await prisma.verifiedApi.delete({ where: { idString: api.idString } });
    }
}

testEdit();
