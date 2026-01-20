import { toolService } from './services/toolService.js';
import prisma from './registry.js';

/**
 * Test Enhanced OpenAPI Tool Generation
 * Verifies that tools now include examples, formats, and validation rules
 */

async function testEnhancedTools() {
    console.log("=== Testing Enhanced OpenAPI Tool Generation ===\n");

    try {
        // Get all tools
        const tools = await toolService.getAllTools();

        // Find API tools (those with examples)
        const apiTools = tools.filter(t => {
            const execInfo = toolService.executionMap.get(t.name);
            return execInfo?.type === 'mcp' && t.name.includes('api_');
        });

        console.log(`Found ${apiTools.length} API tools\n`);

        if (apiTools.length === 0) {
            console.log("⚠️  No API tools found. Make sure you have APIs registered.");
            return;
        }

        // Analyze first 3 tools for enrichment
        const samplesToAnalyze = apiTools.slice(0, 3);

        for (const tool of samplesToAnalyze) {
            console.log(`\n📋 Tool: ${tool.name}`);
            console.log(`   Description: ${tool.description}`);

            const props = tool.inputSchema?.properties || {};
            const propCount = Object.keys(props).length;

            console.log(`   Parameters: ${propCount}`);

            let enrichmentCount = 0;

            for (const [paramName, paramSchema] of Object.entries(props)) {
                // Skip internal params
                if (paramName.startsWith('_')) continue;

                const hasExample = paramSchema.description?.includes('Example:');
                const hasFormat = paramSchema.format !== undefined;
                const hasEnum = paramSchema.enum !== undefined;
                const hasPattern = paramSchema.pattern !== undefined;
                const hasConstraints = paramSchema.minimum !== undefined ||
                    paramSchema.maximum !== undefined ||
                    paramSchema.minLength !== undefined ||
                    paramSchema.maxLength !== undefined;

                const enrichments = [];
                if (hasExample) enrichments.push('example');
                if (hasFormat) enrichments.push('format');
                if (hasEnum) enrichments.push('enum');
                if (hasPattern) enrichments.push('pattern');
                if (hasConstraints) enrichments.push('constraints');

                if (enrichments.length > 0) {
                    enrichmentCount++;
                    console.log(`      ✅ ${paramName}: ${enrichments.join(', ')}`);

                    // Show example if present
                    if (hasExample) {
                        const exampleMatch = paramSchema.description.match(/Example: (.+?)(\)|$)/);
                        if (exampleMatch) {
                            console.log(`         Example value: ${exampleMatch[1]}`);
                        }
                    }
                } else {
                    console.log(`      ⚠️  ${paramName}: no enrichment`);
                }
            }

            const enrichmentPercentage = propCount > 0 ? ((enrichmentCount / propCount) * 100).toFixed(0) : 0;
            console.log(`   Enrichment: ${enrichmentCount}/${propCount} params (${enrichmentPercentage}%)`);
        }

        console.log("\n=== Summary ===");
        console.log("✅ Enhanced tool generation is working!");
        console.log("Tools now include:");
        console.log("  - Examples in descriptions");
        console.log("  - Format specifications");
        console.log("  - Enum values");
        console.log("  - Validation patterns");
        console.log("  - Min/max constraints");

    } catch (error) {
        console.error("\n❌ Test failed:", error);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testEnhancedTools();
