import { modelManager } from '../../services/ai/ModelManager.js';

/**
 * CanvasContextAnalyzer - Phase 1.1
 * 
 * Analyzes existing canvas to understand:
 * - Components rendered and their coordinates
 * - Tools that were used to generate data
 * - Resources accessed (enterprises, schools, courses)
 * - Theme/niche identification
 * - Authentication utilized
 */
export class CanvasContextAnalyzer {
    constructor() {
        this.llm = modelManager;
    }

    /**
     * Analyzes a complete canvas context
     * @param {Object} canvas - Canvas object with widgets, messages, metadata
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeCanvas(canvas) {
        if (!canvas || !canvas.widgets) {
            return this._createEmptyAnalysis();
        }

        console.log(`[CanvasAnalyzer] Analyzing canvas with ${canvas.widgets.length} widgets...`);

        const analysis = {
            components: await this._analyzeComponents(canvas.widgets),
            toolsUsed: this._extractToolsUsed(canvas),
            resources: this._extractResources(canvas),
            theme: await this._identifyTheme(canvas),
            authentication: this._extractAuthentication(canvas),
            metadata: {
                widgetCount: canvas.widgets.length,
                messageCount: canvas.messages?.length || 0,
                analyzedAt: new Date().toISOString()
            }
        };

        console.log('[CanvasAnalyzer] Analysis complete:', {
            componentsFound: analysis.components.length,
            toolsUsed: analysis.toolsUsed.length,
            theme: analysis.theme.primary
        });

        return analysis;
    }

    /**
     * Analyzes components and their positions
     * @private
     */
    async _analyzeComponents(widgets) {
        const components = widgets.map((widget, index) => {
            // Extract component type and data structure
            const component = {
                id: widget.id || `widget-${index}`,
                type: widget.type,
                position: {
                    // Default positioning (will be enhanced in Phase 4)
                    x: widget.x || 0,
                    y: widget.y || (index * 400), // Stack vertically by default
                    width: widget.width || 800,
                    height: widget.height || 400
                },
                dataStructure: this._analyzeDataStructure(widget),
                interactive: this._hasInteractivity(widget),
                metadata: {
                    title: widget.title || widget.config?.title,
                    hasActions: widget.actions?.length > 0 || widget.config?.actions?.length > 0
                }
            };

            return component;
        });

        return components;
    }

    /**
     * Analyzes the structure of data in a widget
     * @private
     */
    _analyzeDataStructure(widget) {
        const structure = {
            fields: [],
            recordCount: 0,
            dataType: 'unknown'
        };

        // Extract from different widget types
        if (widget.data) {
            if (Array.isArray(widget.data)) {
                structure.recordCount = widget.data.length;
                structure.dataType = 'array';

                // Extract field names from first record
                if (widget.data.length > 0) {
                    structure.fields = Object.keys(widget.data[0]);
                }
            } else if (typeof widget.data === 'object') {
                structure.fields = Object.keys(widget.data);
                structure.dataType = 'object';
                structure.recordCount = 1;
            }
        }

        return structure;
    }

    /**
     * Checks if widget has interactive elements
     * @private
     */
    _hasInteractivity(widget) {
        return !!(
            widget.actions?.length > 0 ||
            widget.config?.actions?.length > 0 ||
            widget.onClick ||
            widget.onDrilldown
        );
    }

    /**
     * Extracts tools that were used in this canvas
     * @private
     */
    _extractToolsUsed(canvas) {
        const tools = new Set();

        // Extract from metadata if available
        if (canvas.metadata?.toolsExecuted) {
            canvas.metadata.toolsExecuted.forEach(tool => tools.add(tool));
        }

        // Extract from widget actions
        if (canvas.widgets) {
            canvas.widgets.forEach(widget => {
                // Check widget actions
                const actions = widget.actions || widget.config?.actions || [];
                actions.forEach(action => {
                    if (action.type === 'tool_call' && action.tool) {
                        tools.add(action.tool);
                    }
                });
            });
        }

        // Extract from message history
        if (canvas.messages) {
            canvas.messages.forEach(msg => {
                if (msg.metadata?.toolsUsed) {
                    msg.metadata.toolsUsed.forEach(tool => tools.add(tool));
                }
            });
        }

        return Array.from(tools);
    }

    /**
     * Extracts resources accessed (entities like schools, enterprises, courses)
     * @private
     */
    _extractResources(canvas) {
        const resources = {
            schools: new Set(),
            enterprises: new Set(),
            courses: new Set(),
            users: new Set(),
            other: []
        };

        // Scan widget data for entity IDs and CNPJs
        if (canvas.widgets) {
            canvas.widgets.forEach(widget => {
                if (widget.data && Array.isArray(widget.data)) {
                    widget.data.forEach(record => {
                        // Detect schools
                        if (record.schoolCnpj || record.school_cnpj || record.cnpj) {
                            resources.schools.add(record.schoolCnpj || record.school_cnpj || record.cnpj);
                        }
                        if (record.schoolName || record.school_name) {
                            resources.schools.add(record.schoolName || record.school_name);
                        }

                        // Detect enterprises
                        if (record.enterpriseCnpj || record.enterprise_cnpj) {
                            resources.enterprises.add(record.enterpriseCnpj || record.enterprise_cnpj);
                        }

                        // Detect courses
                        if (record.courseId || record.course_id) {
                            resources.courses.add(record.courseId || record.course_id);
                        }
                        if (record.courseName || record.course_name) {
                            resources.courses.add(record.courseName || record.course_name);
                        }

                        // Detect users
                        if (record.userId || record.user_id || record.email) {
                            resources.users.add(record.userId || record.user_id || record.email);
                        }
                    });
                }
            });
        }

        // Convert sets to arrays
        return {
            schools: Array.from(resources.schools),
            enterprises: Array.from(resources.enterprises),
            courses: Array.from(resources.courses),
            users: Array.from(resources.users),
            other: resources.other
        };
    }

    /**
     * Identifies the theme/niche of the canvas using LLM
     * @private
     */
    async _identifyTheme(canvas) {
        try {
            const prompt = `Analyze this canvas and identify its theme and purpose.

Canvas Summary:
- Widget Types: ${canvas.widgets.map(w => w.type).join(', ')}
- Data Points: ${JSON.stringify(this._extractSampleData(canvas.widgets))}
- Recent Messages: ${canvas.messages?.slice(-3).map(m => m.text).join(' | ') || 'None'}

Identify:
1. Primary Theme (e.g., "Course Dashboard", "Enterprise Management", "SENAI Units Overview")
2. Sub-theme (e.g., "Technology Courses", "Active Contracts", "Regional Analysis")
3. Main Entities (e.g., ["Course", "School", "Enterprise"])
4. Visualization Type (e.g., "dashboard", "crud", "detail-view", "analytics")

Respond in JSON format:
{
  "primary": "Theme name",
  "subTheme": "Sub-theme name",
  "entities": ["Entity1", "Entity2"],
  "visualizationType": "type",
  "confidence": 0.0-1.0
}`;

            const result = await this.llm.generateContent(prompt, {
                jsonMode: true
            });

            const themeData = JSON.parse(result.response.text());
            return themeData;

        } catch (error) {
            console.error('[CanvasAnalyzer] Theme identification failed:', error);
            return this._fallbackThemeIdentification(canvas);
        }
    }

    /**
     * Fallback theme identification without LLM
     * @private
     */
    _fallbackThemeIdentification(canvas) {
        const widgetTypes = canvas.widgets.map(w => w.type);
        const hasCharts = widgetTypes.includes('chart');
        const hasTables = widgetTypes.includes('table');
        const hasStats = widgetTypes.includes('stat');

        let visualizationType = 'unknown';
        if (hasCharts && hasStats) visualizationType = 'dashboard';
        else if (hasTables) visualizationType = 'data-view';
        else if (hasCharts) visualizationType = 'analytics';

        return {
            primary: 'Data Visualization',
            subTheme: null,
            entities: [],
            visualizationType,
            confidence: 0.3
        };
    }

    /**
     * Extracts sample data for theme analysis
     * @private
     */
    _extractSampleData(widgets) {
        const samples = [];
        widgets.slice(0, 3).forEach(widget => {
            if (widget.data && Array.isArray(widget.data) && widget.data.length > 0) {
                samples.push(Object.keys(widget.data[0]));
            }
        });
        return samples;
    }

    /**
     * Extracts authentication information used
     * @private
     */
    _extractAuthentication(canvas) {
        const auth = {
            used: false,
            users: [],
            tools: []
        };

        // Extract from metadata
        if (canvas.metadata?.authenticationUsed) {
            auth.used = true;
            auth.users = canvas.metadata.authenticationUsed.users || [];
            auth.tools = canvas.metadata.authenticationUsed.tools || [];
        }

        // Extract from messages
        if (canvas.messages) {
            canvas.messages.forEach(msg => {
                if (msg.metadata?.authenticatedAs) {
                    auth.used = true;
                    if (!auth.users.includes(msg.metadata.authenticatedAs)) {
                        auth.users.push(msg.metadata.authenticatedAs);
                    }
                }
            });
        }

        return auth;
    }

    /**
     * Creates empty analysis for null/empty canvas
     * @private
     */
    _createEmptyAnalysis() {
        return {
            components: [],
            toolsUsed: [],
            resources: {
                schools: [],
                enterprises: [],
                courses: [],
                users: [],
                other: []
            },
            theme: {
                primary: null,
                subTheme: null,
                entities: [],
                visualizationType: 'empty',
                confidence: 1.0
            },
            authentication: {
                used: false,
                users: [],
                tools: []
            },
            metadata: {
                widgetCount: 0,
                messageCount: 0,
                analyzedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Public utility: Compare two themes for similarity
     * @param {Object} theme1 
     * @param {Object} theme2 
     * @returns {number} Similarity score 0-1
     */
    themeSimilarity(theme1, theme2) {
        if (!theme1 || !theme2) return 0;

        let score = 0;
        let factors = 0;

        // Compare primary themes (most important)
        if (theme1.primary && theme2.primary) {
            factors++;
            const similarity = this._stringSimilarity(
                theme1.primary.toLowerCase(),
                theme2.primary.toLowerCase()
            );
            score += similarity * 0.5; // 50% weight
        }

        // Compare entities
        if (theme1.entities && theme2.entities) {
            factors++;
            const commonEntities = theme1.entities.filter(e =>
                theme2.entities.includes(e)
            );
            const entityScore = commonEntities.length /
                Math.max(theme1.entities.length, theme2.entities.length);
            score += entityScore * 0.3; // 30% weight
        }

        // Compare visualization types
        if (theme1.visualizationType && theme2.visualizationType) {
            factors++;
            if (theme1.visualizationType === theme2.visualizationType) {
                score += 0.2; // 20% weight
            }
        }

        return factors > 0 ? score : 0;
    }

    /**
     * Simple string similarity using Levenshtein distance
     * @private
     */
    _stringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const distance = this._levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Levenshtein distance calculation
     * @private
     */
    _levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }
}

export const canvasContextAnalyzer = new CanvasContextAnalyzer();
