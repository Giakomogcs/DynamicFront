const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('server/agents/Executor.js', 'utf8');

try {
    acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
    console.log("Syntax is OK");
} catch (e) {
    console.log(`Syntax Error at line ${e.loc.line}, col ${e.loc.column}: ${e.message}`);
    // Print context
    const lines = code.split('\n');
    console.log("Context:");
    for (let i = Math.max(0, e.loc.line - 3); i < Math.min(lines.length, e.loc.line + 2); i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}
