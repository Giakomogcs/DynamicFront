/**
 * LayoutOptimizer - Phase 4.1
 * 
 * Optimizes component layout using coordinate-based positioning:
 * - Auto-positions components to avoid overlaps
 * - Aligns related components
 * - Respects visual hierarchy
 * - Responsive layout adjustments
 */
export class LayoutOptimizer {
    constructor() {
        this.gridSize = 50; // Grid snap size in pixels
        this.defaultSpacing = 20; // Spacing between components
        this.canvasWidth = 1400; // Default canvas width
        this.canvasHeight = 10000; // Virtual canvas height (scrollable)
    }

    /**
     * Optimizes layout of all components in a canvas
     * @param {Array} components - Components to layout
     * @param {Object} options - Layout options
     * @returns {Array} - Components with optimized positions
     */
    async optimizeLayout(components, options = {}) {
        console.log(`[LayoutOptimizer] Optimizing layout for ${components.length} components`);

        const {
            strategy = 'auto', // 'auto', 'vertical', 'grid', 'masonry'
            spacing = this.defaultSpacing,
            alignCenter = false
        } = options;

        let positioned = [];

        switch (strategy) {
            case 'vertical':
                positioned = this.verticalLayout(components, spacing);
                break;

            case 'grid':
                positioned = this.gridLayout(components, spacing);
                break;

            case 'masonry':
                positioned = this.masonryLayout(components, spacing);
                break;

            case 'auto':
            default:
                positioned = this.autoLayout(components, spacing);
                break;
        }

        // Apply alignment if requested
        if (alignCenter) {
            positioned = this.centerAlign(positioned);
        }

        // Snap to grid
        positioned = this.snapToGrid(positioned);

        console.log('[LayoutOptimizer] Layout optimization complete');
        return positioned;
    }

    /**
     * Auto layout: intelligently decides best layout
     * @private
     */
    autoLayout(components, spacing) {
        // Categorize components by type
        const stats = components.filter(c => c.type === 'stat');
        const charts = components.filter(c => c.type === 'chart');
        const tables = components.filter(c => c.type === 'table');
        const others = components.filter(c => !['stat', 'chart', 'table'].includes(c.type));

        let positioned = [];
        let currentY = spacing;

        // Row 1: Stats (horizontal)
        if (stats.length > 0) {
            const statsRow = this.horizontalRow(stats, 0, currentY, spacing);
            positioned.push(...statsRow);
            currentY += this.maxHeight(statsRow) + spacing;
        }

        // Row 2: Charts (side by side if <= 2, else grid)
        if (charts.length > 0) {
            if (charts.length <= 2) {
                const chartsRow = this.horizontalRow(charts, 0, currentY, spacing);
                positioned.push(...chartsRow);
                currentY += this.maxHeight(chartsRow) + spacing;
            } else {
                const chartsGrid = this.gridLayoutPartial(charts, currentY, spacing, 2);
                positioned.push(...chartsGrid);
                currentY += this.maxHeight(chartsGrid) + spacing;
            }
        }

        // Row 3: Tables (full width, stacked)
        if (tables.length > 0) {
            const tablesStacked = this.verticalStack(tables, spacing, currentY);
            positioned.push(...tablesStacked);
            currentY += this.totalHeight(tablesStacked) + spacing;
        }

        // Rest: vertical stack
        if (others.length > 0) {
            const othersStacked = this.verticalStack(others, spacing, currentY);
            positioned.push(...othersStacked);
        }

        return positioned;
    }

    /**
     * Vertical layout: stack components vertically
     * @private
     */
    verticalLayout(components, spacing) {
        return this.verticalStack(components, spacing, spacing);
    }

    /**
     * Grid layout: arrange in grid pattern
     * @private
     */
    gridLayout(components, spacing) {
        return this.gridLayoutPartial(components, spacing, spacing, 2);
    }

    /**
     * Masonry layout: Pinterest-style
     * @private
     */
    masonryLayout(components, spacing) {
        const columns = 2;
        const columnWidth = (this.canvasWidth - spacing * (columns + 1)) / columns;
        const columnHeights = new Array(columns).fill(spacing);

        const positioned = components.map(comp => {
            // Find shortest column
            const shortestCol = columnHeights.indexOf(Math.min(...columnHeights));

            const x = spacing + shortestCol * (columnWidth + spacing);
            const y = columnHeights[shortestCol];

            const height = comp.height || this.getDefaultHeight(comp.type);
            columnHeights[shortestCol] += height + spacing;

            return {
                ...comp,
                x,
                y,
                width: comp.width || columnWidth
            };
        });

        return positioned;
    }

    /**
     * Helper: Horizontal row
     * @private
     */
    horizontalRow(components, startX, y, spacing) {
        let currentX = startX + spacing;

        return components.map(comp => {
            const width = comp.width || this.getDefaultWidth(comp.type);
            const height = comp.height || this.getDefaultHeight(comp.type);

            const positioned = {
                ...comp,
                x: currentX,
                y,
                width,
                height
            };

            currentX += width + spacing;
            return positioned;
        });
    }

    /**
     * Helper: Vertical stack
     * @private
     */
    verticalStack(components, spacing, startY) {
        let currentY = startY;

        return components.map(comp => {
            const width = comp.width || this.canvasWidth - spacing * 2;
            const height = comp.height || this.getDefaultHeight(comp.type);

            const positioned = {
                ...comp,
                x: spacing,
                y: currentY,
                width,
                height
            };

            currentY += height + spacing;
            return positioned;
        });
    }

    /**
     * Helper: Grid layout (partial)
     * @private
     */
    gridLayoutPartial(components, startY, spacing, cols) {
        const colWidth = (this.canvasWidth - spacing * (cols + 1)) / cols;
        let currentRow = 0;
        let currentCol = 0;
        let rowHeights = [startY];

        return components.map(comp => {
            const x = spacing + currentCol * (colWidth + spacing);
            const y = rowHeights[currentRow] || startY;

            const height = comp.height || this.getDefaultHeight(comp.type);

            const positioned = {
                ...comp,
                x,
                y,
                width: comp.width || colWidth,
                height
            };

            // Update row height
            rowHeights[currentRow] = Math.max(rowHeights[currentRow] || y, y + height + spacing);

            // Move to next position
            currentCol++;
            if (currentCol >= cols) {
                currentCol = 0;
                currentRow++;
            }

            return positioned;
        });
    }

    /**
     * Center aligns components
     * @private
     */
    centerAlign(components) {
        return components.map(comp => ({
            ...comp,
            x: (this.canvasWidth - comp.width) / 2
        }));
    }

    /**
     * Snaps positions to grid
     * @private
     */
    snapToGrid(components) {
        return components.map(comp => ({
            ...comp,
            x: Math.round(comp.x / this.gridSize) * this.gridSize,
            y: Math.round(comp.y / this.gridSize) * this.gridSize
        }));
    }

    /**
     * Gets default width for component type
     * @private
     */
    getDefaultWidth(type) {
        const widths = {
            stat: 280,
            chart: 600,
            table: 1200,
            list: 400,
            form: 500,
            metric: 300,
            process: 1200,
            insight: 800
        };
        return widths[type] || 600;
    }

    /**
     * Gets default height for component type
     * @private
     */
    getDefaultHeight(type) {
        const heights = {
            stat: 150,
            chart: 400,
            table: 500,
            list: 600,
            form: 400,
            metric: 150,
            process: 200,
            insight: 300
        };
        return heights[type] || 400;
    }

    /**
     * Gets max height from components
     * @private
     */
    maxHeight(components) {
        return Math.max(...components.map(c => c.y + c.height), 0);
    }

    /**
     * Gets total height of components
     * @private
     */
    totalHeight(components) {
        return components.reduce((sum, c) => sum + c.height + this.defaultSpacing, 0);
    }

    /**
     * Checks for overlaps between components
     * @param {Array} components - Components to check
     * @returns {boolean} - True if overlaps exist
     */
    hasOverlaps(components) {
        for (let i = 0; i < components.length; i++) {
            for (let j = i + 1; j < components.length; j++) {
                if (this.checkOverlap(components[i], components[j])) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Checks if two components overlap
     * @private
     */
    checkOverlap(comp1, comp2) {
        return !(
            comp1.x + comp1.width < comp2.x ||
            comp2.x + comp2.width < comp1.x ||
            comp1.y + comp1.height < comp2.y ||
            comp2.y + comp2.height < comp1.y
        );
    }

    /**
     * Repositions a specific component
     * @param {Array} components - All components
     * @param {string} componentId - ID of component to move
     * @param {Object} newPosition - New position {x, y, width, height}
     * @returns {Array} - Updated components
     */
    repositionComponent(components, componentId, newPosition) {
        return components.map(comp =>
            comp.id === componentId
                ? { ...comp, ...newPosition }
                : comp
        );
    }
}

export const layoutOptimizer = new LayoutOptimizer();
