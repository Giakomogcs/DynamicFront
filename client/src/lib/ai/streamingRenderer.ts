/**
 * Streaming Renderer
 * Generates HTML templates and JSON chunks for progressive rendering
 */

import type { DataChunk } from '@/types/ai';

/**
 * Generate initial HTML shell for streaming response
 */
export function generateInitialHTML(title: string = 'Dashboard'): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    
    .progress-container {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      height: 8px;
      margin-top: 1rem;
      overflow: hidden;
    }
    
    .progress-bar {
      background: #4ade80;
      height: 100%;
      width: 0%;
      transition: width 0.3s ease;
      box-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
    }
    
    .status {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      opacity: 0.9;
    }
    
    .chunks {
      padding: 2rem;
    }
    
    .chunk {
      margin-bottom: 2rem;
      animation: fadeIn 0.3s ease;
    }
    
    .chunk-header {
      background: #f3f4f6;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .chunk-title {
      font-weight: 600;
      color: #1f2937;
    }
    
    .chunk-badge {
      background: #667eea;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    
    .data-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }
    
    .data-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .data-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .complete {
      text-align: center;
      padding: 2rem;
      color: #10b981;
      font-weight: 600;
      font-size: 1.125rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <div class="progress-container">
        <div class="progress-bar" id="progress"></div>
      </div>
      <div class="status" id="status">Carregando dados...</div>
    </div>
    <div class="chunks" id="chunks"></div>
  </div>
  
  <script>
    const chunksContainer = document.getElementById('chunks');
    const progressBar = document.getElementById('progress');
    const statusText = document.getElementById('status');
    
    let totalChunks = 0;
    let loadedChunks = 0;
    
    // Listen for messages from server
    window.addEventListener('message', (event) => {
      const { type, chunk } = event.data;
      
      if (type === 'chunk') {
        handleChunk(chunk);
      } else if (type === 'complete') {
        handleComplete();
      }
    });
    
    function handleChunk(chunk) {
      totalChunks = chunk.totalChunks;
      loadedChunks++;
      
      // Update progress
      const progress = (loadedChunks / totalChunks) * 100;
      progressBar.style.width = progress + '%';
      statusText.textContent = \`Carregando \${loadedChunks}/\${totalChunks} chunks...\`;
      
      // Render chunk
      const chunkElement = document.createElement('div');
      chunkElement.className = 'chunk';
      chunkElement.innerHTML = \`
        <div class="chunk-header">
          <div class="chunk-title">\${chunk.metadata.title}</div>
          <div class="chunk-badge">\${chunk.metadata.recordCount} registros</div>
        </div>
        <div class="data-grid">
          \${chunk.data.map(item => \`
            <div class="data-item">
              <pre style="font-size: 0.75rem; overflow-x: auto;">\${JSON.stringify(item, null, 2)}</pre>
            </div>
          \`).join('')}
        </div>
      \`;
      
      chunksContainer.appendChild(chunkElement);
    }
    
    function handleComplete() {
      progressBar.style.width = '100%';
      statusText.textContent = 'Completo! ✓';
      
      const completeMessage = document.createElement('div');
      completeMessage.className = 'complete';
      completeMessage.textContent = '🎉 Todos os dados foram carregados com sucesso!';
      chunksContainer.appendChild(completeMessage);
    }
  </script>
</body>
</html>`;
}

/**
 * Generate JSON representation of a chunk for streaming
 */
export function generateChunkJSON(chunk: DataChunk): string {
  return JSON.stringify({
    type: 'chunk',
    chunk: {
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
      data: chunk.data,
      metadata: chunk.metadata,
    },
  });
}

/**
 * Generate completion signal
 */
export function generateCompleteJSON(): string {
  return JSON.stringify({
    type: 'complete',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Generate streaming event for Server-Sent Events
 */
export function generateSSE(data: string): string {
  return `data: ${data}\n\n`;
}
