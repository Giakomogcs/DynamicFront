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
            description: `List tables in the database. PREFERRED: Use 'search' to find specific tables and view their columns. If no filter provided, returns ONLY table names (lightweight).`,
            inputSchema: {
                type: "object",
                properties: {
                    search: { type: "string", description: "Optional: Search term to filter table names and reveal columns (e.g. 'user')" }
                }
            },
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
            const search = args.search ? args.search.toLowerCase() : null;

            // STRATEGY: Light Mode vs Full Mode
            // If NO search: Get TABLE NAMES ONLY
            // If SEARCH: Get COLUMNS for matching tables

            if (!search) {
                const query = `
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    ORDER BY table_name
                    LIMIT 200;
                `;
                result = await client.query(query);

                const tableNames = result.rows.map(r => r.table_name);
                if (tableNames.length === 0) return { content: [{ type: "text", text: "No tables found." }] };

                return {
                    content: [{ type: "text", text: `Found ${tableNames.length} tables (names only):\n${tableNames.join(', ')}\n\n(Tip: Use 'search' parameter to inspect columns of specific tables)` }]
                };
            }

            // 1. Fetch Columns
            const query = `
                SELECT table_name, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                ORDER BY table_name, ordinal_position;
            `;
            result = await client.query(query);

            // 2. Fetch Keys (PK/FK)
            const keysQuery = `
                SELECT
                    tc.table_name, 
                    kcu.column_name, 
                    tc.constraint_type,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name 
                FROM 
                    information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    LEFT JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY');
            `;
            const keysResult = await client.query(keysQuery);
            const keyMap = {}; // table.column -> " [PK]" or " [FK -> tbl.col]"

            keysResult.rows.forEach(r => {
                const key = `${r.table_name}.${r.column_name}`;
                if (r.constraint_type === 'PRIMARY KEY') {
                    keyMap[key] = ' [PK]';
                } else if (r.constraint_type === 'FOREIGN KEY') {
                    keyMap[key] = ` [FK -> ${r.foreign_table_name}.${r.foreign_column_name}]`;
                }
            });

            // const search = args.search ? args.search.toLowerCase() : null; // Already defined
            const schemaMap = {};

            result.rows.forEach(row => {
                const lowerTable = row.table_name.toLowerCase();
                // Filter by search term
                if (!lowerTable.includes(search)) return;

                if (!schemaMap[row.table_name]) schemaMap[row.table_name] = [];

                const keyInfo = keyMap[`${row.table_name}.${row.column_name}`] || '';
                schemaMap[row.table_name].push(`${row.column_name}(${row.data_type})${keyInfo}`);
            });

            // Convert map to compact text lines
            let lines = Object.entries(schemaMap).map(([table, cols]) => {
                return `Table ${table}: ${cols.join(', ')}`;
            });

            if (lines.length > 50) {
                lines = lines.slice(0, 50);
                lines.push("... (Refine search for more results)");
            }

            if (lines.length === 0) {
                return { content: [{ type: "text", text: `No tables found matching "${search}".` }] };
            }

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
