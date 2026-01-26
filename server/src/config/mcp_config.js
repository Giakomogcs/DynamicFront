
// Defines the MCP servers we want to connect to
import path from 'path';

export const MCP_SERVERS = {
    "filesystem": {
        command: "npx",
        args: [
            "-y",
            "@modelcontextprotocol/server-filesystem",
            path.resolve("./") // Expose current directory
        ]
    }
};
