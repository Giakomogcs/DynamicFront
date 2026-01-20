/**
 * AI Analyzer
 * Determines user intent and required actions (create/update/delete canvas)
 */

import type { ActionDecision, CanvasChange } from '@/types/ai';
import type { Session, Canvas } from '@/types';

/**
 * Analyze user request and determine action
 */
export function analyzeUserRequest(
  userMessage: string,
  session: Session,
  currentCanvas?: Canvas
): ActionDecision {
  const lowerMessage = userMessage.toLowerCase();

  // Pattern: Create new canvas
  if (
    lowerMessage.includes('criar') ||
    lowerMessage.includes('novo') ||
    lowerMessage.includes('nova') ||
    lowerMessage.includes('create')
  ) {
    return {
      type: 'create',
      suggestedName: extractCanvasName(userMessage) || 'Novo Canvas',
      reasoning: 'Usuário solicitou criação de novo canvas',
      confidence: 0.9,
    };
  }

  // Pattern: Update existing canvas
  if (
    lowerMessage.includes('adicionar') ||
    lowerMessage.includes('adicione') ||
    lowerMessage.includes('inclua') ||
    lowerMessage.includes('editar') ||
    lowerMessage.includes('modificar') ||
    lowerMessage.includes('atualizar') ||
    lowerMessage.includes('add') ||
    lowerMessage.includes('update')
  ) {
    if (!currentCanvas) {
      // No canvas selected, create new one
      return {
        type: 'create',
        suggestedName: 'Canvas de Atualização',
        reasoning: 'Solicitação de adição mas nenhum canvas selecionado',
        confidence: 0.7,
      };
    }

    // Determine what section to update
    const changes = determineChanges(userMessage, lowerMessage);

    return {
      type: 'update',
      targetCanvas: {
        id: currentCanvas.id,
        name: currentCanvas.name,
      },
      changes,
      reasoning: 'Usuário solicitou adição/edição no canvas atual',
      confidence: 0.85,
    };
  }

  // Pattern: Delete canvas
  if (
    lowerMessage.includes('remover') ||
    lowerMessage.includes('deletar') ||
    lowerMessage.includes('excluir') ||
    lowerMessage.includes('apagar') ||
    lowerMessage.includes('delete') ||
    lowerMessage.includes('remove')
  ) {
    if (!currentCanvas) {
      return {
        type: 'none',
        reasoning: 'Solicitação de remoção mas nenhum canvas selecionado',
        confidence: 0.5,
      };
    }

    return {
      type: 'delete',
      targetCanvas: {
        id: currentCanvas.id,
        name: currentCanvas.name,
      },
      reasoning: 'Usuário solicitou remoção do canvas',
      confidence: 0.9,
    };
  }

  // Pattern: Link canvases
  if (
    lowerMessage.includes('conectar') ||
    lowerMessage.includes('linkar') ||
    lowerMessage.includes('vincular') ||
    lowerMessage.includes('link')
  ) {
    return {
      type: 'link',
      reasoning: 'Usuário solicitou conexão entre canvases',
      confidence: 0.8,
    };
  }

  // Default: Informational query, no canvas changes
  return {
    type: 'none',
    reasoning: 'Consulta informacional, sem modificação de canvas',
    confidence: 0.95,
  };
}

/**
 * Extract suggested canvas name from user message
 */
function extractCanvasName(message: string): string | null {
  // Pattern: "criar canvas de [nome]"
  const patterns = [
    /criar\s+(?:canvas\s+)?(?:de\s+|para\s+)?([^.,!?]+)/i,
    /novo\s+(?:canvas\s+)?(?:de\s+|para\s+)?([^.,!?]+)/i,
    /create\s+(?:canvas\s+)?(?:for\s+|of\s+)?([^.,!?]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Capitalize first letter
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  return null;
}

/**
 * Determine what changes to make to canvas
 */
function determineChanges(message: string, lowerMessage: string): CanvasChange[] {
  const changes: CanvasChange[] = [];

  // Detect HTML changes
  if (
    lowerMessage.includes('elemento') ||
    lowerMessage.includes('seção') ||
    lowerMessage.includes('componente') ||
    lowerMessage.includes('div') ||
    lowerMessage.includes('botão') ||
    lowerMessage.includes('tabela') ||
    lowerMessage.includes('gráfico')
  ) {
    changes.push({
      section: 'html',
      operation: 'append',
      content: '<!-- New content to be generated -->',
    });
  }

  // Detect CSS changes
  if (
    lowerMessage.includes('estilo') ||
    lowerMessage.includes('cor') ||
    lowerMessage.includes('css') ||
    lowerMessage.includes('design') ||
    lowerMessage.includes('aparência')
  ) {
    changes.push({
      section: 'css',
      operation: 'append',
      content: '/* New styles to be generated */',
    });
  }

  // Detect JS changes
  if (
    lowerMessage.includes('funcionalidade') ||
    lowerMessage.includes('interação') ||
    lowerMessage.includes('evento') ||
    lowerMessage.includes('script') ||
    lowerMessage.includes('javascript')
  ) {
    changes.push({
      section: 'js',
      operation: 'append',
      content: '// New functionality to be generated',
    });
  }

  // Default: assume HTML change if nothing specific detected
  if (changes.length === 0) {
    changes.push({
      section: 'html',
      operation: 'append',
      content: '<!-- Content based on user request -->',
    });
  }

  return changes;
}

/**
 * Determine if request is canvas-related
 */
export function isCanvasRelated(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  const canvasKeywords = [
    'canvas',
    'criar',
    'novo',
    'adicionar',
    'remover',
    'deletar',
    'editar',
    'modificar',
    'elemento',
    'componente',
    'página',
    'interface',
    'ui',
  ];

  return canvasKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Extract entities from user message
 */
export function extractEntities(message: string): {
  actions: string[];
  targets: string[];
  modifiers: string[];
} {
  const lowerMessage = message.toLowerCase();

  const actions: string[] = [];
  const targets: string[] = [];
  const modifiers: string[] = [];

  // Actions
  const actionKeywords = ['criar', 'adicionar', 'remover', 'editar', 'mostrar', 'listar'];
  actionKeywords.forEach(keyword => {
    if (lowerMessage.includes(keyword)) {
      actions.push(keyword);
    }
  });

  // Targets
  const targetKeywords = ['canvas', 'tabela', 'gráfico', 'botão', 'formulário', 'lista'];
  targetKeywords.forEach(keyword => {
    if (lowerMessage.includes(keyword)) {
      targets.push(keyword);
    }
  });

  // Modifiers
  const modifierKeywords = ['todos', 'novo', 'primeiro', 'último', 'ativo'];
  modifierKeywords.forEach(keyword => {
    if (lowerMessage.includes(keyword)) {
      modifiers.push(keyword);
    }
  });

  return { actions, targets, modifiers };
}
