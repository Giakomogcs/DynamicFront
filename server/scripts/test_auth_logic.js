import { executeApiTool } from '../handlers/api.js';

async function test() {
    console.log("Testing executeApiTool with Profiles...");

    const originalFetch = global.fetch;
    let lastUrl;
    let lastOptions;

    // Mock global fetch to capture requests
    global.fetch = async (url, options) => {
        lastUrl = url;
        lastOptions = options || {};
        // Ensure headers exist
        if (!lastOptions.headers) lastOptions.headers = {};

        return {
            text: () => Promise.resolve('{"success": true}'),
            json: () => Promise.resolve({ success: true }),
            ok: true,
            status: 200
        };
    };

    const toolConfig = {
        method: 'GET',
        path: '/test',
        baseUrl: 'http://example.com',
        auth: { type: 'bearer', token: 'DEFAULT_TOKEN' }, // Default
        profiles: {
            'admin': { type: 'bearer', token: 'ADMIN_TOKEN' },
            'user': { type: 'apiKey', paramName: 'api_key', value: 'USER_KEY' }
        }
    };

    try {
        // Test 1: Default Auth (No profile specified)
        await executeApiTool(toolConfig, { params: {} });
        const test1Pass = lastOptions.headers['Authorization'] === 'Bearer DEFAULT_TOKEN';
        console.log(`Test 1 (Default): ${test1Pass ? 'PASS' : 'FAIL'} (Got: ${lastOptions.headers['Authorization']})`);

        // Test 2: Admin Profile
        await executeApiTool(toolConfig, { params: {}, _authProfile: 'admin' });
        const test2Pass = lastOptions.headers['Authorization'] === 'Bearer ADMIN_TOKEN';
        console.log(`Test 2 (Admin): ${test2Pass ? 'PASS' : 'FAIL'} (Got: ${lastOptions.headers['Authorization']})`);

        // Test 3: User Profile (Query Param)
        await executeApiTool(toolConfig, { params: {}, _authProfile: 'user' });
        const test3Pass = lastUrl.includes('api_key=USER_KEY');
        console.log(`Test 3 (User): ${test3Pass ? 'PASS' : 'FAIL'} (Url: ${lastUrl})`);

        // Test 4: Basic Auth Profile
        // Update config to include basic
        toolConfig.profiles['basic_user'] = { type: 'basic', username: 'testuser', password: 'testpass' };
        await executeApiTool(toolConfig, { params: {}, _authProfile: 'basic_user' });
        const expectedBasic = 'Basic ' + Buffer.from('testuser:testpass').toString('base64');
        const test4Pass = lastOptions.headers['Authorization'] === expectedBasic;
        console.log(`Test 4 (Basic): ${test4Pass ? 'PASS' : 'FAIL'} (Got: ${lastOptions.headers['Authorization']})`);

    } catch (e) {
        console.error("Test failed with error:", e);
    } finally {
        global.fetch = originalFetch;
    }
}

test();
