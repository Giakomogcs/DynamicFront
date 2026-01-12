# DynamicFront

**Aplicação Agêntica com Arquitetura MCP (Model Context Protocol)** que gera interfaces dinâmicas baseadas em dados de APIs REST e Bancos de Dados conectados via servidores MCP dedicados.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Arquitetura](#-arquitetura)
- [Componentes](#-componentes)
- [Fluxos](#-fluxos)
- [Instalação](#-instalação)
- [Uso](#-uso)
- [Funcionalidades](#-funcionalidades)
- [Testes](#-testes)
- [Desenvolvimento](#-desenvolvimento)

---

## 🎯 Visão Geral

DynamicFront é uma plataforma que permite:
- **Conectar APIs REST** via OpenAPI/Swagger
- **Conectar Bancos de Dados** (PostgreSQL, MySQL)
- **Gerar ferramentas automaticamente** usando MCP
- **Executar queries via chat** com múltiplos modelos de IA
- **Visualizar dados** em gráficos e tabelas gerados dinamicamente

### Conceito Chave: "1 Recurso = 1 Servidor MCP"

Cada API ou DB registrado spawna um **servidor MCP dedicado** que expõe ferramentas via protocolo padrão.

---

## 🏗 Arquitetura

### Diagrama de Alto Nível

```mermaid
graph TB
    subgraph Client [Frontend - React]
        UI[Interface de Chat]
        Canvas[Dynamic Canvas]
        Resources[Gerenciamento de Recursos]
    end

    subgraph Server [Backend - Node.js]
        API[API Server Express]
        Orch[Orchestrator]
        Exec[Executor Agent]
        ToolSvc[Tool Service]
        McpMgr[MCP Client Manager]
    end

    subgraph MCP [Servidores MCP]
        FS[Filesystem Server]
        PG1[Postgres Server 1]
        PG2[Postgres Server 2]
        API1[OpenAPI Wrapper 1]
        API2[OpenAPI Wrapper 2]
    end

    subgraph Data [Persistência]
        DB[(PostgreSQL Registry)]
    end

    subgraph AI [Provedores de IA]
        Gemini[Google Gemini]
        Groq[Groq Llama]
        Claude[Anthropic Claude]
        GPT[OpenAI GPT]
    end

    UI -->|HTTP| API
    API --> Orch
    Orch --> Exec
    Exec --> ToolSvc
    ToolSvc --> McpMgr
    
    McpMgr -->|Stdio| FS
    McpMgr -->|Stdio| PG1
    McpMgr -->|Stdio| PG2
    McpMgr -->|Stdio| API1
    McpMgr -->|Stdio| API2
    
    McpMgr -.->|Lê Config| DB
    Exec -->|Inference| Gemini
    Exec -->|Inference| Groq
    Exec -->|Inference| Claude
    Exec -->|Inference| GPT
```

### Camadas da Aplicação

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|------------------|
| **Frontend** | React + Vite + Tailwind v4 | Interface de usuário, widgets dinâmicos |
| **API Bridge** | Express | Endpoints REST, gerenciamento de sessão |
| **Orchestrator** | Node.js | Coordena fluxo entre agentes |
| **Executor** | Node.js | Executa loop de inferência + tool calling |
| **MCP Client** | SDK Oficial | Gerencia conexões com servidores MCP |
| **MCP Servers** | Stdio Transport | Expõem ferramentas via protocolo padrão |
| **Registry** | Prisma + PostgreSQL | Armazena configurações de recursos |

---

## 🧩 Componentes

### Backend

#### 1. MCP Client Manager (`services/mcpClientService.js`)

**Responsabilidades:**
- Spawn dinâmico de servidores MCP por recurso
- Gerenciamento de processos (Stdio Transport)
- Agregação de ferramentas de múltiplos servidores
- Reload automático quando recursos mudam

**Código-chave:**
```javascript
async initialize() {
    // 1. Servidores estáticos
    await this.connectToServer('filesystem', {...});
    
    // 2. DBs habilitados
    const dbs = await prisma.verifiedDb.findMany({ 
        where: { isEnabled: true } 
    });
    for (const db of dbs) {
        await this.spawnDbServer(db);
    }
    
    // 3. APIs habilitadas
    const apis = await prisma.verifiedApi.findMany({ 
        where: { isEnabled: true } 
    });
    for (const api of apis) {
        await this.spawnApiServer(api);
    }
}
```

#### 2. OpenAPI Wrapper (`mcp-servers/openapi-wrapper.js`)

**Servidor MCP customizado** que:
- Lê specs OpenAPI/Swagger
- Gera ferramentas dinamicamente
- Executa chamadas HTTP com autenticação
- Expõe via protocolo MCP

**Exemplo de ferramenta gerada:**
```json
{
  "name": "api_dn_get_courses",
  "description": "Lista cursos disponíveis",
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": { "type": "string" },
      "limit": { "type": "integer" }
    }
  }
}
```

#### 3. Tool Service (`services/toolService.js`)

**Agregador de ferramentas:**
```javascript
async getAllTools() {
    const tools = [];
    
    // Ferramentas estáticas (register_api, register_db)
    registerTools.forEach(t => tools.push(t));
    
    // Ferramentas MCP (TODAS)
    await mcpClientService.initialize();
    const mcpTools = mcpClientService.getAllTools();
    tools.push(...mcpTools);
    
    return tools;
}
```

#### 4. Executor Agent (`agents/Executor.js`)

**Loop de execução:**
1. Recebe prompt do usuário
2. Envia para modelo de IA com ferramentas disponíveis
3. Detecta function calls
4. Executa ferramentas via `ToolService`
5. Retorna resultado ao modelo
6. Repete até resposta final

**Suporte multi-provider:**
- Gemini (nativo)
- Groq, Claude, GPT (via `ToolMapper`)

### Frontend

#### 1. Chat Interface (`pages/Chat.jsx`)

- Input de mensagens
- Histórico de conversas
- Renderização de widgets dinâmicos
- Seletor de modelo de IA

#### 2. Dynamic Canvas (`components/DynamicWidget.jsx`)

Renderiza widgets baseados em JSON:
```json
{
  "type": "bar_chart",
  "data": [...],
  "config": { "xKey": "name", "yKey": "value" }
}
```

Tipos suportados:
- `bar_chart`, `line_chart`, `pie_chart`
- `data_table`
- `metric_card`

#### 3. Resource Management (`components/ResourcesView.jsx`)

- Lista APIs e DBs registrados
- Toggle enable/disable
- Edição de configurações
- Visualização de ferramentas geradas

---

## 🔄 Fluxos

### Fluxo de Chat Completo

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant Exec
    participant AI as Gemini/Groq
    participant ToolSvc
    participant McpMgr
    participant PgServer as Postgres MCP

    User->>UI: "Quantas tabelas tem no DB?"
    UI->>API: POST /api/chat
    API->>Exec: execute(prompt, tools)
    
    Exec->>AI: sendMessage(prompt + tools)
    AI-->>Exec: FunctionCall("db_xxx__list_tables")
    
    Exec->>ToolSvc: executeTool("db_xxx__list_tables")
    ToolSvc->>McpMgr: execute("db_xxx", "list_tables")
    McpMgr->>PgServer: callTool("list_tables")
    PgServer-->>McpMgr: ["users", "products", ...]
    McpMgr-->>ToolSvc: Result
    ToolSvc-->>Exec: Result
    
    Exec->>AI: sendMessage(toolResult)
    AI-->>Exec: "O banco tem 2 tabelas: users e products"
    
    Exec-->>API: Response
    API-->>UI: JSON
    UI-->>User: Exibe resposta
```

### Fluxo de Registro de API

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant Handler
    participant DB
    participant McpMgr

    User->>UI: Preenche form (specUrl, auth)
    UI->>API: POST /api/tools/execute (register_api)
    API->>Handler: processApiRegistration()
    Handler->>Handler: Fetch OpenAPI spec
    Handler->>Handler: Gera toolConfig
    Handler->>DB: INSERT VerifiedApi
    DB-->>Handler: Success
    Handler-->>API: Success
    API-->>UI: Success
    
    Note over McpMgr: Próximo chat irá spawnar servidor
```

### Fluxo de Toggle de Recurso

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant DB
    participant McpMgr

    User->>UI: Clica toggle
    UI->>API: PATCH /api/resources/api/:id/toggle
    API->>DB: UPDATE isEnabled = !current
    DB-->>API: Updated
    API->>McpMgr: reload()
    McpMgr->>McpMgr: Close all connections
    McpMgr->>McpMgr: Re-initialize (only enabled)
    McpMgr-->>API: Reloaded
    API-->>UI: Success
    UI-->>User: Visual feedback
```

---

## 🚀 Instalação

### Pré-requisitos

- **Node.js** 18+
- **PostgreSQL** 14+
- **Docker** (opcional, para DB local)
- **API Key** de pelo menos um provedor de IA

### Passo a Passo

1. **Clone o repositório**
   ```bash
   git clone <repo-url>
   cd DynamicFront
   ```

2. **Instale dependências**
   ```bash
   npm run install:all
   ```

3. **Configure o backend**
   ```bash
   cd server
   cp example.env .env
   ```
   
   Edite `.env`:
   ```env
   DATABASE_URL="postgresql://user:pass@localhost:5432/dynamic_front"
   GEMINI_API_KEY="your-key"
   # Opcional: GROQ_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY
   ```

4. **Inicie o banco de dados**
   ```bash
   npm run db:up
   ```

5. **Execute migrações**
   ```bash
   npm run migrate
   ```

6. **Inicie a aplicação**
   ```bash
   npm run dev
   ```

7. **Acesse**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

---

## 💡 Uso

### Registrar uma API

1. Acesse a página **Resources**
2. Clique em **+ Add API**
3. Preencha:
   - **Name**: Nome descritivo
   - **Base URL**: `https://api.example.com`
   - **Spec URL**: `https://api.example.com/swagger.json`
   - **Auth** (opcional): Bearer token, API Key, etc.
4. Clique em **Register**

### Registrar um Banco de Dados

1. Acesse **Resources** → **+ Add Database**
2. Preencha:
   - **Name**: Nome descritivo
   - **Type**: `postgres` ou `mysql`
   - **Connection String**: `postgresql://user:pass@host:5432/db`
3. Clique em **Register**

### Fazer Perguntas

```
Usuário: "Quais cursos estão disponíveis em São Paulo?"

Sistema:
1. Identifica ferramenta: api_dn_get_courses
2. Executa: { city: "São Paulo" }
3. Retorna: Lista de 15 cursos
4. Gera widget: Tabela com cursos
```

### Habilitar/Desabilitar Recursos

- Na página **Resources**, clique no ícone ⚡ (Power)
- Recursos desabilitados não spawnam servidores MCP
- Útil para economizar recursos ou debugar

---

## ✨ Funcionalidades

### Multi-Provider AI

Suporte para:
- **Google Gemini** (Flash, Pro)
- **Groq** (Llama 3.1, 3.3)
- **Anthropic Claude** (3.5 Sonnet)
- **OpenAI GPT** (4, 4-turbo)
- **xAI Grok**

Failover automático se um provider falhar.

### Dynamic UI Generation

A IA escolhe automaticamente:
- **Gráficos** para dados numéricos
- **Tabelas** para listas estruturadas
- **Cards** para métricas

### Resource Management

- ✅ Enable/Disable individual
- ✅ Edit configurações
- ✅ View ferramentas geradas
- ✅ Force refresh de specs

### Authentication Support

- **Bearer Token**
- **API Key** (header ou query)
- **Basic Auth**
- **Login Flow** (username/password → token)

---

## 🧪 Testes

### Teste de Integração MCP

```bash
cd server
node test_mcp_integration.js
```

**Verifica:**
- ✅ Spawn de servidores
- ✅ Descoberta de ferramentas
- ✅ Execução de tools
- ✅ Filtro por `isEnabled`

### Inspecionar Servidores MCP

```bash
# Listar recursos
node inspect_mcp_server.js api
node inspect_mcp_server.js db

# Inspecionar específico
node inspect_mcp_server.js api <apiId>
```

### Teste Manual

1. Registre uma API de teste
2. Faça uma pergunta no chat
3. Verifique logs do servidor
4. Confirme execução de ferramentas

---

## 🛠 Desenvolvimento

### Estrutura de Diretórios

```
DynamicFront/
├── client/                      # Frontend React
│   ├── src/
│   │   ├── components/         # UI components
│   │   │   ├── DynamicWidget.jsx
│   │   │   └── ResourcesView.jsx
│   │   ├── pages/              # Chat, Resources
│   │   └── App.jsx
│   └── package.json
├── server/                      # Backend Node.js
│   ├── agents/                 # Executor, Planner, Orchestrator
│   ├── config/                 # mcp_config.js
│   ├── handlers/               # register.js, auth_analyzer.js
│   ├── mcp-servers/            # openapi-wrapper.js
│   ├── services/
│   │   ├── mcpClientService.js # MCP Client Manager
│   │   ├── toolService.js      # Tool Aggregator
│   │   └── ai/                 # Model providers
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── api_server.js           # Express server
│   └── package.json
└── package.json                # Root (workspaces)
```

### Adicionar Novo Tipo de DB

1. Instale servidor MCP: `@modelcontextprotocol/server-mysql`
2. Atualize `mcpClientService.spawnDbServer()`:
   ```javascript
   if (dbConfig.type === 'mysql') {
       command = "npx";
       args = ["-y", "@modelcontextprotocol/server-mysql", dbConfig.connectionString];
   }
   ```

### Adicionar Novo Provider de IA

1. Crie `services/ai/providers/NewProvider.js`
2. Implemente interface:
   ```javascript
   async generateContent(messages, options) {
       // Retorna { response, usedModel }
   }
   ```
3. Registre em `ModelManager.js`

### Debugging

**Logs do servidor:**
```bash
tail -f server/server.log
```

**Logs de servidores MCP:**
- Aparecem no stderr do processo pai
- Prefixados com `[McpClient]` ou `[OpenAPI MCP]`

---

## 📚 Documentação Adicional

- **Arquitetura**: Ver `ARCHITECTURE.md`
- **Guia para Agentes**: Ver `agents.md`
- **MCP Inspector**: Ver `brain/mcp_inspector_guide.md`
- **Walkthrough**: Ver `brain/walkthrough.md`

---

## 🤝 Contribuindo

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(mcp): adiciona suporte para MySQL
fix(ui): corrige toggle de recursos
docs(readme): atualiza guia de instalação
```

---

## 📄 Licença

MIT

---

## 🙏 Agradecimentos

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Google Gemini](https://ai.google.dev/)
- [Prisma](https://www.prisma.io/)
