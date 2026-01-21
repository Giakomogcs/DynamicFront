/**
 * Widget Templates - Templates Inteligentes de Widgets
 * Define estruturas pré-configuradas baseadas em tipos de dados
 */

export class WidgetTemplates {
    /**
     * Analisa dados e retorna o template mais apropriado
     * @param {any} data - Dados a serem visualizados
     * @param {string} context - Contexto da requisição
     * @returns {string} Nome do template recomendado
     */
    static detectTemplate(data, context = '') {
        if (!data) return 'empty';

        // Array de objetos = Lista
        if (Array.isArray(data) && data.length > 0) {
            const first = data[0];

            // Detectar se tem coordenadas -> Dashboard com Mapa
            if (this._hasLocation(first)) {
                return 'dashboard_with_map';
            }

            // Detectar se tem muitos campos -> Lista detalhada
            if (typeof first === 'object' && Object.keys(first).length > 5) {
                return 'detailed_list';
            }

            // Lista simples
            return 'simple_list';
        }

        // Objeto único = Detalhes
        if (typeof data === 'object' && !Array.isArray(data)) {
            return 'detail_view';
        }

        // Número = Estatística
        if (typeof data === 'number') {
            return 'stat';
        }

        // String = Texto
        return 'text';
    }

    /**
     * Verifica se objeto tem coordenadas geográficas
     */
    static _hasLocation(obj) {
        if (!obj || typeof obj !== 'object') return false;

        const keys = Object.keys(obj).map(k => k.toLowerCase());
        const hasLat = keys.some(k => k.includes('lat') || k === 'latitude');
        const hasLng = keys.some(k => k.includes('lng') || k.includes('lon') || k === 'longitude');

        return hasLat && hasLng;
    }

    /**
     * Gera widgets baseado no template
     */
    static generateFromTemplate(templateName, data, context = {}) {
        const templates = {
            'dashboard_with_map': this.dashboardWithMap,
            'detailed_list': this.detailedList,
            'simple_list': this.simpleList,
            'detail_view': this.detailView,
            'stat': this.statWidget,
            'text': this.textWidget,
            'empty': this.emptyWidget
        };

        const generator = templates[templateName] || this.simpleList;
        return generator.call(this, data, context);
    }

    /**
     * Template: Dashboard com Mapa
     * KPIs + Tabela + Mapa de localizações
     */
    static dashboardWithMap(data, context) {
        const widgets = [];

        // 1. KPIs
        widgets.push({
            type: 'stat',
            title: 'Estatísticas',
            data: [
                {
                    label: 'Total',
                    value: data.length,
                    icon: 'database'
                },
                {
                    label: 'Localizações',
                    value: data.filter(item => this._hasLocation(item)).length,
                    icon: 'map_pin'
                }
            ]
        });

        // 2. Mapa
        const locations = data.filter(item => this._hasLocation(item));
        if (locations.length > 0) {
            widgets.push({
                type: 'map',
                title: 'Localizações',
                config: {
                    markers: locations.map(item => ({
                        lat: item.latitude || item.lat,
                        lng: item.longitude || item.lng || item.lon,
                        title: item.name || item.title || 'Local',
                        popup: this._generatePopupContent(item)
                    })),
                    center: {
                        lat: locations[0].latitude || locations[0].lat,
                        lng: locations[0].longitude || locations[0].lng || locations[0].lon
                    },
                    zoom: 10
                }
            });
        }

        // 3. Tabela
        widgets.push({
            type: 'table',
            title: context.title || 'Dados',
            data: data,
            actions: [{
                label: 'Ver Detalhes',
                type: 'navigate',
                style: 'primary'
            }]
        });

        return widgets;
    }

    /**
     * Template: Lista Detalhada
     * Stats + Tabela com muitas colunas
     */
    static detailedList(data, context) {
        const widgets = [];

        // 1. Stats
        widgets.push({
            type: 'stat',
            title: 'Resumo',
            data: [
                { label: 'Total de Itens', value: data.length, icon: 'list' }
            ]
        });

        // 2. Tabela
        widgets.push({
            type: 'table',
            title: context.title || 'Lista Completa',
            data: data,
            config: {
                pagination: true,
                pageSize: 10,
                sortable: true,
                filterable: true
            }
        });

        return widgets;
    }

    /**
     * Template: Lista Simples
     * Apenas tabela básica
     */
    static simpleList(data, context) {
        return [{
            type: 'table',
            title: context.title || 'Lista',
            data: data
        }];
    }

    /**
     * Template: Visualização de Detalhes
     * Card com informações do objeto
     */
    static detailView(data, context) {
        // Converter objeto em array de pares chave-valor
        const fields = Object.entries(data).map(([key, value]) => ({
            label: this._formatLabel(key),
            value: this._formatValue(value)
        }));

        return [{
            type: 'detail_card',
            title: context.title || 'Detalhes',
            fields: fields
        }];
    }

    /**
     * Template: Widget de Estatística
     */
    static statWidget(data, context) {
        return [{
            type: 'stat',
            title: context.title || 'Valor',
            data: [{
                label: context.label || 'Total',
                value: data,
                icon: context.icon || 'trending_up'
            }]
        }];
    }

    /**
     * Template: Widget de Texto
     */
    static textWidget(data, context) {
        return [{
            type: 'text',
            title: context.title || 'Informação',
            content: String(data)
        }];
    }

    /**
     * Template: Widget Vazio (Fallback)
     */
    static emptyWidget(data, context) {
        return [{
            type: 'insight',
            title: 'Sem Dados',
            content: [
                '## Aguardando Dados',
                '',
                'Nenhum dado foi retornado pela busca. Tente refinar sua pesquisa.',
                '',
                'Exemplo: Informe uma cidade diferente ou aumente o raio de busca.'
            ],
            sentiment: 'neutral'
        }];
    }

    /**
     * Helpers
     */
    static _generatePopupContent(item) {
        const keys = Object.keys(item).filter(k =>
            !['lat', 'latitude', 'lng', 'longitude', 'lon'].includes(k.toLowerCase())
        );

        return keys.slice(0, 3).map(k => `${this._formatLabel(k)}: ${item[k]}`).join('<br>');
    }

    static _formatLabel(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
    }

    static _formatValue(value) {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }
}

export const widgetTemplates = new WidgetTemplates();
