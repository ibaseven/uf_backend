require("dotenv").config();
const jwt = require("jsonwebtoken");
const secretKey = process.env.JWT_KEY;

// Middleware pour vérifier l'auth et le token JWT et recupérer  les informations de l'utlisateur connecté 
const authenticateTokenAndUserData = (req, res, next) => {
    const token = req.headers.authorization
    
    if (!token) {
        return res.status(403).send({ message: 'middleware.auth.forbidden' });
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message:'middleware.auth.invalidToken' });
        }

        req.user = decoded.data;
        next();
    });
};
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(403).json({ message: 'middleware.auth.forbidden' });
    }

    // Récupère le token après 'Bearer '
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: 'middleware.auth.invalidToken' });
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'middleware.auth.invalidToken' });
        }

        // Stocke les infos de l'utilisateur depuis le token
        req.user = decoded.data;

        // Récupère l'ID de l'utilisateur depuis les params
        const userIdFromParams = req.user.id; // exemple si la route est /users/:userId
        req.userIdFromParams = userIdFromParams;

        // Optionnel : vérifier que l'ID du token correspond à celui des params
        if (req.user.id !== userIdFromParams) {
            return res.status(403).json({ message: 'middleware.auth.forbidden' });
        }

        next();
    });
};

// Middleware pour vérifier l'auth et le token JWT et recupérer  les informations de l'utlisateur connecté 
const adminRole = (req, res, next) => {
    const token = req.headers.authorization
    
    if (!token) {
        return res.status(403).send({ message: 'middleware.admin.forbidden' });
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'middleware.admin.invalidToken' });
        }

        if (decoded.data.role !== "admin") {
            return res.status(403).send({ message: 'middleware.admin.accessDenied' });
        }
        req.user = decoded.data;
        next();
    });
};

module.exports = {
    authenticateTokenAndUserData ,
    adminRole,
    authenticateUser
};
