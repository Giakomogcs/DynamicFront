
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import dotenv from 'dotenv';
dotenv.config();

async function testFetch() {
    console.log("Testing connectivity to Google Gemini API...");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("ERROR: GEMINI_API_KEY not found in .env");
        return;
    }
    console.log(`API Key starts with: ${apiKey.substring(0, 5)}...`);

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        console.log(`Fetching: ${url.replace(apiKey, 'HIDDEN')}`);
        const response = await fetch(url);

        console.log(`Status: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            console.log("Body:", await response.text());
        } else {
            const data = await response.json();
            console.log("Success! Found models:", data.models?.length);
        }
    } catch (e) {
        console.error("FETCH ERROR:", e);
    }
}

testFetch();
