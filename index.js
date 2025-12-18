#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Sua chave API da NASA (obtenha em https://api.nasa.gov/)
const NASA_API_KEY = process.env.NASA_API_KEY;
const NASA_BASE_URL = "https://api.nasa.gov";

class NasaMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "nasa-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // Lista as ferramentas disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_apod",
          description: "Obtém a Astronomy Picture of the Day (APOD) da NASA. Pode buscar a imagem de hoje ou de uma data específica.",
          inputSchema: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "Data no formato YYYY-MM-DD (opcional, padrão é hoje)",
              },
              hd: {
                type: "boolean",
                description: "Se true, retorna a URL da imagem em alta definição",
                default: false,
              },
            },
          },
        },
        {
          name: "search_nasa_images",
          description: "Busca imagens, vídeos e áudios no arquivo da NASA",
          inputSchema: {
            type: "object",
            properties: {
              q: {
                type: "string",
                description: "Termo de busca (obrigatório)",
              },
              media_type: {
                type: "string",
                description: "Tipo de mídia: 'image', 'video' ou 'audio'",
                enum: ["image", "video", "audio"],
              },
              year_start: {
                type: "string",
                description: "Ano inicial (YYYY)",
              },
              year_end: {
                type: "string",
                description: "Ano final (YYYY)",
              },
            },
            required: ["q"],
          },
        },
        {
          name: "get_mars_rover_photos",
          description: "Obtém fotos dos rovers de Marte (Curiosity, Opportunity, Spirit)",
          inputSchema: {
            type: "object",
            properties: {
              rover: {
                type: "string",
                description: "Nome do rover",
                enum: ["curiosity", "opportunity", "spirit"],
                default: "curiosity",
              },
              sol: {
                type: "number",
                description: "Sol marciano (dia em Marte)",
              },
              earth_date: {
                type: "string",
                description: "Data terrestre (YYYY-MM-DD)",
              },
              camera: {
                type: "string",
                description: "Câmera específica (ex: FHAZ, RHAZ, MAST, CHEMCAM, MAHLI, NAVCAM)",
              },
            },
            required: ["rover"],
          },
        },
        {
          name: "get_neo_feed",
          description: "Obtém dados sobre asteroides próximos à Terra (Near Earth Objects)",
          inputSchema: {
            type: "object",
            properties: {
              start_date: {
                type: "string",
                description: "Data inicial (YYYY-MM-DD, padrão é hoje)",
              },
              end_date: {
                type: "string",
                description: "Data final (YYYY-MM-DD, máximo 7 dias após start_date)",
              },
            },
          },
        },
        {
          name: "get_earth_imagery",
          description: "Obtém imagens de satélite da Terra em coordenadas específicas",
          inputSchema: {
            type: "object",
            properties: {
              lat: {
                type: "number",
                description: "Latitude",
              },
              lon: {
                type: "number",
                description: "Longitude",
              },
              date: {
                type: "string",
                description: "Data (YYYY-MM-DD)",
              },
              dim: {
                type: "number",
                description: "Largura e altura da imagem em graus (padrão 0.025)",
                default: 0.025,
              },
            },
            required: ["lat", "lon"],
          },
        },
      ],
    }));

    // Executa as ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "get_apod":
            return await this.getAPOD(args);
          case "search_nasa_images":
            return await this.searchNasaImages(args);
          case "get_mars_rover_photos":
            return await this.getMarsRoverPhotos(args);
          case "get_neo_feed":
            return await this.getNEOFeed(args);
          case "get_earth_imagery":
            return await this.getEarthImagery(args);
          default:
            throw new Error(`Ferramenta desconhecida: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Erro: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async getAPOD(args) {
    const params = new URLSearchParams({
      api_key: NASA_API_KEY,
      ...(args.date && { date: args.date }),
      ...(args.hd && { hd: "true" }),
    });

    const response = await fetch(`${NASA_BASE_URL}/planetary/apod?${params}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || "Erro ao buscar APOD");
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  async searchNasaImages(args) {
    const params = new URLSearchParams({
      q: args.q,
      ...(args.media_type && { media_type: args.media_type }),
      ...(args.year_start && { year_start: args.year_start }),
      ...(args.year_end && { year_end: args.year_end }),
    });

    const response = await fetch(
      `https://images-api.nasa.gov/search?${params}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error("Erro ao buscar imagens da NASA");
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  async getMarsRoverPhotos(args) {
    const { rover, sol, earth_date, camera } = args;
    const params = new URLSearchParams({
      api_key: NASA_API_KEY,
      ...(sol && { sol: sol.toString() }),
      ...(earth_date && { earth_date }),
      ...(camera && { camera }),
    });

    const response = await fetch(
      `${NASA_BASE_URL}/mars-photos/api/v1/rovers/${rover}/photos?${params}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Erro ao buscar fotos do rover");
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  async getNEOFeed(args) {
    const today = new Date().toISOString().split("T")[0];
    const params = new URLSearchParams({
      api_key: NASA_API_KEY,
      start_date: args.start_date || today,
      ...(args.end_date && { end_date: args.end_date }),
    });

    const response = await fetch(`${NASA_BASE_URL}/neo/rest/v1/feed?${params}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_message || "Erro ao buscar dados de NEO");
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  async getEarthImagery(args) {
    const params = new URLSearchParams({
      lat: args.lat.toString(),
      lon: args.lon.toString(),
      dim: (args.dim || 0.025).toString(),
      api_key: NASA_API_KEY,
      ...(args.date && { date: args.date }),
    });

    const response = await fetch(
      `${NASA_BASE_URL}/planetary/earth/imagery?${params}`
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.msg || "Erro ao buscar imagem da Terra");
    }

    const imageUrl = response.url;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ url: imageUrl }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("NASA MCP Server rodando no stdio");
  }
}

const server = new NasaMCPServer();
server.run().catch(console.error);