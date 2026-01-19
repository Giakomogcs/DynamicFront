
import { designerAgent } from '../server/agents/Designer.js';
import { storageService } from '../server/services/storageService.js';

// Dados simulados que o Executor teria retornado após consultar a API da Petrobras
const mockExecutorData = [
    {
        "tool": "api_enterprise__list",
        "result": {
            "matriz": {
                "uf": "RJ",
                "municipio": "Rio de Janeiro",
                "foco": "Refino de petróleo",
                "cnae": "1921-7/00"
            },
            "filiais": [
                { "uf": "BA", "municipio": "Ilhéus", "foco": "Refino de petróleo" },
                { "uf": "CE", "municipio": "Fortaleza", "foco": "Refino de petróleo" },
                { "uf": "RJ", "municipio": "Rio de Janeiro (Maracanã)", "foco": "Refino de petróleo" },
                { "uf": "RJ", "municipio": "Duque de Caxias", "foco": "Refino de petróleo" },
                { "uf": "RN", "municipio": "RN-221", "foco": "Refino de petróleo" },
                { "uf": "SE", "municipio": "Laranjeiras", "foco": "Refino de petróleo" }
            ]
        }
    }
];

const summaryText = "Encontrei a matriz e diversas filiais da Petrobras, todas com foco principal em Refino de Petróleo.";

async function runTest() {
    console.log("Iniciando teste do Designer Agent...");

    // 1. Gerar Design (Widgets)
    const designResult = await designerAgent.design(
        summaryText,
        mockExecutorData,
        "gemini-2.0-flash", // Workhorse model
        [{ title: "Buscar Filiais", status: "completed" }]
    );

    console.log("Designer gerou widgets:", designResult.widgets.length);

    let finalWidgets = designResult.widgets;

    // FALLBACK MANUAL (Se a IA falhar ou retornar vazio, garantimos a tela para o usuário)
    if (!finalWidgets || finalWidgets.length === 0) {
        console.log("⚠️ Designer retornou vazio. Usando layout manual de fallback para garantir a visualização.");
        finalWidgets = [
            {
                "type": "process",
                "title": "Fluxo de Execução",
                "steps": [{ "title": "Buscar Filiais", "status": "completed" }]
            },
            {
                "type": "stat",
                "data": [
                    { "label": "Total de Filiais/Matriz", "value": "7", "icon": "business" },
                    { "label": "Foco Principal", "value": "Refino", "icon": "factory" }
                ]
            },
            {
                "type": "table",
                "title": "Lista de Unidades Petrobras",
                "data": [
                    { "Tipo": "Matriz", "UF": "RJ", "Cidade": "Rio de Janeiro", "Foco": "Refino de petróleo" },
                    { "Tipo": "Filial", "UF": "BA", "Cidade": "Ilhéus", "Foco": "Refino de petróleo" },
                    { "Tipo": "Filial", "UF": "CE", "Cidade": "Fortaleza", "Foco": "Refino de petróleo" },
                    { "Tipo": "Filial", "UF": "RJ", "Cidade": "Rio de Janeiro (Maracanã)", "Foco": "Refino de petróleo" },
                    { "Tipo": "Filial", "UF": "RJ", "Cidade": "Duque de Caxias", "Foco": "Refino de petróleo" },
                    { "Tipo": "Filial", "UF": "RN", "Cidade": "RN-221", "Foco": "Refino de petróleo" },
                    { "Tipo": "Filial", "UF": "SE", "Cidade": "Laranjeiras", "Foco": "Refino de petróleo" }
                ],
                "actions": [
                    { "label": "Ver Detalhes", "type": "tool_call", "tool": "api_enterprise__details", "style": "primary" }
                ]
            },
            {
                "type": "insight",
                "title": "Análise de Distribuição",
                "content": "A empresa concentra suas operações de refino majoritariamente no estado do Rio de Janeiro (sede), com presença estratégica em polos do Nordeste (BA, CE, RN, SE).",
                "sentiment": "neutral"
            }
        ];
    }

    // 2. Salvar Canvas
    const canvasId = "canvas_filiais_petrobras";
    await storageService.saveCanvas(
        canvasId,
        "Filiais Petrobras (Consolidado)",
        finalWidgets,
        [],
        "demo_group"
    );

    console.log(`Canvas salvo com sucesso: ID ${canvasId}`);
}

runTest().catch(console.error);
