import prisma from '../registry.js';

async function main() {
    console.log("Fixing Geocoding Service...");
    try {
        const name = "Geocoding Service";

        // Correct Structure expected by handlers/api.js
        const correctToolConfig = {
            tools: [
                {
                    name: "find_city_coordinates",
                    description: "Look up latitude and longitude for a city name. Use this when the user asks for weather in a specific city (e.g. Diadema) to get the coordinates first.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            params: {
                                type: "object",
                                properties: {
                                    name: { type: "string", description: "Name of the city" },
                                    count: { type: "integer", default: 1 }
                                },
                                required: ["name"]
                            }
                        }
                    },
                    apiConfig: {
                        method: "GET",
                        path: "/search",
                        baseUrl: "https://geocoding-api.open-meteo.com/v1"
                    }
                }
            ]
        };

        const existing = await prisma.verifiedApi.findFirst({ where: { name } });

        if (existing) {
            console.log("Updating existing Geocoding Service...");
            await prisma.verifiedApi.update({
                where: { idString: existing.idString },
                data: {
                    toolConfig: JSON.stringify(correctToolConfig),
                    specUrl: null, // Clear this to prevent validation errors
                    baseUrl: "https://geocoding-api.open-meteo.com/v1"
                }
            });
        } else {
            console.log("Creating new Geocoding Service...");
            await prisma.verifiedApi.create({
                data: {
                    name: name,
                    baseUrl: "https://geocoding-api.open-meteo.com/v1",
                    specUrl: null,
                    toolConfig: JSON.stringify(correctToolConfig),
                    authConfig: "{}"
                }
            });
        }
        console.log("Geocoding Service fixed successfully!");
    } catch (e) {
        console.error("Error fixing seed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
