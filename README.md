# DynamicFront

**DynamicFront** is an Agentic Web Application that generates UI on-the-fly based on data from dynamically registered APIs and Databases.

## 🏗 Architecture

The project is structured as a monorepo:

-   **`server/`**: The Backend Core.
    -   **MCP Server**: Implements the Model Context Protocol to expose tools.
    -   **API Registry**: Uses **Prisma** & **PostgreSQL** to manage API credentials and DB connections.
    -   **Dynamic Handlers**: Logic that parses OpenAPI specs and inspects SQL schemas at runtime.
    -   **Bridge API**: An Express server that connects the Frontend to Google Gemini + MCP Tools.

-   **`client/`**: The Frontend.
    -   **React + Vite**: Fast, modern UI.
    -   **Agentic Canvas**: A chat interface capable of rendering **Rich Widgets** (Charts, Tables) based on structured JSON responses from the Agent.

## 🚀 Getting Started

### Prerequisites
-   Node.js 18+
-   PostgreSQL Database
-   Google Gemini API Key

### Installation

1.  **Configure Backend**:
    Copy `server/.env` example and update credentials.
    ```bash
    cd server
    npm install
    3.  **Start Database**:
        ```bash
        docker-compose up -d
        ```

    4.  **Setup Database Schema**:
        ```bash
        cd server
        npx prisma migrate dev --name init
        ```

2.  **Configure Frontend**:
    ```bash
    cd client
    npm install
    ```

### Running

### Running

1.  Start everything (Frontend + Backend) from the root:
    ```bash
    npm run dev
    ```

    *Alternatively, you can run them separately as before.*

2.  Open http://localhost:5173

3.  Open http://localhost:5173

## 📚 Features

-   **Dynamic API Registration**: Feed it a Swagger URL, and it learns the tools instantly.
-   **Database Exploration**: Connect a Postgres DB and ask questions about your data.
-   **Generative UI**: The AI chooses when to show a Bar Chart, Line Chart, or Data Table.
