const validator = require('validator');

const validateCallbackPayload = (data) => {
    const errors = [];
    
    if (!data || typeof data !== 'object') {
        errors.push('Données callback invalides');
        return { isValid: false, errors };
    }
    
    if (!data.invoice || !data.invoice.token) {
        errors.push('invoice.token manquant');
    } else if (typeof data.invoice.token !== 'string' || data.invoice.token.length < 10) {
        errors.push('Format invoice.token invalide');
    }
    
    if (!data.status || typeof data.status !== 'string') {
        errors.push('status manquant');
    } else {
        const validStatuses = ['completed', 'pending', 'failed', 'cancelled'];
        if (!validStatuses.includes(data.status)) {
            errors.push(`status invalide - doit être: ${validStatuses.join(', ')}`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        sanitizedData: {
            invoiceToken: data.invoice?.token?.trim(),
            status: data.status?.toLowerCase().trim()
        }
    };
};

module.exports = { validateCallbackPayload };