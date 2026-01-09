# Architecture Analysis

## System Overview

DynamicFront is designed as a modular **Agentic Application** that bridges a Generative UI (Frontend) with a dynamic Tool Registry (Backend).

### Core Components

```mermaid
graph TD
    User[User] -->|Chat/Interaction| Client[Frontend (React)]
    Client -->|HTTP Requests| Bridge[API Bridge (Express)]
    
    subgraph Backend
        Bridge -->|LLM Context| Gemini[Google Gemini API]
        Bridge -->|Tool Discovery| Service[ToolService]
        Service -->|Query| Registry[(Postgres Registry)]
        Service -->|Execute| HandlerAPI[API Handler]
        Service -->|Execute| HandlerDB[DB Handler]
    end
    
    HandlerAPI -->|Fetch| ExternalAPI[External APIs (Swagger)]
    HandlerDB -->|SQL| ExternalDB[External Databases]
```

## Component Analysis

### 1. Frontend (`client/`)
-   **Tech**: React, Vite, Tailwind CSS v4.
-   **Role**: Handles user interaction and renders "Dynamic Widgets" (Charts/Tables) based on structured JSON returned by the Agent.
-   **Key Feature**: The `DynamicWidget` component is a polymorphic renderer that allows the LLM to control the UI presentation layer.

### 2. Backend Bridge (`server/api_server.js`)
-   **Tech**: APIs (Express).
-   **Role**: Main entry point for the Chat.
-   **Responsibility**:
    1.  Receives user prompt.
    2.  Fetches available tools from `ToolService`.
    3.  Converts tools to Gemini format.
    4.  Manages the Agent Loop (Model -> Tool Call -> Result -> Model).

### 3. Tool Service (`server/services/toolService.js`)
-   **Tech**: Node.js, Prisma.
-   **Role**: Source of Truth for capabilities.
-   **Innovation**:
    -   **Static Tools**: Hardcoded management tools (register_api).
    -   **Dynamic Tools**: generated at runtime by inspecting database rows (`VerifiedApi`, `VerifiedDb`). The service abstracts this complexity, presenting a unified `executeTool` interface.

### 4. Registry (`server/prisma/`)
-   **Tech**: PostgreSQL.
-   **Role**: Secure storage of configurations.
-   **Schema**:
    -   `VerifiedApi`: Stores OpenAPI spec URLs and Auth configs.
    -   `VerifiedDb`: Stores connection strings.

## Scalability & Improvements

-   **Current State**: Monolithic Backend (Bridge + MCP Server logic in same repo).
-   **For Scale**: 
    -   The `ToolService` could be split into microservices per integration type.
    -   Redis could cache the OpenAPI parsing results to speed up cold starts.
    -   A Queue system (BullMQ) could handle long-running data fetch tasks.

## Security Considerations

-   **Database Access**: The Agent has direct SQL execution capabilities.
    -   *Mitigation*: Ensure registered DB users are Read-Only.
-   **API Auth**: Tokens are stored in Postgres.
    -   *Improvement*: Use encryption at rest for the `authConfig` field.
