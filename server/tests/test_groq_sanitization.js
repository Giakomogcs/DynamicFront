
import { GroqProvider } from '../services/ai/providers/GroqProvider.js';

// Mock config
const config = { apiKey: 'test' };
const provider = new GroqProvider(config);

// Test Data: Gemini/Generic style history
const history = [
    { role: 'user', content: 'What is the weather?' },
    {
        role: 'model', // Test generic 'model' role mapping
        content: null,
        toolCalls: [{ name: 'get_weather', args: { city: 'London' } }] // ID missing
    },
    {
        role: 'tool',
        name: 'get_weather',
        content: { temp: 20 } // Test object content
    }
];

console.log("Original History:", JSON.stringify(history, null, 2));

const sanitized = provider._sanitizeHistory(history);

console.log("Sanitized History:", JSON.stringify(sanitized, null, 2));

// Assertions
const assistantMsg = sanitized[1];
const toolMsg = sanitized[2];

if (assistantMsg.role !== 'assistant') {
    console.error("FAIL: Role mapping failed (expected assistant)");
    process.exit(1);
}

if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
    console.error("FAIL: Assistant message missing tool_calls");
    process.exit(1);
}

const callId = assistantMsg.tool_calls[0].id;
if (!callId) {
    console.error("FAIL: Tool call ID missing in assistant message");
    process.exit(1);
}

if (toolMsg.tool_call_id !== callId) {
    console.error(`FAIL: Tool message ID mismatch. Expected ${callId}, got ${toolMsg.tool_call_id}`);
    process.exit(1);
}

if (typeof toolMsg.content !== 'string') {
    console.error("FAIL: Tool content not stringified");
    process.exit(1);
}

console.log("SUCCESS: History sanitization is correct.");
