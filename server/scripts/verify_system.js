import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

async function runTests() {
    console.log("🚀 Starting System Verification...\n");
    let sessionId = null;
    let homeCanvasId = null;

    // 1. Test Session Creation
    try {
        console.log("1️⃣  Testing Session Creation...");
        const res = await axios.post(`${API_URL}/sessions`, { title: "Verification Session" });
        if (res.data.id) {
            sessionId = res.data.id;
            console.log(`   ✅ Session Created: ${sessionId} (${res.data.title})`);
        } else {
            console.error("   ❌ Failed to create session (No ID returned)");
            return;
        }
    } catch (e) {
        console.error("   ❌ Error creating session:", e.message);
        return;
    }

    // 2. Test Session Structure (Canvas Auto-Creation)
    try {
        console.log("\n2️⃣  Testing Session Structure...");
        const res = await axios.get(`${API_URL}/sessions/${sessionId}/structure`);
        if (res.data.canvases && res.data.canvases.length > 0) {
            const home = res.data.canvases[0];
            homeCanvasId = home.id;
            console.log(`   ✅ Structure Retrieved. Found ${res.data.canvases.length} canvases.`);
            console.log(`   ✅ Home Canvas: ${home.title} (ID: ${home.id}, Slug: ${home.slug})`);
        } else {
            console.error("   ❌ Session has no canvases!");
        }
    } catch (e) {
        console.error("   ❌ Error fetching structure:", e.message);
    }

    // 3. Test Intelligent Agent - Routing (Create Page)
    try {
        console.log("\n3️⃣  Testing Intelligent Agent (CREATE_PAGE Intent)...");
        console.log("   📤 Sending: 'Create a new dashboard for Sales'");
        
        const payload = {
            message: "Create a new dashboard for Sales",
            sessionId: sessionId,
            canvasContext: {
                activeSlug: 'home',
                activePageId: homeCanvasId,
                sessionId: sessionId,
                mode: 'intelligent'
            }
        };

        const res = await axios.post(`${API_URL}/chat`, payload);
        
        if (res.data.action === 'navigate_canvas') {
            console.log(`   ✅ Agent Correctly Routed to CREATE_PAGE!`);
            console.log(`   🎯 Target Slug: ${res.data.targetSlug}`);
            console.log(`   📝 Text Response: ${res.data.text}`);
        } else {
            console.warn(`   ⚠️ Unexpected Agent Response:`, res.data);
        }

    } catch (e) {
        console.error("   ❌ Agent Error:", e.response ? e.response.data : e.message);
    }

    // 4. Test Intelligent Agent - Navigation (Go Home)
    try {
        console.log("\n4️⃣  Testing Intelligent Agent (NAVIGATE Intent)...");
        console.log("   📤 Sending: 'Go back to home'");
        
        const payload = {
            message: "Go back to home",
            sessionId: sessionId,
            canvasContext: {
                activeSlug: 'sales-dashboard', // Pretend we are elsewhere
                sessionId: sessionId,
                mode: 'intelligent'
            }
        };

        const res = await axios.post(`${API_URL}/chat`, payload);
        
        if (res.data.action === 'navigate_canvas' && res.data.targetSlug === 'home') {
             console.log(`   ✅ Agent Correctly Routed to NAVIGATE!`);
             console.log(`   🎯 Target Slug: ${res.data.targetSlug}`);
        } else {
             console.warn(`   ⚠️ Unexpected Agent Response:`, res.data);
        }

    } catch (e) {
        console.error("   ❌ Agent Error:", e.response ? e.response.data : e.message);
    }

    console.log("\n🏁 Verification Complete.");
}

runTests();
