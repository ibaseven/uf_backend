const crypto = require('crypto');
const { sha512 } = require('js-sha512');
const rateLimit = require('express-rate-limit');
const querystring = require('querystring');

// ✅ Rate limiting avec gestion IPv6 correcte
const payduniaCallbackLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { message: "Trop de requêtes callback" },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
        // Récupérer l'IP de Cloudflare ou fallback sur req.ip
        const ip = req.headers['cf-connecting-ip'] || req.ip;
        return rateLimit.ipKeyGenerator(req, res, ip);
    }
});

const secureCompareHash = (hash1, hash2) => {
    if (!hash1 || !hash2) return false;
    if (typeof hash1 !== 'string' || typeof hash2 !== 'string') return false;
    if (hash1.length !== 128 || hash2.length !== 128) return false;

    try {
        const buf1 = Buffer.from(hash1, 'hex');
        const buf2 = Buffer.from(hash2, 'hex');
        if (buf1.length !== 64 || buf2.length !== 64) return false;
        return crypto.timingSafeEqual(buf1, buf2);
    } catch (error) {
        return false;
    }
};

const unflattenPaydunyaData = (flatData) => {
    const result = {};
    
    for (const [key, value] of Object.entries(flatData)) {
        const parts = key.match(/\w+/g);
        if (!parts) continue;
        
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
        current[parts[parts.length - 1]] = value;
    }
    
    return result;
};

const verifyPaydunyaCallback = (req, res, next) => {
    try {
        let body = req.body;
        
        if (Buffer.isBuffer(body)) {
            const bodyString = body.toString('utf8');
            body = querystring.parse(bodyString);
        }
        
        if (Array.isArray(body)) {
            const bufferData = Buffer.from(body);
            const bodyString = bufferData.toString('utf8');
            body = querystring.parse(bodyString);
        }
        
        const unflattenedBody = unflattenPaydunyaData(body);
        body = unflattenedBody.data || unflattenedBody;
        
        if (!body || typeof body !== 'object') {
            return res.status(400).json({ message: "Body invalide" });
        }
        
        if (!body.invoice || !body.invoice.token) {
            return res.status(400).json({ message: "Structure invalide" });
        }
        
        const invoiceToken = body.invoice.token;
        const receivedHash = body.hash;
        const status = body.status;
        
        if (!receivedHash) {
            return res.status(401).json({ message: "Hash manquant" });
        }
        
        if (!status) {
            return res.status(400).json({ message: "Status manquant" });
        }
        
        const masterKey = process.env.PAYDUNYA_MASTER_KEY;
        if (!masterKey) {
            console.error('❌ PAYDUNYA_MASTER_KEY non configurée');
            return res.status(500).json({ message: "Configuration serveur manquante" });
        }
        
        // Validation hash
        const expectedHash = sha512(masterKey);
        
        if (!secureCompareHash(expectedHash, receivedHash)) {
            console.warn(`⚠️ Hash invalide: ${invoiceToken}`);
            return res.status(401).json({ message: "Authentification échouée" });
        }
        
        req.paydunya = {
            invoiceToken: invoiceToken,
            status: status,
            responseCode: body.response_code,
            responseText: body.response_text,
            customData: body.custom_data,
            customer: body.customer,
            invoice: body.invoice,
            mode: body.mode,
            receiptUrl: body.receipt_url,
            fullPayload: body
        };
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur vérification callback:', error.message);
        return res.status(500).json({ message: "Erreur de vérification" });
    }
};

module.exports = {
    payduniaCallbackLimiter,
    verifyPaydunyaCallback,
    secureCompareHash
};