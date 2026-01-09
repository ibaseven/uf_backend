require("dotenv").config();
const crypto = require("crypto");
const { sha512 } = require("js-sha512");
const rateLimit = require("express-rate-limit");
const querystring = require("querystring");

// ✅ Rate limiting avec gestion IPv6 correcte
const paydunyaCallbackLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { message: "Trop de requêtes callback" },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
        const ip = req.headers["cf-connecting-ip"] || req.ip;
        return rateLimit.ipKeyGenerator(req, res, ip);
    }
});

// 🔐 Comparaison sécurisée des hash
const secureCompareHash = (hash1, hash2) => {
    if (!hash1 || !hash2) return false;
    if (typeof hash1 !== "string" || typeof hash2 !== "string") return false;
    if (hash1.length !== 128 || hash2.length !== 128) return false;

    try {
        const buf1 = Buffer.from(hash1, "hex");
        const buf2 = Buffer.from(hash2, "hex");
        if (buf1.length !== 64 || buf2.length !== 64) return false;
        return crypto.timingSafeEqual(buf1, buf2);
    } catch (error) {
        return false;
    }
};

// 🔄 Convertit data[invoice][token] => data.invoice.token
const unflattenPaydunyaData = (flatData) => {
    const result = {};
    for (const [key, value] of Object.entries(flatData || {})) {
        const parts = key.match(/\w+/g);
        if (!parts) continue;

        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    }
    return result;
};

// 🛡️ Middleware principal
const verifyPaydunyaCallback = (req, res, next) => {
    try {
        let body = req.body;

        // Support PHP / Guzzle / raw buffer
        if (Buffer.isBuffer(body)) {
            body = querystring.parse(body.toString("utf8"));
        }

        if (Array.isArray(body)) {
            const bufferData = Buffer.from(body);
            body = querystring.parse(bufferData.toString("utf8"));
        }

        // Unflatten
        const unflattenedBody = unflattenPaydunyaData(body);
        body = unflattenedBody.data || unflattenedBody;

        if (!body || typeof body !== "object") {
            return res.status(400).json({ message: "Body invalide" });
        }

        if (!body.invoice || !body.invoice.token) {
            return res.status(400).json({ message: "Structure PayDunya invalide" });
        }

        const invoiceToken = body.invoice.token;
        const receivedHash = body.hash;
        const status = body.status;

        console.log("📥 PayDunya callback reçu");
        console.log("TOKEN:", invoiceToken);
        console.log("HASH REÇU:", receivedHash);
        console.log("MODE:", body.mode);

        if (!receivedHash) {
            return res.status(401).json({ message: "Hash manquant" });
        }

        if (!status) {
            return res.status(400).json({ message: "Status manquant" });
        }

        const masterKey = process.env.PAYDUNYA_MASTER_KEY;

        if (!masterKey) {
            console.error("❌ PAYDUNYA_MASTER_KEY non configurée");
            return res.status(500).json({ message: "Configuration serveur manquante" });
        }

        // ✅ FORMULES PAYDUNYA (on teste les 2 pour sandbox + live)
        const hash1 = sha512(masterKey + invoiceToken);
        const hash2 = sha512(invoiceToken + masterKey);

        console.log("HASH CALCULÉ 1 (master+token):", hash1);
        console.log("HASH CALCULÉ 2 (token+master):", hash2);

        const valid =
            secureCompareHash(hash1, receivedHash) ||
            secureCompareHash(hash2, receivedHash);

        if (!valid) {
            console.warn(`⚠️ Hash invalide: ${invoiceToken}`);
            return res.status(401).json({ message: "Authentification échouée" });
        }

        console.log("✅ Hash PayDunya validé");

        // ✅ On attache les données vérifiées à la requête
        req.paydunya = {
            invoiceToken,
            status,
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
        console.error("❌ Erreur vérification callback:", error);
        return res.status(500).json({ message: "Erreur de vérification" });
    }
};

module.exports = {
    paydunyaCallbackLimiter,
    verifyPaydunyaCallback,
    secureCompareHash
};
