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
        `Votre code de vérification Dioko est: ${otp}. Il expire dans 5 minutes.`
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
    const { telephone, firstName, lastName, password } = req.body;

    // Vérifie si le numéro existe déjà en BD
    const existingUser = await User.findOne({ telephone });
    if (existingUser) {
      return res.status(400).json({ message: "Ce numéro est déjà enregistré." });
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
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // expire après 5 min
    };

    // Envoie le code par WhatsApp
    await sendWhatsAppMessage(
      telephone,
      `🔐 Votre code de vérification Dioko est : ${otp}. Il expire dans 5 minutes.`
    );

    return res.status(200).json({
      message: "Un code de vérification a été envoyé à votre numéro WhatsApp.",
      requireOTP: true,
    });
  } catch (error) {
    console.error("Erreur CreateAccount:", error);
    res.status(500).json({ message: "Erreur interne du serveur", error });
  }
};module.exports.VerifyCreateAccountOTP = async (req, res) => {
  try {
    const { telephone, otp } = req.body;

    // Vérifie si un OTP a été généré pour ce téléphone
    const otpData = otpStore[telephone];
    if (!otpData) {
      return res.status(400).json({ message: "Aucun code OTP trouvé ou expiré." });
    }

    // Vérifie la validité et la correspondance du code
    if (otpData.otp !== otp) {
      return res.status(400).json({ message: "Code OTP incorrect." });
    }
    if (otpData.expiresAt < new Date()) {
      delete otpStore[telephone];
      return res.status(400).json({ message: "Code OTP expiré." });
    }

    // Hash du mot de passe avant création
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(otpData.password, salt);

    // Création du compte utilisateur dans MongoDB
    const newUser = await User.create({
      telephone: otpData.telephone,
      firstName: otpData.firstName,
      lastName: otpData.lastName,
      password: hashedPassword,
      role: "actionnaire",
    
    });

    // Nettoyage : on supprime les données temporaires
    delete otpStore[telephone];

    return res.status(201).json({
      message: "Compte créé et vérifié avec succès 🎉",
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        telephone: newUser.telephone,
      },
    });
  } catch (error) {
    console.error("Erreur VerifyOTP:", error);
    res.status(500).json({ message: "Erreur interne du serveur", error });
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
        dividende: user.dividende
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

    const user = await User.findById(userId).select("-password");
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
      //user 
    });
  } catch (error) {
    console.error("Erreur lors de la vérification OTP:", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
};