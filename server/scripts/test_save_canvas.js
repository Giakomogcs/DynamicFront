const BASE_URL = 'http://localhost:3000/api';

async function testSaveCanvas() {
    console.log('1. Creating Session...');
    const sessionRes = await fetch(`${BASE_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Project' })
    });

    if (!sessionRes.ok) {
        console.error('Session Create Failed:', await sessionRes.text());
        process.exit(1);
    }

    const session = await sessionRes.json();
    console.log('Session Created:', session.id);

    console.log('2. Saving New Canvas linked to Session...');
    const canvasPayload = {
        title: 'My Analysis',
        widgets: [{ type: 'stat', title: 'Test Stat' }],
        groupId: session.id
    };

    const canvasRes = await fetch(`${BASE_URL}/canvases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(canvasPayload)
    });

    if (!canvasRes.ok) {
        console.error('Canvas Save Failed:', await canvasRes.text());
        process.exit(1);
    }

    const canvas = await canvasRes.json();
    console.log('Canvas Saved:', canvas.id, 'Group ID:', canvas.groupId);

    if (canvas.groupId !== session.id) {
        console.error('MISMATCH: Canvas groupId does not match Session ID');
        process.exit(1);
    }

    console.log('3. Updating Canvas...');
    const updateRes = await fetch(`${BASE_URL}/canvases/${canvas.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: 'My Analysis Updated',
            groupId: session.id
        })
    });

    if (!updateRes.ok) {
        console.error('Canvas Update Failed:', await updateRes.text());
        process.exit(1);
    }

    const updatedCanvas = await updateRes.json();
    console.log('Canvas Updated:', updatedCanvas.title);

    console.log('✅ TEST PASSED: Session linking and Canvas Saving work.');
}

testSaveCanvas().catch(err => {
    console.error(err);
    process.exit(1);
});
