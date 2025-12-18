# NASA MCP Server

Este é um projeto de estudo que implementa um servidor MCP (Model Context Protocol) para acessar APIs públicas da NASA. O servidor fornece ferramentas para buscar imagens astronômicas, fotos de rovers marcianos, asteroides próximos à Terra e muito mais.

## 📚 Sobre o Projeto

Este é um projeto educacional para aprender sobre:
- Model Context Protocol (MCP)
- APIs públicas da NASA
- Desenvolvimento de servidores em Node.js
- Integração com ferramentas de IA

## 🚀 Funcionalidades

O servidor oferece as seguintes ferramentas:

1. **get_apod** - Astronomy Picture of the Day (imagem astronômica do dia)
2. **search_nasa_images** - Busca no arquivo de imagens/vídeos/áudios da NASA
3. **get_mars_rover_photos** - Fotos dos rovers de Marte (Curiosity, Opportunity, Spirit)
4. **get_neo_feed** - Dados sobre asteroides próximos à Terra
5. **get_earth_imagery** - Imagens de satélite da Terra

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn
- Chave API da NASA (gratuita)

## 🔑 Obtendo a Chave API da NASA

1. Acesse https://api.nasa.gov/
2. Preencha o formulário com seu nome e email
3. Você receberá sua chave API instantaneamente
4. Salve a chave para usar no próximo passo

## ⚙️ Instalação

1. Clone ou baixe este repositório

2. Instale as dependências:
```bash
npm install
```

3. Configure a variável de ambiente com sua chave API da NASA:

**No Linux/Mac:**
```bash
export NASA_API_KEY="sua_chave_aqui"
```

**No Windows (CMD):**
```cmd
set NASA_API_KEY=sua_chave_aqui
```

**No Windows (PowerShell):**
```powershell
$env:NASA_API_KEY="sua_chave_aqui"
```

## 🏃 Como Rodar

### Modo de Desenvolvimento

Execute o servidor diretamente:
```bash
node index.js
```

### Instalação Global

Para instalar o servidor como um comando global:
```bash
npm install -g .
```

Depois você pode executar de qualquer lugar:
```bash
nasa-mcp-server
```

## 🧪 Testando

O servidor usa comunicação stdio (entrada/saída padrão), então é melhor testá-lo integrado com um cliente MCP ou ferramenta compatível (como Claude Desktop ou outras aplicações que suportam MCP).

### Exemplo de Configuração para Claude Desktop

Adicione ao arquivo de configuração do Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nasa": {
      "command": "node",
      "args": ["/caminho/completo/para/index.js"],
      "env": {
        "NASA_API_KEY": "sua_chave_aqui"
      }
    }
  }
}
```

## 📖 Exemplos de Uso

Quando integrado com um cliente MCP, você pode fazer perguntas como:

- "Mostre a imagem astronômica do dia"
- "Busque fotos do rover Curiosity"
- "Quais asteroides estão próximos da Terra hoje?"
- "Mostre imagens de satélite das coordenadas -23.5505, -46.6333"

## 🛠️ Estrutura do Projeto

```
nasa-mcp-server/
├── index.js       # Código principal do servidor
├── package.json   # Configurações e dependências
└── README.md      # Este arquivo
```

## 📚 Recursos de Aprendizado

- [NASA APIs](https://api.nasa.gov/) - Documentação oficial das APIs
- [Model Context Protocol](https://modelcontextprotocol.io/) - Especificação do MCP
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - SDK usado neste projeto

## 📝 Licença

ISC

## 🤝 Contribuindo

Este é um projeto de estudo! Sinta-se à vontade para fazer fork, experimentar e aprender.

## ⚠️ Notas

- A chave API gratuita da NASA tem limite de 1000 requisições por hora
- Algumas APIs podem ter disponibilidade limitada de dados históricos
- Este projeto é apenas para fins educacionais
