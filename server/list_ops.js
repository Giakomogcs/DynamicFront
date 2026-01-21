
import fs from 'fs';

const spec = JSON.parse(fs.readFileSync('spec.json', 'utf8'));
const ops = [];

if (spec.paths) {
    Object.keys(spec.paths).forEach(path => {
        Object.keys(spec.paths[path]).forEach(method => {
            const op = spec.paths[path][method];
            if (op.operationId) {
                ops.push(`${op.operationId} (${method.toUpperCase()} ${path})`);
            }
        });
    });
}
console.log(ops.join('\n'));
