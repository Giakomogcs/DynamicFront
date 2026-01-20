/**
 * Default parameter estimators
 */

export default {
    date: ({ objective }) => {
        // Tenta extrair data do objetivo
        const dateMatch = objective.match(
            /(\d{1,2}[-/]\d{1,2}[-/]\d{4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/
        );

        if (dateMatch) {
            return {
                value: new Date(dateMatch[0]),
                confidence: 0.8,
            };
        }

        // Default: hoje
        return {
            value: new Date(),
            confidence: 0.3,
        };
    },

    daterange: ({ objective }) => {
        const today = new Date();
        const defaultStart = new Date(today);
        defaultStart.setDate(defaultStart.getDate() - 30);  // 30 dias atrás

        // Tenta detectar padrões no objetivo
        if (objective.toLowerCase().includes('este mês') || objective.toLowerCase().includes('current month')) {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            return {
                value: { start, end: today },
                confidence: 0.9
            };
        }

        if (objective.toLowerCase().includes('ano') || objective.toLowerCase().includes('year')) {
            const start = new Date(today.getFullYear(), 0, 1);
            return {
                value: { start, end: today },
                confidence: 0.8
            };
        }

        // Default: últimos 30 dias
        return {
            value: { start: defaultStart, end: today },
            confidence: 0.4
        };
    },

    enum: ({ objective, schema }) => {
        if (!schema?.enum) {
            return { value: null, confidence: 0 };
        }

        const options = schema.enum;

        // Tenta encontrar match no objetivo
        for (const option of options) {
            if (objective.toLowerCase().includes(option.toLowerCase())) {
                return {
                    value: option,
                    confidence: 0.85
                };
            }
        }

        // Default: primeira opção
        return {
            value: options[0],
            confidence: 0.3
        };
    },

    number: ({ objective, schema }) => {
        const numberMatch = objective.match(/\b\d+\b/);

        if (numberMatch) {
            return {
                value: parseInt(numberMatch[0]),
                confidence: 0.6
            };
        }

        // Default baseado em schema
        const defaultValue = schema?.default || 10;
        return {
            value: defaultValue,
            confidence: 0.2
        };
    },

    boolean: ({ objective }) => {
        const trueTerms = ['sim', 'yes', 'verdadeiro', 'true', 'com', 'enable'];
        const falseTerms = ['não', 'no', 'falso', 'false', 'sem', 'disable'];

        const lowerObj = objective.toLowerCase();

        if (trueTerms.some(t => lowerObj.includes(t))) return { value: true, confidence: 0.7 };
        if (falseTerms.some(t => lowerObj.includes(t))) return { value: false, confidence: 0.7 };

        return { value: false, confidence: 0.3 };
    },

    // --- New Estimators ---

    cnpj: ({ objective }) => {
        // Regex for CNPJ (strict or loose)
        const cnpjMatch = objective.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
        if (cnpjMatch) {
            return { value: cnpjMatch[0], confidence: 0.95 };
        }
        return { value: "60627955000131", confidence: 0.1 }; // Default fallback
    },

    latitude: () => ({ value: -23.5505, confidence: 0.4 }), // SP
    longitude: () => ({ value: -46.6333, confidence: 0.4 }) // SP
};
