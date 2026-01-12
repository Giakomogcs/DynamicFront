import { executorAgent } from '../server/agents/Executor.js';

try {
    console.log("Executor Agent loaded successfully.");
    if (executorAgent && typeof executorAgent.execute === 'function') {
        console.log("Executor.execute is a function.");
        process.exit(0);
    } else {
        console.error("Executor agent instance not valid.");
        process.exit(1);
    }
} catch (e) {
    console.error("Syntax Error or Load Error:", e);
    process.exit(1);
}
