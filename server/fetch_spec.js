
import fs from 'fs';

async function fetchSpec() {
    const url = "https://api.aprendizagem-busca-curso.dev.senai.br/api/docs-json";
    const auth = Buffer.from("dn:dn-senai@25").toString('base64');

    const res = await fetch(url, {
        headers: {
            'Authorization': `Basic ${auth}`
        }
    });

    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    const json = await res.json();
    fs.writeFileSync('spec.json', JSON.stringify(json, null, 2));
    console.log("Spec saved to spec.json");
}

fetchSpec().catch(console.error);
