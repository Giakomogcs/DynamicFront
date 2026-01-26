import { describe, it, expect, vi } from 'vitest';
import { McpClientService } from '../../src/services/mcpClientService.js';

describe('McpClientService tool naming', () => {
    it('should shorten long tool names to 64 chars', async () => {
        const service = new McpClientService();
        const longServerName = 'api_2a7dfea8-048c-4666-834e-669d06ac89d7';
        const longToolName = 'some_extraordinarily_long_tool_name_that_will_push_the_limit_way_beyond_what_is_allowed';
        
        // Mock the client and listTools
        const mockClient = {
            listTools: vi.fn().mockResolvedValue({
                tools: [{ name: longToolName }]
            })
        };
        service.clients.set(longServerName, mockClient);

        await service.refreshTools(longServerName);
        
        const tools = service.toolsCache.get(longServerName);
        expect(tools[0].name.length).toBeLessThanOrEqual(64);
        expect(tools[0].name).toContain('api_2a7dfea8');
        expect(tools[0].name).toContain('some_extraordinarily_long');
    });

    it('should not change short tool names', async () => {
        const service = new McpClientService();
        const serverName = 'api_12345';
        const toolName = 'get_data';
        
        const mockClient = {
            listTools: vi.fn().mockResolvedValue({
                tools: [{ name: toolName }]
            })
        };
        service.clients.set(serverName, mockClient);

        await service.refreshTools(serverName);
        
        const tools = service.toolsCache.get(serverName);
        expect(tools[0].name).toBe('api_12345__get_data');
    });
});
