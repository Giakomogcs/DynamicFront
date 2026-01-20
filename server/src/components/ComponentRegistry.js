/**
 * ComponentRegistry - Phase 4.2
 * 
 * Central registry of all available canvas components:
 * - Defines component specifications
 * - Default sizes and behaviors
 * - Data contracts
 * - Rendering metadata
 */

export const COMPONENT_REGISTRY = {
    // ============ DATA DISPLAY COMPONENTS ============

    stat: {
        name: 'Statistic Card',
        component: 'DynamicStat',
        category: 'display',
        defaultSize: { width: 280, height: 150 },
        minSize: { width: 200, height: 120 },
        maxSize: { width: 400, height: 200 },
        dataContract: {
            required: ['label', 'value'],
            optional: ['change', 'icon', 'trend'],
            format: 'array'
        },
        features: ['icon', 'trend', 'comparison'],
        description: 'Display key metrics and KPIs'
    },

    table: {
        name: 'Data Table',
        component: 'DynamicTable',
        category: 'display',
        defaultSize: { width: 1200, height: 500 },
        minSize: { width: 400, height: 300 },
        maxSize: { width: null, height: null }, // Can expand
        dataContract: {
            required: ['array of objects'],
            optional: [],
            format: 'array'
        },
        features: ['sort', 'filter', 'pagination', 'export', 'search', 'actions'],
        description: 'Display tabular data with sorting and filtering'
    },

    chart: {
        name: 'Chart Visualization',
        component: 'DynamicChart',
        category: 'visualization',
        types: ['bar', 'line', 'pie', 'area', 'scatter', 'donut'],
        defaultSize: { width: 600, height: 400 },
        minSize: { width: 300, height: 200 },
        maxSize: { width: 1200, height: 800 },
        dataContract: {
            required: ['name', 'value'],
            optional: ['category', 'color'],
            format: 'array'
        },
        features: ['responsive', 'animated', 'interactive', 'legend', 'tooltip'],
        description: 'Visualize data with various chart types'
    },

    list: {
        name: 'List View',
        component: 'DynamicList',
        category: 'display',
        types: ['simple', 'card', 'timeline', 'checklist'],
        defaultSize: { width: 400, height: 600 },
        minSize: { width: 300, height: 400 },
        maxSize: { width: 800, height: null },
        dataContract: {
            required: ['array of items'],
            optional: ['icon', 'subtitle', 'actions'],
            format: 'array'
        },
        features: ['scrollable', 'expandable', 'actions'],
        description: 'Display list of items in various formats'
    },

    // ============ INTERACTIVE COMPONENTS ============

    form: {
        name: 'Dynamic Form',
        component: 'DynamicForm',
        category: 'input',
        types: ['create', 'edit', 'filter', 'search'],
        defaultSize: { width: 500, height: 400 },
        minSize: { width: 300, height: 200 },
        maxSize: { width: 800, height: null },
        dataContract: {
            required: ['fields schema'],
            optional: ['validation', 'defaultValues'],
            format: 'object'
        },
        features: ['validation', 'auto-save', 'multi-step', 'conditional-fields'],
        description: 'Interactive form for data input'
    },

    collapse: {
        name: 'Accordion/Collapsible',
        component: 'DynamicCollapse',
        category: 'layout',
        defaultSize: { width: 600, height: 'auto' },
        minSize: { width: 300, height: 100 },
        dataContract: {
            required: ['title', 'content'],
            optional: ['icon', 'defaultExpanded'],
            format: 'array'
        },
        features: ['expandable', 'nested', 'animated'],
        description: 'Expandable sections for organizing content'
    },

    // ============ METRIC & KPI COMPONENTS ============

    metric: {
        name: 'Metric Card',
        component: 'MetricCard',
        category: 'display',
        types: ['single', 'comparison', 'progress', 'gauge'],
        defaultSize: { width: 300, height: 150 },
        minSize: { width: 200, height: 100 },
        dataContract: {
            required: ['value'],
            optional: ['target', 'label', 'unit', 'trend'],
            format: 'object'
        },
        features: ['progress-bar', 'sparkline', 'comparison'],
        description: 'Display single metric with visual indicators'
    },

    // ============ PROCESS & WORKFLOW COMPONENTS ============

    process: {
        name: 'Process Flow',
        component: 'ProcessFlow',
        category: 'visualization',
        defaultSize: { width: 1200, height: 200 },
        minSize: { width: 600, height: 150 },
        dataContract: {
            required: ['steps'],
            optional: ['currentStep', 'completed'],
            format: 'array'
        },
        features: ['stepper', 'timeline', 'status'],
        description: 'Display process steps or workflow'
    },

    insight: {
        name: 'Insight Card',
        component: 'InsightCard',
        category: 'display',
        defaultSize: { width: 800, height: 300 },
        minSize: { width: 400, height: 200 },
        dataContract: {
            required: ['title', 'content'],
            optional: ['sentiment', 'actions', 'priority'],
            format: 'object'
        },
        features: ['rich-text', 'actions', 'sentiment-indicator'],
        description: 'Display AI-generated insights or summaries'
    },

    // ============ GEOSPATIAL COMPONENTS ============

    map: {
        name: 'Interactive Map',
        component: 'DynamicMap',
        category: 'visualization',
        defaultSize: { width: 800, height: 600 },
        minSize: { width: 400, height: 300 },
        maxSize: { width: null, height: 800 },
        dataContract: {
            required: ['locations'],
            optional: ['markers', 'zoom', 'center'],
            format: 'array'
        },
        features: ['markers', 'clustering', 'heatmap', 'routes'],
        description: 'Display geographical data on interactive map'
    },

    // ============ CONTAINER COMPONENTS ============

    grid: {
        name: 'Grid Layout',
        component: 'GridContainer',
        category: 'layout',
        defaultSize: { width: 1200, height: 'auto' },
        dataContract: {
            required: ['children'],
            optional: ['columns', 'gap'],
            format: 'array'
        },
        features: ['responsive', 'draggable', 'resizable'],
        description: 'Container for grid-based layouts'
    },

    tabs: {
        name: 'Tabbed Container',
        component: 'TabbedContainer',
        category: 'layout',
        defaultSize: { width: 1200, height: 'auto' },
        dataContract: {
            required: ['tabs'],
            optional: ['defaultTab'],
            format: 'array'
        },
        features: ['switchable', 'lazy-load', 'closeable'],
        description: 'Organize content in tabs'
    }
};

/**
 * Component Registry Class
 */
export class ComponentRegistry {
    constructor() {
        this.registry = COMPONENT_REGISTRY;
    }

    /**
     * Gets component specification
     * @param {string} type - Component type
     * @returns {Object|null} - Component spec
     */
    getSpec(type) {
        return this.registry[type] || null;
    }

    /**
     * Gets all available component types
     * @returns {Array} - List of component types
     */
    getAllTypes() {
        return Object.keys(this.registry);
    }

    /**
     * Gets components by category
     * @param {string} category - Category filter
     * @returns {Array} - Filtered components
     */
    getByCategory(category) {
        return Object.entries(this.registry)
            .filter(([_, spec]) => spec.category === category)
            .map(([type, spec]) => ({ type, ...spec }));
    }

    /**
     * Validates component data against contract
     * @param {string} type - Component type
     * @param {*} data - Data to validate
     * @returns {Object} - Validation result
     */
    validateData(type, data) {
        const spec = this.getSpec(type);
        if (!spec) {
            return { valid: false, error: 'Unknown component type' };
        }

        const { dataContract } = spec;

        // Check if data matches expected format
        if (dataContract.format === 'array' && !Array.isArray(data)) {
            return { valid: false, error: 'Data must be an array' };
        }

        if (dataContract.format === 'object' && typeof data !== 'object') {
            return { valid: false, error: 'Data must be an object' };
        }

        // For array format, check first item has required fields
        if (Array.isArray(data) && data.length > 0 && dataContract.required.length > 0) {
            const sample = data[0];
            const missing = dataContract.required.filter(field => !(field in sample));

            if (missing.length > 0) {
                return {
                    valid: false,
                    error: `Missing required fields: ${missing.join(', ')}`
                };
            }
        }

        return { valid: true };
    }

    /**
     * Creates default component configuration
     * @param {string} type - Component type
     * @param {Object} overrides - Property overrides
     * @returns {Object} - Component config
     */
    createDefault(type, overrides = {}) {
        const spec = this.getSpec(type);
        if (!spec) {
            throw new Error(`Unknown component type: ${type}`);
        }

        return {
            id: `${type}-${Date.now()}`,
            type,
            ...spec.defaultSize,
            data: [],
            config: {},
            ...overrides
        };
    }

    /**
     * Gets statistics about registry
     * @returns {Object} - Stats
     */
    getStats() {
        const types = Object.keys(this.registry);
        const categories = {};

        types.forEach(type => {
            const cat = this.registry[type].category;
            categories[cat] = (categories[cat] || 0) + 1;
        });

        return {
            totalComponents: types.length,
            categories,
            types
        };
    }
}

export const componentRegistry = new ComponentRegistry();
