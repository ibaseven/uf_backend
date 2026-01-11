const User = require("../Models/UserModel")
const jwt = require("jsonwebtoken")
const bcrypt=require("bcryptjs")
const { sendWhatsAppMessage } = require("../utils/Whatsapp")
const secretKey = process.env.JWT_KEY 

const createToken = (id,email,role)=>{
    return jwt.sign(
        {data:{id,role,email}},
        secretKey,
        { expiresIn: "1d" }
    )
}


function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
const otpStore = {};
const passwordResetOtpStore = {};
module.exports.SignAccount= async(req,res)=>{
    try {
        const {telephone,password}=req.body
        const user = await User.findOne({telephone})
        if(!user){
            return res.status(400).json({message:"User Doesnt exist"})
        }
      
         const comparePassword = bcrypt.compareSync(password, user.password);
          if (!comparePassword) {
            return res.status(401).json({ message: "Email or Password Incorrect" })
        }
         //const token = createToken(user._id, user.email, user.role)
         //res.status(200).json({ message: "Successfully connection", token, user });
 const otp = generateOTP();
          otpStore[user._id] = {
      code: otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    };
    //(`🗃️ OTP stocké pour l'utilisateur ${user._id} avec expiration à ${otpStore[user._id].expiresAt}`);

    // Envoi du code via WhatsApp
    try {
      //(`📤 Envoi du code OTP par WhatsApp à ${user.telephone}`);
      await sendWhatsAppMessage(
        user.telephone,
        `Votre code de vérification Universall Fab est: ${otp}. Il expire dans 5 minutes.`
      );

      //("✅ OTP envoyé avec succès");
      res.status(200).json({
        message: "Un code de vérification a été envoyé à votre numéro WhatsApp",
        userId: user._id,
        requireOTP: true
      });

    } catch (msgError) {
      console.error("📛 Erreur lors de l'envoi du message WhatsApp:", msgError);
      res.status(500).json({ message: "Échec de l'envoi du code de vérification" });
    }
    } catch (error) {
        res.status(500).send({ message: "Internal Server Error", error });
    }
}
module.exports.CreateAccount = async (req, res) => {
  try {
    const { telephone, firstName, lastName, password ,nationalite,ville,pays,cni,dateNaissance,adresse} = req.body;

    // Vérifie si le numéro existe déjà en BD
    const existingUser = await User.findOne({ telephone });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "Ce numéro est déjà enregistré." 
      });
    }

    // Génère un OTP
    const otp = generateOTP();

    // Stocke les infos utilisateur + OTP en mémoire
    otpStore[telephone] = {
      otp,
      firstName,
      lastName,
      telephone,
      password,
      nationalite,
      ville,
      pays,
      cni,
      dateNaissance,
      adresse,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // expire après 5 min
    };

    // Envoie le code par WhatsApp
    await sendWhatsAppMessage(
      telephone,
      `Votre code de vérification Universall Fab est : ${otp}. Il expire dans 5 minutes.`
    );

    return res.status(200).json({
      success: true,
      tempUserId: telephone, 
      message: "Un code de vérification a été envoyé à votre numéro WhatsApp.",
      requireOTP: true,
    });
  } catch (error) {
    console.error("Erreur CreateAccount:", error);
    res.status(500).json({ 
      success: false,  
      message: "Erreur interne du serveur", 
      error: error.message 
    });
  }
};
module.exports.VerifyCreateAccountOTP = async (req, res) => {
  try {
    const { tempUserId, otpCode } = req.body;  // ← Changé "telephone" en "tempUserId" et "otp" en "otpCode"
    
    const telephone = tempUserId;  // tempUserId contient le numéro de téléphone

    // Vérifie si un OTP a été généré pour ce téléphone
    const otpData = otpStore[telephone];
    if (!otpData) {
      return res.status(400).json({ 
        success: false,
        message: "Aucun code OTP trouvé ou expiré." 
      });
    }

    // Vérifie la validité et la correspondance du code
    if (otpData.otp !== otpCode) {
      return res.status(400).json({ 
        success: false,
        message: "Code OTP incorrect." 
      });
    }
    if (otpData.expiresAt < new Date()) {
      delete otpStore[telephone];
      return res.status(400).json({ 
        success: false,
        message: "Code OTP expiré." 
      });
    }

    // Hash du mot de passe avant création
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(otpData.password, salt);

    // Création du compte utilisateur dans MongoDB
    const newUser = await User.create({
      telephone: otpData.telephone,
      firstName: otpData.firstName,
      lastName: otpData.lastName,
      nationalite: otpData.nationalite,
      adresse:otpData.adresse,
      ville:otpData.ville,
      pays:otpData.pays,
      cni:otpData.cni,
      password: hashedPassword,
      dateNaissance:otpData.dateNaissance,
      nationalite:otpData.nationalite,
      role: "actionnaire",
    });

    // Nettoyage : on supprime les données temporaires
    delete otpStore[telephone];

    return res.status(201).json({
      success: true,  // ← AJOUTÉ
      message: "Compte créé et vérifié avec succès 🎉",
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        telephone: newUser.telephone,
      },
    });
  } catch (error) {
    console.error("Erreur VerifyOTP:", error);
    res.status(500).json({ 
      success: false,  // ← AJOUTÉ
      message: "Erreur interne du serveur", 
      error: error.message 
    });
  }
};
module.exports.resendSignUpOTP = async (req, res) => {
  try {
    const { tempUserId } = req.body;
    
    const telephone = tempUserId; // tempUserId contient le numéro de téléphone

    // Vérifier si les données temporaires existent dans otpStore
    const otpData = otpStore[telephone];
    if (!otpData) {
      return res.status(404).json({ 
        success: false,
        message: "Aucune session de création trouvée ou expirée" 
      });
    }

    // Vérifier si les données temporaires n'ont pas expiré
    if (otpData.expiresAt < new Date()) {
      delete otpStore[telephone];
      return res.status(401).json({ 
        success: false,
        message: "Session de création expirée" 
      });
    }

    // Générer un nouveau code OTP
    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Mettre à jour l'OTP existant en gardant les autres données
    otpStore[telephone] = {
      ...otpData, // Garde toutes les données existantes (firstName, lastName, password, etc.)
      otp: newOtpCode, // Met à jour le code OTP
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // Nouvelle expiration de 5 minutes
    };

    // Envoyer le nouveau code OTP via WhatsApp
    await sendWhatsAppMessage(telephone, newOtpCode);

    return res.status(200).json({ 
      success: true,
      message: "Nouveau code de vérification envoyé", 
      expiresIn: 5 * 60 // en secondes
    });
    
  } catch (error) {
    console.error('Erreur lors du renvoi OTP:', error);
    res.status(500).json({ 
      success: false,
      message: "Erreur interne du serveur", 
      error: error.message 
    });
  }
};
module.exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate('projectId', 'nameProject packPrice duration monthlyPayment')
      .populate('projectPayments.projectId', 'nameProject packPrice');

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    // Calculer les détails des projets
    const projectDetails = user.projectPayments.map(payment => {
      const project = payment.projectId;
      const totalInvestment = payment.amountPaid + payment.remainingToPay;
      const numberOfPacks = project ? totalInvestment / project.packPrice : 0;

      return {
        projectId: project?._id,
        projectName: project?.nameProject || "Projet inconnu",
        packPrice: project?.packPrice || 0,
        numberOfPacks: Math.floor(numberOfPacks),
        amountPaid: payment.amountPaid,
        remainingToPay: payment.remainingToPay,
        totalInvestment: totalInvestment,
        completed: payment.completed,
        progressPercentage: project ? ((payment.amountPaid / totalInvestment) * 100).toFixed(2) : 0
      };
    });

    // Statistiques générales
    const totalInvested = projectDetails.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalRemaining = projectDetails.reduce((sum, p) => sum + p.remainingToPay, 0);
    const totalPacks = projectDetails.reduce((sum, p) => sum + p.numberOfPacks, 0);

    res.status(200).json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        telephone: user.telephone,
        role: user.role,
        dividende: user.dividende,
        actionsNumber:user.actionsNumber,
        isTheSuperAdmin:user.isTheSuperAdmin
      },
      statistics: {
        totalInvested,
        totalRemaining,
        totalPacks,
        numberOfProjects: projectDetails.length,
        completedProjects: projectDetails.filter(p => p.completed).length
      },
      projects: projectDetails
    });

  } catch (error) {
    console.error("Erreur récupération profil:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};
module.exports.checkAndGetUserByToken = async (req, res) => {
    try {
        const { token } = req.params;
        let userData;
        if (!token) {
            return res.status(403).send({ message: 'auth.token.accessDenied' });
        }

        jwt.verify(token, secretKey, (err, decoded) => {
            if (err) {
                console.log("Error+++++++++++++++++++++++++++ :" , err);
                return res.status(403).send({ message: req.t('auth.token.invalidToken') });
            }

            userData = decoded.data;
        });
        
        // Recherchez l'utilisateur par ID en ne récupérant que certains champs
        const user = await User.findById(userData.id).select("firstName lastName  telephone role  ");

        if (!user) {
            return res.status(404).json({ message: "User Not Found" });
        }

        

        return res.status(200).json({ message:'auth.user.retrieved', user });
    } catch (error) {
        console.log("Err Connection : " , error);
        
        return res.status(500).json({ message: 'server.error', error: error.message });
    }
};
module.exports.verifyOTPAndSignIn = async (req, res) => {
  try {
     const { userId, otpCode } = req.body;
    if (!otpStore[userId] || otpStore[userId].code !== otpCode) {
      return res.status(401).json({ message: "Code de vérification invalide" });
    }
    if (new Date() > otpStore[userId].expiresAt) {
      delete otpStore[userId];
      return res.status(401).json({ message: "Code de vérification expiré" });
    }

      const user = await User.findById(userId).select("_id role");
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    const token = createToken(user._id, user.email, user.role);
    delete otpStore[userId];
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.status(200).json({ 
      message: "Connexion réussie", 
      token, 
      user 
    });
  } catch (error) {
    console.error("Erreur lors de la vérification OTP:", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
};
module.exports.resendLoginOTP = async (req, res) => {
  try {
    const { userId } = req.body;

    // Vérifier si les données OTP existent pour cet utilisateur
    if (!otpStore[userId]) {
      return res.status(404).json({ 
        success: false,
        message: "Session de connexion expirée. Veuillez recommencer." 
      });
    }

    // Vérifier si la session n'a pas déjà expiré
    if (new Date() > otpStore[userId].expiresAt) {
      delete otpStore[userId];
      return res.status(401).json({ 
        success: false,
        message: "Session de connexion expirée. Veuillez recommencer." 
      });
    }

    // Récupérer le numéro de téléphone de l'utilisateur
    const user = await User.findById(userId).select("telephone");
    if (!user) {
      delete otpStore[userId];
      return res.status(404).json({ 
        success: false,
        message: "Utilisateur non trouvé" 
      });
    }

    // Générer un nouveau code OTP
    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Mettre à jour l'OTP en gardant le userId
    otpStore[userId] = {
      code: newOtpCode,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes
      type: 'login'
    };

    // Envoyer le nouveau code OTP via WhatsApp
    await sendWhatsAppMessage(user.telephone, newOtpCode);

    return res.status(200).json({ 
      success: true,
      message: "Nouveau code de vérification envoyé", 
      expiresIn: 2 * 60 // en secondes
    });

  } catch (error) {
    console.error('Erreur lors du renvoi OTP de connexion:', error);
    res.status(500).json({ 
      success: false,
      message: "Erreur interne du serveur", 
      error: error.message 
    });
  }
};
module.exports.createAdmin = async (req, res) => {
  try {
    const { telephone, firstName, lastName, password, role } = req.body;

    // Vérifier si le numéro existe déjà
    const existingUser = await User.findOne({ telephone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Ce numéro est déjà enregistré."
      });
    }

    // Hash du mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Création de l'admin
    const newAdmin = await User.create({
      telephone,
      firstName,
      lastName,
      password: hashedPassword,
      role: role 
    });

    return res.status(201).json({
      success: true,
      message: "Administrateur créé avec succès.",
      user: newAdmin
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur."
    });
  }
};
module.exports.getAllActionnaire = async (req, res) => {
  try {
    const actionnaires = await User.find({ role: "actionnaire" })
      .populate('parrain', 'firstName lastName telephone') 
      .select('-password'); 

    return res.status(200).json({
      success: true,
      total: actionnaires.length,
      actionnaires
    });

  } catch (error) {
    console.error("Erreur getAllActionnaire:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur interne du serveur",
      error: error.message
    });
  }
};

module.exports.getTheOwner = async (req, res) => {
  try {
    const owner = await User.findOne({ isMainAdmin: true });

    return res.status(200).json({
      success: true,
      total: owner.length,
      owner
    });

  } catch (error) {
    console.error("Erreur getAllActionnaire:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur interne du serveur",
      error
    });
  }
};
module.exports.updateOwnProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.userData?.id;
    const { 
      firstName, 
      lastName, 
      email, 
      telephone, 
      adresse,
      nationalite,
      ville,
      pays,
      cni,
      dateNaissance
    } = req.body;

    // Vérifier que l'utilisateur existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "Utilisateur non trouvé" 
      });
    }

    // Préparer les données à mettre à jour (tous les champs modifiables)
    let updateData = {};
    
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) {
      // Vérifier si l'email est déjà utilisé par un autre utilisateur
      const emailExists = await User.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      
      if (emailExists) {
        return res.status(400).json({ 
          success: false,
          message: "Cet email est déjà utilisé par un autre utilisateur" 
        });
      }
      
      updateData.email = email;
    }
    if (telephone !== undefined) updateData.telephone = telephone;
    if (adresse !== undefined) updateData.adresse = adresse;
    if (nationalite !== undefined) updateData.nationalite = nationalite;
    if (ville !== undefined) updateData.ville = ville;
    if (pays !== undefined) updateData.pays = pays;
    if (dateNaissance !== undefined) updateData.dateNaissance = dateNaissance;
if (cni !== undefined) updateData.cni = cni;
    // Mettre à jour l'utilisateur
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password');

    return res.status(200).json({
      success: true,
      message: "Profil mis à jour avec succès",
      user: updatedUser
    });
    
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ 
      success: false,
      message: "Erreur interne du serveur", 
      error: error.message 
    });
  }
};

module.exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params; // ID de l'utilisateur passé en paramètre de route

        // Recherchez l'utilisateur par ID en ne récupérant que certains champs
        const user = await User.findById(id);
//console.log(user);

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

       

        return res.status(200).json({ message: 'Utilisateur récupéré avec succès', user });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération de l\'utilisateur', error: error.message });
    }
};
// Récupérer le balance (dividende) de l'utilisateur connecté
module.exports.getUserBalance = async (req, res) => {
  try {

    const userId = req.user.id;

    // Rechercher l'utilisateur et récupérer uniquement le dividende
    const user = await User.findById(userId).select('dividende');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    return res.status(200).json({ 
      message: 'Balance récupéré avec succès', 
      dividende: user.dividende || 0 
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la récupération du balance', 
      error: error.message 
    });
  }
};
module.exports.sendPasswordResetOTP = async (req, res) => {
  try {
    const { telephone } = req.body;

    // Validation du numéro de téléphone
    if (!telephone) {
      return res.status(400).json({ 
        success: false,
        message: 'Le numéro de téléphone est requis.' 
      });
    }

    // Vérifier si l'utilisateur existe
    const user = await User.findOne({ telephone });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Aucun utilisateur trouvé avec ce numéro de téléphone.' 
      });
    }

    // Vérifier si l'utilisateur n'est pas bloqué
    if (user.isBlocked) {
      return res.status(403).json({ 
        success: false,
        message: 'Votre compte est bloqué. Contactez l\'administrateur.' 
      });
    }

    // Générer un code OTP pour la réinitialisation
    const resetOTP = generateOTP();

    // Stocker l'OTP avec un délai d'expiration (10 minutes)
    passwordResetOtpStore[user._id] = {
      code: resetOTP,
      telephone: telephone,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0 // Compteur de tentatives
    };

    // Message WhatsApp pour la réinitialisation
    const message = `Réinitialisation de mot de passe - Universall Fab
Bonjour ${user.firstName} ${user.lastName},
Votre code de réinitialisation de mot de passe est : ${resetOTP}
 Ce code expire dans 10 minutes.
 Pour votre sécurité, ne partagez ce code avec personne.
Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.
Équipe Universall Fab`;

    // Envoyer l'OTP par WhatsApp
    try {
      await sendWhatsAppMessage(telephone, message);
      
      //(`OTP de réinitialisation envoyé à ${telephone} pour l'utilisateur ${user._id}`);
      
      return res.status(200).json({ 
        success: true,
        message: 'Un code de réinitialisation a été envoyé à votre numéro WhatsApp.',
        userId: user._id,
        expiresIn: '10 minutes'
      });
      
    } catch (msgError) {
      console.error("Erreur lors de l'envoi du message WhatsApp:", msgError);
      
      // Nettoyer le store en cas d'échec d'envoi
      delete passwordResetOtpStore[user._id];
      
      return res.status(500).json({ 
        success: false,
        message: 'Échec de l\'envoi du code de réinitialisation. Veuillez réessayer.' 
      });
    }

  } catch (error) {
    console.error("Erreur lors de la demande de réinitialisation :", error);
    return res.status(500).json({ 
      success: false,
      message: 'Une erreur est survenue. Veuillez réessayer.' 
    });
  }
};
module.exports.verifyOTPAndResetPassword = async (req, res) => {
  try {
    const { userId, otpCode, newPassword } = req.body;

    // Validation des données
    if (!userId || !otpCode || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Tous les champs sont requis (userId, otpCode, newPassword).' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' 
      });
    }

    // Vérifier si l'OTP existe pour cet utilisateur
    if (!passwordResetOtpStore[userId]) {
      return res.status(401).json({ 
        success: false,
        message: 'Code de vérification invalide ou expiré.' 
      });
    }

    const otpData = passwordResetOtpStore[userId];

    // Vérifier si l'OTP n'a pas expiré
    if (new Date() > otpData.expiresAt) {
      delete passwordResetOtpStore[userId];
      return res.status(401).json({ 
        success: false,
        message: 'Code de vérification expiré. Veuillez demander un nouveau code.' 
      });
    }

    // Limiter le nombre de tentatives (max 3)
    if (otpData.attempts >= 3) {
      delete passwordResetOtpStore[userId];
      return res.status(429).json({ 
        success: false,
        message: 'Trop de tentatives. Veuillez demander un nouveau code.' 
      });
    }

    // Vérifier si le code OTP est correct
    if (otpData.code !== otpCode) {
      otpData.attempts += 1;
      return res.status(401).json({ 
        success: false,
        message: `Code de vérification incorrect. Tentatives restantes: ${3 - otpData.attempts}` 
      });
    }

    // Rechercher l'utilisateur dans la base de données
    const user = await User.findById(userId);
    if (!user) {
      delete passwordResetOtpStore[userId];
      return res.status(404).json({ 
        success: false,
        message: 'Utilisateur introuvable.' 
      });
    }

    // Vérifier que le téléphone correspond (sécurité supplémentaire)
    if (user.telephone !== otpData.telephone) {
      delete passwordResetOtpStore[userId];
      return res.status(400).json({ 
        success: false,
        message: 'Données de sécurité incorrectes.' 
      });
    }

    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Le nouveau mot de passe doit être différent de l\'ancien.' 
      });
    }

    // Crypter le nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Mettre à jour le mot de passe
    user.password = hashedPassword;
    await user.save();

    // Nettoyer le store après succès
    delete passwordResetOtpStore[userId];

    // Message de confirmation par WhatsApp
/*     const confirmationMessage = `✅Mot de passe réinitialisé - Dioko

Bonjour ${user.firstName} ${user.lastName},

Votre mot de passe a été réinitialisé avec succès.

Heure : ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}

Si vous n'êtes pas à l'origine de cette action, contactez immédiatement l'administrateur.

Équipe Dioko`;

    // Envoyer la confirmation (optionnel, ne pas bloquer en cas d'erreur)
    try {
      await sendWhatsAppMessage(user.telephone, confirmationMessage);
    } catch (confirmError) {
      console.error("Erreur envoi confirmation:", confirmError);
      // On continue même si l'envoi de confirmation échoue
    } */

    return res.status(200).json({ 
      success: true,
      message: 'Mot de passe réinitialisé avec succès.' 
    });

  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe :', error);
    return res.status(500).json({ 
      success: false,
      message: 'Une erreur est survenue lors de la réinitialisation.' 
    });
  }
};

module.exports.resendPasswordResetOTP = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'ID utilisateur requis.' 
      });
    }

    // Vérifier si l'utilisateur existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Utilisateur non trouvé.' 
      });
    }

    // Vérifier si l'utilisateur n'est pas bloqué
    if (user.isBlocked) {
      return res.status(403).json({ 
        success: false,
        message: 'Votre compte est bloqué.' 
      });
    }

    // Générer un nouveau code OTP
    const resetOTP = generateOTP();

    // Stocker le nouveau OTP
    passwordResetOtpStore[user._id] = {
      code: resetOTP,
      telephone: user.telephone,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0
    };

    // Message WhatsApp
    const message = ` Nouveau code de réinitialisation - Universall Fab
Votre nouveau code de réinitialisation est : ${resetOTP}
Ce code expire dans 10 minutes.
Équipe Universall Fab`;

    // Envoyer le nouveau OTP
    try {
      await sendWhatsAppMessage(user.telephone, message);
      
      return res.status(200).json({ 
        success: true,
        message: 'Un nouveau code de réinitialisation a été envoyé.',
        userId: user._id
      });
      
    } catch (msgError) {
      console.error("Erreur lors de l'envoi du nouveau code:", msgError);
      delete passwordResetOtpStore[user._id];
      
      return res.status(500).json({ 
        success: false,
        message: 'Échec de l\'envoi du nouveau code.' 
      });
    }

  } catch (error) {
    console.error("Erreur lors du renvoi de l'OTP:", error);
    return res.status(500).json({ 
      success: false,
      message: 'Erreur interne du serveur.' 
    });
  }
};

// Fonction utilitaire pour nettoyer les OTPs expirés (à appeler périodiquement)
module.exports.cleanExpiredPasswordResetOTPs = () => {
  const now = new Date();
  for (const userId in passwordResetOtpStore) {
    if (passwordResetOtpStore[userId].expiresAt < now) {
      delete passwordResetOtpStore[userId];
    }
  }
};

// Nettoyer les OTPs expirés toutes les 15 minutes
setInterval(() => {
  module.exports.cleanExpiredPasswordResetOTPs();
}, 15 * 60 * 1000);

module.exports.resetPassWord = async (req, res) => {
  try {
    const resetToken = req.params.resetToken;
    const { password } = req.body;

    // Vérifier si le token est valide
    jwt.verify(resetToken, secretKey, async (err, decoded) => {
      if (err) {
        return res.status(400).json({ message: 'Token de réinitialisation invalide ou expiré.' });
      }

      const userId = decoded.id;

      // Rechercher l'utilisateur dans la base de données
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur introuvable.' });
      }

      // Crypter le nouveau mot de passe
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Mettre à jour le mot de passe
      user.password = hashedPassword;
      await user.save();

      return res.status(200).json({ message: 'Mot de passe réinitialisé avec succès.' });
    });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe :', error);
    return res.status(500).json({ message: 'Une erreur est survenue lors de la réinitialisation.' });
  }
};


module.exports.updateUser = async (req, res) => {
  try {
    // Vérification admin
    const adminId = req.user?.id || req.userData?.id;
    const adminUser = await User.findById(adminId);

    const { userId } = req.params;
    const updateFields = req.body;

    // Un admin ne peut pas modifier son propre rôle
    if (updateFields.role && updateFields.role !== "universalLab_Admin" && userId === adminId) {
      return res.status(400).json({
        success: false,
        message: "Un administrateur ne peut pas modifier son propre rôle."
      });
    }

    // Un admin ne peut pas se bloquer lui-même
    if (updateFields.isBlocked === true && userId === adminId) {
      return res.status(400).json({
        success: false,
        message: "Un administrateur ne peut pas se bloquer lui-même."
      });
    }

    // Vérifier si l'utilisateur existe
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Étendre tous les champs envoyés
    let updateData = { ...updateFields };

    // Gérer le parrain si un numéro de téléphone est fourni
    if (updateFields.parrain) {
      // Rechercher le parrain par numéro de téléphone
      const parrainExists = await User.findOne({ telephone: updateFields.parrain });
      
      if (!parrainExists) {
        return res.status(404).json({
          success: false,
          message: "Aucun utilisateur trouvé avec ce numéro de téléphone"
        });
      }

      // Vérifier qu'un utilisateur ne se parraine pas lui-même
      if (parrainExists._id.toString() === userId) {
        return res.status(400).json({
          success: false,
          message: "Un utilisateur ne peut pas être son propre parrain"
        });
      }

      // Assigner l'ID du parrain (CORRIGÉ ICI)
      updateData.parrain = parrainExists._id;
    }

    // Sauvegarder le mot de passe en clair pour l'envoi WhatsApp (si présent)
    const plainPassword = updateFields.password;

    // Hasher le mot de passe si présent
    if (updateFields.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateFields.password, salt);
    }

    // Mise à jour finale
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-password").populate('parrain', 'firstName lastName telephone');

    // Envoyer le mot de passe par WhatsApp si un nouveau mot de passe a été défini
if (plainPassword && updatedUser.telephone) {

  let message = `Bonjour ${updatedUser.firstName} ${updatedUser.lastName}
🔐 Nouveau mot de passe - Universal Fab
Votre nouveau mot de passe est : ${plainPassword}
Pour des raisons de sécurité, nous vous recommandons de le changer lors de votre prochaine connexion.
🌐 Site web : https://actionuniversalfab.com/
`;if (updatedUser.actionsNumber >= 5) {
    message += `📱 WhatsApp : https://chat.whatsapp.com/LJ5ao94sDYPDyYzVsqU49r\n`;
  }
  message += `\nÉquipe Universal Fab`;
  try {
    await sendWhatsAppMessage(updatedUser.telephone, message);
  } catch (whatsappError) {
    console.error("Erreur envoi WhatsApp:", whatsappError);
    return res.status(200).json({
      success: true,
      message: "Utilisateur mis à jour avec succès, mais l'envoi WhatsApp a échoué",
      user: updatedUser,
      whatsappError: "Le message n'a pas pu être envoyé"
    });
  }
}


    return res.status(200).json({
      success: true,
      message: "Utilisateur mis à jour avec succès",
      user: updatedUser
    });

  } catch (error) {
    console.error("Erreur mise à jour utilisateur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur interne du serveur",
      error: error.message
    });
  }
};

module.exports.changePassword = async (req, res) => {
  try {
    const { userId, password, newPassword } = req.body;

    // Validation des données
    if (!userId || !password || !newPassword) {
      return res.status(400).json({ 
        message: "Tous les champs sont requis" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: "Le nouveau mot de passe doit contenir au moins 6 caractères" 
      });
    }

    // Rechercher l'utilisateur par ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ 
        message: "Utilisateur non trouvé" 
      });
    }

    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Mot de passe actuel incorrect" 
      });
    }

    // Vérifier que le nouveau mot de passe est différent
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    
    if (isSamePassword) {
      return res.status(400).json({ 
        message: "Le nouveau mot de passe doit être différent de l'ancien" 
      });
    }

    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Mettre à jour le mot de passe
    user.password = hashedNewPassword;
    await user.save();

    console.log(`✅ Mot de passe changé: ${user.firstName} ${user.lastName} (${user._id})`);

    res.status(200).json({ 
      success: true,
      message: "Mot de passe mis à jour avec succès" 
    });
    
  } catch (error) {
    console.error("❌ Erreur changePassword:", error);
    res.status(500).json({ 
      message: "Erreur lors de la mise à jour du mot de passe",
      error: error.message
    });
  }
};


module.exports.deleteUser = async(req,res) => {
  try {
    const {id}=req.params
    const deleteActionnaire= await User.findByIdAndDelete(id)
    return res.status(200).json({
      success: true, 
      message:"User detele succesfully",deleteActionnaire
    })
  } catch (error) {
    console.error("❌ Erreur changePassword:", error);
    res.status(500).json({ 
      message: "Erreur lors de la mise à jour du mot de passe",
      error: error.message
    });
  }
}