require("dotenv").config();
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

// Rate limiting
const paydunyaCallbackLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { message: "Trop de requêtes callback" },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }
});

// Middleware de vérification du webhook PayDunya
// PayDunya envoie un hash MD5 de la MASTER_KEY dans le body : body.data.hash
const verifyPaydunyaCallback = (req, res, next) => {
    try {
        const body = req.body;

        if (!body || typeof body !== "object") {
            return res.status(400).json({ message: "Body invalide" });
        }

        //console.log("📥 IPN PayDunya reçu:", JSON.stringify(body, null, 2));

        const masterKey = process.env.PAYDUNYA_MASTER_KEY;
        if (!masterKey) {
            console.error("❌ PAYDUNYA_MASTER_KEY manquante dans .env");
            return res.status(500).json({ message: "Configuration serveur incorrecte" });
        }

        // PayDunya envoie le hash dans body.data.hash (collect) ou body.hash (disburse)
        const receivedHash = body?.data?.hash || body?.hash;

        if (!receivedHash) {
            // Pas de hash → callback sans vérification (ex: test manuel)
            console.warn("⚠️ IPN sans hash PayDunya — passage sans vérification");
            return next();
        }

        // Vérification : SHA-512(PAYDUNYA_MASTER_KEY) doit correspondre au hash reçu
        const expectedHash = crypto
            .createHash("sha512")
            .update(masterKey)
            .digest("hex");

        if (receivedHash !== expectedHash) {
            console.error("❌ Hash PayDunya invalide:", { received: receivedHash, expected: expectedHash });
            return res.status(401).json({ message: "Signature IPN invalide" });
        }

        console.log("✅ IPN PayDunya vérifié");
        next();

    } catch (error) {
        console.error("❌ Erreur vérification IPN PayDunya:", error);
        return res.status(500).json({ message: "Erreur de vérification" });
    }
};

// Alias pour compatibilité avec les anciens imports
const payduniaCallbackLimiter = paydunyaCallbackLimiter;

module.exports = {
    paydunyaCallbackLimiter,
    payduniaCallbackLimiter,
    verifyPaydunyaCallback
};
