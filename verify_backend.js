
async function checkEndpoints() {
    try {
        console.log("Checking /api/models...");
        const resModels = await fetch('http://localhost:3000/api/models');
        console.log("Status:", resModels.status);
        const models = await resModels.json();
        console.log("Models:", JSON.stringify(models, null, 2));

        console.log("Checking /api/resources...");
        const resResources = await fetch('http://localhost:3000/api/resources');
        console.log("Status:", resResources.status);
        const resources = await resResources.json();
        console.log("Resources:", JSON.stringify(resources, null, 2));
    } catch (e) {
        console.error("Error fetching:", e);
    }
}

checkEndpoints();
