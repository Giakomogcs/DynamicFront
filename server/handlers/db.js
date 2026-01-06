import pg from 'pg';
const { Client } = pg;

/**
 * Validates connection
 */
export async function validateDbConnection(connectionString) {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        await client.end();
        return true;
    } catch (e) {
        throw new Error(`DB Connection failed: ${e.message}`);
    }
}

/**
 * Generates Tools for a Registered DB
 */
export function getDbTools(db) {
    const prefix = db.name.toLowerCase().replace(/\s+/g, '_');

    return [
        {
            name: `${prefix}_inspect_schema`,
            description: `List tables and columns in the ${db.name} database`,
            inputSchema: { type: "object", properties: {} },
            _exec: { type: 'db', dbId: db.idString, action: 'inspect', connectionString: db.connectionString }
        },
        {
            name: `${prefix}_query`,
            description: `Run a SQL query on ${db.name}. WARNING: Use read-only queries when possible.`,
            inputSchema: {
                type: "object",
                properties: {
                    sql: { type: "string", description: "The SQL Query to execute" }
                },
                required: ["sql"]
            },
            _exec: { type: 'db', dbId: db.idString, action: 'query', connectionString: db.connectionString }
        }
    ];
}

/**
 * Executes DB Tool
 */
export async function executeDbTool(toolExecConfig, args) {
    const { action, connectionString } = toolExecConfig;
    const client = new Client({ connectionString });

    try {
        await client.connect();

        let result;
        if (action === 'inspect') {
            // Generic inspection query (works for Postgres/MySQL standard schema info)
            // Note: This query is Postgres specific. For MVP we assume Postgres as per prompt/plan bias, but can expand.
            const query = `
                SELECT table_name, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                ORDER BY table_name, ordinal_position;
            `;
            result = await client.query(query);

            // Format schema nicely and COMPACTLY
            // Output: "table_name: column(type), column(type)..."
            const schemaMap = {};
            result.rows.forEach(row => {
                if (!schemaMap[row.table_name]) schemaMap[row.table_name] = [];
                schemaMap[row.table_name].push(`${row.column_name}(${row.data_type})`);
            });

            // Convert map to compact text lines
            const lines = Object.entries(schemaMap).map(([table, cols]) => {
                return `Table ${table}: ${cols.join(', ')}`;
            });

            return {
                content: [{ type: "text", text: lines.join('\n') }]
            };

        } else if (action === 'query') {
            if (!args.sql) throw new Error("Missing SQL argument");
            // Basic safety: Prevent DROP/DELETE? For MVP, we allow it (Agentic/Trusted), but maybe warn.
            result = await client.query(args.sql);
            return {
                content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }]
            };
        }

    } catch (error) {
        return {
            content: [{ type: "text", text: `Database Error: ${error.message}` }],
            isError: true
        };
    } finally {
        await client.end().catch(() => { });
    }
}
