
// Using native fetch in Node 22+
async function testCreateSession() {
    const url = 'http://localhost:3000/api/sessions';
    const payload = {
        title: 'App Builder Project',
    };

    console.log(`Sending POST request to ${url} with payload:`, payload);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Success! Created session:', data);

            // Check Session Description
            if (data.description === 'Project Space') {
                console.log('✅ Session: Description matches Project structure.');
            } else {
                console.error('❌ Session: Description mismatch. Got:', data.description);
            }

            // Verify Home Canvas existence (need to fetch canvases or check if returned?)
            // Usually session create might not return canvases immediately in shallow object.
            // Let's fetch the Canvas.

            // Assuming we can list canvases or inspect DB logic, but let's test via API
            console.log('Fetching Canvases for Session...');
            // Need to know how to filter canvases by session via API?
            // Currently /api/canvases returns ALL. Let's cheat and filter locally or use recent
            const allCanvasesRes = await fetch('http://localhost:3000/api/canvases');
            const allCanvases = await allCanvasesRes.json();

            // Find one linked to this session
            const homeCanvas = allCanvases.find(c => c.groupId === data.id && c.isHome === true);

            if (homeCanvas) {
                console.log('✅ Canvas: Home Canvas found.');
                if (homeCanvas.slug === 'home' && homeCanvas.icon === 'House') {
                    console.log('✅ Canvas: Slug and Icon correct.');
                } else {
                    console.error('❌ Canvas: Slug/Icon mismatch.', homeCanvas);
                }
            } else {
                console.error('❌ Canvas: No Home Canvas found for session.');
            }

        } else {
            console.error('Failed to create session:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText);
        }
    } catch (error) {
        console.error('Error executing request:', error);
    }
}

testCreateSession();
