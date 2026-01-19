/**
 * CanvasMerger - Phase 3.2
 * 
 * Intelligently merges new content into existing canvas:
 * - Analyzes what exists vs what's new
 * - Decides: add, remove, update, or reposition components
 * - Avoids duplication
 * - Maintains visual coherence
 */
export class CanvasMerger {
    constructor() { }

    /**
     * Merges new request into existing canvas
     * @param {Object} existingCanvas - Existing canvas with widgets
     * @param {string} newRequest - New user request
     * @param {Object} newData - New data to incorporate
     * @param {Object} newWidgets - New widgets proposed by Designer
     * @returns {Promise<Object>} - Merge result with changes applied
     */
    async mergeIntoCanvas(existingCanvas, newRequest, newData = null, newWidgets = []) {
        console.log(`[CanvasMerger] Merging into canvas with ${existingCanvas.widgets?.length || 0} existing widgets`);

        // 1. Analyze what already exists
        const existing = this.analyzeExisting(existingCanvas);

        // 2. Analyze what's being requested
        const newRequirements = this.analyzeNewRequirements(newRequest, newData, newWidgets);

        // 3. Determine changes needed
        const changes = await this.determineChanges(existing, newRequirements);

        console.log(`[CanvasMerger] Determined ${changes.length} changes:`, {
            add: changes.filter(c => c.action === 'add').length,
            remove: changes.filter(c => c.action === 'remove').length,
            update: changes.filter(c => c.action === 'update').length,
            reposition: changes.filter(c => c.action === 'reposition').length
        });

        // 4. Apply changes
        const mergedCanvas = await this.applyChanges(existingCanvas, changes);

        return {
            canvas: mergedCanvas,
            changes,
            summary: this.summarizeChanges(changes)
        };
    }

    /**
     * Analyzes existing canvas content
     * @private
     */
    analyzeExisting(canvas) {
        const widgets = canvas.widgets || [];

        return {
            widgetTypes: widgets.map(w => w.type),
            widgetTitles: widgets.map(w => w.title || w.config?.title).filter(Boolean),
            dataFields: this.extractDataFields(widgets),
            componentCount: widgets.length,
            hasStats: widgets.some(w => w.type === 'stat'),
            hasTables: widgets.some(w => w.type === 'table'),
            hasCharts: widgets.some(w => w.type === 'chart'),
            hasProcess: widgets.some(w => w.type === 'process')
        };
    }

    /**
     * Extracts data fields from widgets
     * @private
     */
    extractDataFields(widgets) {
        const fields = new Set();

        widgets.forEach(widget => {
            if (widget.data && Array.isArray(widget.data) && widget.data.length > 0) {
                const sample = widget.data[0];
                if (typeof sample === 'object') {
                    Object.keys(sample).forEach(key => fields.add(key));
                }
            }
        });

        return Array.from(fields);
    }

    /**
     * Analyzes new requirements from request
     * @private
     */
    analyzeNewRequirements(request, data, widgets) {
        const lower = request.toLowerCase();

        return {
            requestsChart: lower.includes('gráfico') || lower.includes('chart'),
            requestsTable: lower.includes('tabela') || lower.includes('table') || lower.includes('lista'),
            requestsStats: lower.includes('total') || lower.includes('quantidade') || lower.includes('kpi'),
            requestsRemoval: lower.includes('remov') || lower.includes('tir') || lower.includes('exclu'),
            requestsUpdate: lower.includes('atualiz') || lower.includes('modifi') || lower.includes('alterar'),
            newWidgets: widgets || [],
            newData: data,
            request: request
        };
    }

    /**
     * Determines what changes to make
     * @private
     */
    async determineChanges(existing, requirements) {
        const changes = [];

        // Strategy 1: User explicitly asks to remove
        if (requirements.requestsRemoval) {
            // Parse what to remove from request
            const toRemove = this.parseRemovalRequest(requirements.request, existing);
            toRemove.forEach(widgetIndex => {
                changes.push({
                    action: 'remove',
                    widgetIndex,
                    reason: 'User requested removal'
                });
            });
        }

        // Strategy 2: Add new widgets if they don't duplicate existing
        for (const newWidget of requirements.newWidgets) {
            const isDuplicate = this.isDuplicate(newWidget, existing);

            if (!isDuplicate) {
                changes.push({
                    action: 'add',
                    widget: newWidget,
                    reason: `Adding new ${newWidget.type} widget`
                });
            } else {
                console.log(`[CanvasMerger] Skipping duplicate ${newWidget.type} widget`);
            }
        }

        // Strategy 3: If user asks for chart but none exists, add it
        if (requirements.requestsChart && !existing.hasCharts && requirements.newWidgets.length === 0) {
            changes.push({
                action: 'add',
                widget: {
                    type: 'chart',
                    title: 'Data Visualization',
                    config: { chartType: 'bar' },
                    data: []
                },
                reason: 'User requested chart visualization'
            });
        }

        // Strategy 4: If no changes yet, assume append mode
        if (changes.length === 0 && requirements.newWidgets.length > 0) {
            requirements.newWidgets.forEach(widget => {
                changes.push({
                    action: 'add',
                    widget,
                    reason: 'Appending new content to canvas'
                });
            });
        }

        return changes;
    }

    /**
     * Checks if a widget duplicates existing content
     * @private
     */
    isDuplicate(newWidget, existing) {
        // Check if same type and similar title exists
        const sameType = existing.widgetTypes.includes(newWidget.type);
        const similarTitle = existing.widgetTitles.some(title =>
            title && newWidget.title &&
            title.toLowerCase().includes(newWidget.title.toLowerCase().substring(0, 10))
        );

        return sameType && similarTitle;
    }

    /**
     * Parses removal request from natural language
     * @private
     */
    parseRemovalRequest(request, existing) {
        const lower = request.toLowerCase();
        const toRemove = [];

        // Detect what to remove
        if (lower.includes('tabela') || lower.includes('table')) {
            // Find table widgets
            existing.widgetTypes.forEach((type, index) => {
                if (type === 'table') toRemove.push(index);
            });
        }

        if (lower.includes('gráfico') || lower.includes('chart')) {
            existing.widgetTypes.forEach((type, index) => {
                if (type === 'chart') toRemove.push(index);
            });
        }

        return toRemove;
    }

    /**
     * Applies changes to canvas
     * @private
     */
    async applyChanges(canvas, changes) {
        const merged = {
            ...canvas,
            widgets: [...(canvas.widgets || [])]
        };

        // Sort changes: remove first, then add/update
        const sortedChanges = [
            ...changes.filter(c => c.action === 'remove'),
            ...changes.filter(c => c.action === 'update'),
            ...changes.filter(c => c.action === 'add'),
            ...changes.filter(c => c.action === 'reposition')
        ];

        for (const change of sortedChanges) {
            switch (change.action) {
                case 'add':
                    merged.widgets.push(change.widget);
                    console.log(`[CanvasMerger] Added ${change.widget.type} widget`);
                    break;

                case 'remove':
                    if (change.widgetIndex < merged.widgets.length) {
                        const removed = merged.widgets.splice(change.widgetIndex, 1);
                        console.log(`[CanvasMerger] Removed widget at index ${change.widgetIndex}`);
                    }
                    break;

                case 'update':
                    if (change.widgetIndex < merged.widgets.length) {
                        merged.widgets[change.widgetIndex] = {
                            ...merged.widgets[change.widgetIndex],
                            ...change.updates
                        };
                        console.log(`[CanvasMerger] Updated widget at index ${change.widgetIndex}`);
                    }
                    break;

                case 'reposition':
                    // Will be handled by Layout Optimizer in Phase 4
                    console.log('[CanvasMerger] Reposition requested (handled by LayoutOptimizer in Phase 4)');
                    break;
            }
        }

        return merged;
    }

    /**
     * Creates human-readable summary of changes
     * @private
     */
    summarizeChanges(changes) {
        const added = changes.filter(c => c.action === 'add').length;
        const removed = changes.filter(c => c.action === 'remove').length;
        const updated = changes.filter(c => c.action === 'update').length;

        let summary = 'Canvas atualizado: ';
        const parts = [];

        if (added > 0) parts.push(`${added} componente(s) adicionado(s)`);
        if (removed > 0) parts.push(`${removed} removido(s)`);
        if (updated > 0) parts.push(`${updated} atualizado(s)`);

        if (parts.length === 0) return 'Nenhuma mudança necessária';

        return summary + parts.join(', ');
    }
}

export const canvasMerger = new CanvasMerger();
