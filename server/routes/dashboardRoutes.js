/**
 * Dashboard Routes for v2.0
 * Complex query endpoint with streaming support
 */

import express from 'express';

const router = express.Router();

// Mock User Manager integration (reuse from authRoutes)
const KNOWN_USERS = [
  {
    id: 'user_admin',
    email: 'admin@dynamicfront.com',
    name: 'Admin User',
    role: 'admin',
  },
];

/**
 * POST /api/dashboard/complex-query
 * Streams large datasets progressively using Server-Sent Events
 */
router.post('/complex-query', async (req, res) => {
  try {
    const { userQuery } = req.body;

    if (!userQuery) {
      return res.status(400).json({
        success: false,
        error: 'userQuery is required',
      });
    }

    console.log(`[Dashboard] Complex query: "${userQuery}"`);

    // Get authenticated user (fallback to default)
    const user = KNOWN_USERS[0]; // Using fallback until real auth is integrated

    // Detect query complexity (simplified - in real app, use QueryPlanner)
    const lowerQuery = userQuery.toLowerCase();
    const isComplex =
      lowerQuery.includes('dashboard') ||
      lowerQuery.includes('todos') ||
      lowerQuery.includes('análise') ||
      lowerQuery.includes('tendência');

    // For simple queries, return immediately
    if (!isComplex) {
      return res.json({
        success: true,
        data: [{ message: 'Simple query result', query: userQuery }],
        simple: true,
      });
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Generate initial HTML (would use StreamingRenderer in real implementation)
    const initialHTML = generateSimpleHTML(userQuery);
    res.write(`data: ${JSON.stringify({ type: 'html', html: initialHTML })}\n\n`);

    // Simulate data fetching and chunking
    // In real implementation, this would:
    // 1. Use QueryPlanner.plan(userQuery)
    // 2. Execute sub-queries with ParallelExecutor
    // 3. Transform results with DataTransformer.chunkData()
    // 4. Stream each chunk progressively

    const mockData = generateMockData(1000); // 1000 records
    const chunkSize = 200;
    const totalChunks = Math.ceil(mockData.length / chunkSize);

    // Stream chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, mockData.length);
      const chunkData = mockData.slice(start, end);

      const chunk = {
        type: 'chunk',
        chunk: {
          chunkId: `chunk_${i + 1}_of_${totalChunks}`,
          chunkIndex: i,
          totalChunks,
          data: chunkData,
          metadata: {
            title: `Chunk ${i + 1}/${totalChunks}`,
            recordCount: chunkData.length,
            estimatedRenderTimeMs: 100 + chunkData.length * 0.5,
          },
        },
      };

      res.write(`data: ${JSON.stringify(chunk)}\n\n`);

      // Simulate processing delay
      await delay(100);
    }

    // Send completion signal
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    res.end();

    console.log(`[Dashboard] Query completed: ${totalChunks} chunks streamed`);
  } catch (error) {
    console.error('[Dashboard] Error in complex-query:', error);

    // Send error through SSE
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: error.message || 'Unknown error',
      })}\n\n`
    );
    res.end();
  }
});

/**
 * Generate simple HTML for streaming
 */
function generateSimpleHTML(title) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 0;
      padding: 2rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    .progress-bar {
      background: rgba(255, 255, 255, 0.2);
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 1rem;
    }
    .progress-fill {
      background: #4ade80;
      height: 100%;
      width: 0%;
      transition: width 0.3s;
    }
    .content {
      padding: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <div class="progress-bar">
        <div class="progress-fill" id="progress"></div>
      </div>
      <p id="status">Carregando...</p>
    </div>
    <div class="content" id="content"></div>
  </div>
  <script>
    // This would be populated by streaming chunks
  </script>
</body>
</html>`;
}

/**
 * Generate mock data for testing
 */
function generateMockData(count) {
  const data = [];
  const categories = ['Tecnologia', 'Saúde', 'Educação', 'Negócios', 'Design'];
  const locations = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Brasília', 'Curitiba'];

  for (let i = 0; i < count; i++) {
    data.push({
      id: `item_${i + 1}`,
      name: `Item ${i + 1}`,
      category: categories[i % categories.length],
      location: locations[i % locations.length],
      value: Math.floor(Math.random() * 1000) + 100,
      status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'completed',
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return data;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default router;
