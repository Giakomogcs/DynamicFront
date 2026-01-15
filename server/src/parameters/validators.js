/**
 * Parameter validators
 */
export default {
    validate: (type, value, schema) => {
        switch (type) {
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'string':
                return typeof value === 'string';
            case 'boolean':
                return typeof value === 'boolean';
            case 'date':
                return value instanceof Date && !isNaN(value);
            case 'daterange':
                return value && value.start instanceof Date && value.end instanceof Date && value.start <= value.end;
            case 'enum':
                return schema?.enum?.includes(value);
            default:
                return true;
        }
    }
};
