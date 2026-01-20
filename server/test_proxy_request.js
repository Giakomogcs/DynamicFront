// Native fetch in Node 22
// In Node 22 (current env), fetch is global.

async function main() {
    try {
        console.log("Sending request to proxy...");
        const response = await fetch('http://127.0.0.1:3000/api/test/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tool: "dn_dashboardcontroller_getcontractscapacity",
                params: {
                    year: 2024,
                    start_month: "062024",
                    end_month: "062024",
                    state: "SP"
                }
            })
        });

        console.log("Status:", response.status);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            console.log("Response:", JSON.stringify(data, null, 2));
        } catch {
            console.log("Response Text:", text);
        }

    } catch (e) {
        console.error("Fetch Error:", e.message);
        if (e.cause) console.error("Cause:", e.cause);
    }
}

main();
