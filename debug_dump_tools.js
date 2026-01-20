
import { toolService } from './server/services/toolService.js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function run() {
    try {
        console.log("Fetching tools...");
        const tools = await toolService.getAllTools();
        const relevant = tools.map(t => t.name).filter(n => n.includes('course') || n.includes('city') || n.includes('unit') || n.includes('senai'));
        console.log("Relevant Tools:", relevant.join('\n'));
    } catch (e) {
        console.error(e);
    }
}
run();
