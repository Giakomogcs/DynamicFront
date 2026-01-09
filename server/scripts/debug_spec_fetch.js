
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function run() {
    const url = "https://api.aprendizagem-busca-curso.dev.senai.br/api/docs-json";
    console.log("Fetching:", url);
    try {
        const res = await fetch(url);
        console.log("Status:", res.status);
        console.log("Type:", res.headers.get('content-type'));
        const text = await res.text();
        console.log("Body Preview:", text.substring(0, 500));
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}
run();
