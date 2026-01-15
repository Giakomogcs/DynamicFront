// Native fetch is available in Node 18+

async function testStreaming() {
    const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: "cursos perto de diadema",
            stream: true,
            location: { lat: -23.68, lon: -46.59 } // Mock location
        })
    });

    console.log(`Status: ${response.status}`);
    console.log(`Headers: ${JSON.stringify(Array.from(response.headers.entries()))}`);

    if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('Stream finished.');
                    break;
                }
                const chunkStr = decoder.decode(value, { stream: true });
                const lines = chunkStr.split('\n').filter(l => l.trim());
                lines.forEach(line => console.log('CHUNK:', line));
            }
        } catch(e) { console.error("Stream Error:", e); }
    } else {
        console.log('No body stream.');
    }
}

testStreaming();
