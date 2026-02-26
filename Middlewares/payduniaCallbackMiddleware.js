require("dotenv").config();
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { validateWebhookSignature } = require("../Config/diokolink");

// Rate limiting
const paydunyaCallbackLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { message: "Trop de requêtes callback" },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }
});

// Middleware de vérification du webhook DiokoLink (HMAC-SHA256)
const verifyPaydunyaCallback = (req, res, next) => {
    try {
        const body = req.body;

        if (!body || typeof body !== "object") {
            return res.status(400).json({ message: "Body invalide" });
        }

        // Logger les headers pour debug
        console.log("📥 Webhook headers:", JSON.stringify(req.headers));

        // Récupérer la signature depuis les headers DiokoLink
        const signature = req.headers["x-webhook-signature"]
            || req.headers["x-signature"]
            || req.headers["x-diokolink-signature"];

        // Log pour debug
        const rawBody = req.rawBody || JSON.stringify(body);
        console.log("📦 Webhook body complet:", JSON.stringify(body, null, 2));
        console.log("🔑 Signature reçue:", signature);

        // TODO: réactiver la vérification une fois l'algorithme DiokoLink confirmé
        // Pour l'instant on bypasse pour tester le flux complet

        next();

    } catch (error) {
        console.error("❌ Erreur vérification callback DiokoLink:", error);
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
