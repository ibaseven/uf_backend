const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../Models/UserModel');
const Transaction = require('../Models/TransactionModel');
const { transferToAgent, submitDisburseInvoice } = require('../Services/paydunya');
const { sendWhatsAppMessage } = require('../utils/Whatsapp');



const otpStore = new Map();


const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MIN_WITHDRAWAL = 100;
const MAX_WITHDRAWAL = 100000000;


const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateReference = (userId) => {
  const timestamp = Date.now();
  const userSuffix = userId.toString().slice(-6);
  return `DIV_${timestamp}_${userSuffix}`;
};

const generateTransactionId = () => {
  return `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

setInterval(() => {
  const now = new Date();
  for (const [userId, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(userId);
    }
  }
}, 5 * 60 * 1000);



exports.initiateDividendActionsWithdrawal = async (req, res) => {
  try {
    //console.log("🔵 [INITIATE WITHDRAWAL] Requête reçue :", req.body);

    const { phoneNumber, amount, paymentMethod } = req.body;
    const adminId = req.user.id;

    //console.log("👤 Admin ID :", adminId);

    // Validation des paramètres
    if (!phoneNumber || !amount || !paymentMethod) {
      console.warn("⚠️ Paramètres manquants :", req.body);
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants'
      });
    }

    const parsedAmount = parseFloat(amount);
    //console.log("💰 Montant parsé :", parsedAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.warn("⚠️ Montant invalide :", amount);
      return res.status(400).json({
        success: false,
        message: 'Montant invalide'
      });
    }

    if (parsedAmount < MIN_WITHDRAWAL) {
      console.warn(`⚠️ Montant en dessous du minimum (${MIN_WITHDRAWAL})`);
      return res.status(400).json({
        success: false,
        message: `Montant minimum: ${MIN_WITHDRAWAL} FCFA`
      });
    }

    if (parsedAmount > MAX_WITHDRAWAL) {
      console.warn(`⚠️ Montant au-dessus du maximum (${MAX_WITHDRAWAL})`);
      return res.status(400).json({
        success: false,
        message: `Montant maximum: ${MAX_WITHDRAWAL.toLocaleString()} FCFA`
      });
    }

    const actionnaire = await User.findById(adminId);
    //console.log("👤 Actionnaire trouvé :", actionnaire ? actionnaire._id : "Aucun");

    const availableDividend = parseFloat(actionnaire.dividende_actions) || 0;
    //console.log(`💵 Dividende disponible : ${availableDividend}`);

    if (availableDividend < parsedAmount) {
      //console.warn("❌ Solde insuffisant", { available: availableDividend, requested: parsedAmount });
      return res.status(400).json({
        success: false,
        message: `Solde insuffisant. Disponible: ${availableDividend.toLocaleString()} FCFA`,
        data: {
          available: availableDividend,
          requested: parsedAmount,
          shortage: parsedAmount - availableDividend
        }
      });
    }

    //console.log("🟦 Envoi de la requête PayDunya...");

    let transferResult;
    try {
      transferResult = await transferToAgent({
        account_alias: phoneNumber,
        amount: parsedAmount,
        withdraw_mode: paymentMethod,
        callback_url: 'https://www.diokogroup.com'
      });
      //console.log("🟩 Réponse PayDunya :", transferResult);
    } catch (error) {
      console.error("❌ Erreur PayDunya :", error);
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la création du retrait'
      });
    }

    // ✅ Vérifier succès PayDunya
    if (!transferResult || transferResult.response_code !== "00") {
      console.error("❌ PayDunya échec :", transferResult);
      return res.status(400).json({
        success: false,
        message: transferResult?.message || 'Erreur PayDunya'
      });
    }

    // disburse_token = preuve de retrait en cours
    const disburseInvoice = transferResult.disburse_token;
    if (!disburseInvoice) {
      console.error("❌ disburse_token manquant :", transferResult);
      return res.status(400).json({
        success: false,
        message: 'Réponse PayDunya incomplète'
      });
    }
    //console.log("📄 disburse_token reçu :", disburseInvoice);

    // Génération OTP
    const reference = generateReference(adminId);
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

   /*  console.log("🔐 OTP généré :", otp);
    console.log("📌 Référence :", reference);
    console.log("⏳ Expiration OTP :", expiresAt); */

    // Stocker OTP
    otpStore.set(adminId.toString(), {
      code: otp,
      expiresAt,
      reference,
      amount: parsedAmount,
      phoneNumber,
      paymentMethod,
      disburseInvoice
    });
    //console.log("🗄️ OTP stocké pour :", adminId);

    // Envoi OTP via WhatsApp
    if (actionnaire.telephone) {
      const message = `Code UniversallFab: ${otp} Retrait de ${parsedAmount.toLocaleString()} FCFA vers ${phoneNumber} Valide 5 minutes.`;
      //console.log("📨 Envoi OTP WhatsApp :", message);
      try {
        await sendWhatsAppMessage(actionnaire.telephone, message);
       // console.log("🟩 OTP envoyé avec succès !");
      } catch (error) {
        console.warn("⚠️ Échec envoi OTP :", error.message);
      }
    }

    //console.log("✅ Retrait initialisé avec succès");

    return res.json({
      success: true,
      message: 'Code de confirmation envoyé par Whatsapp',
      data: {
        reference,
        amount: parsedAmount,
        phoneNumber,
        paymentMethod,
        expiresIn: '5 minutes',
        currentBalance: availableDividend,
        remainingAfter: availableDividend - parsedAmount
      }
    });

  } catch (error) {
    console.error("❌ ERREUR INITIALE initiateDividendWithdrawal :", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};
exports.initiateDividendProjectWithdrawal = async (req, res) => {
  try {
    //console.log("🔵 [INITIATE WITHDRAWAL] Requête reçue :", req.body);

    const { phoneNumber, amount, paymentMethod } = req.body;
    const adminId = req.user.id;

    //console.log("👤 Admin ID :", adminId);

    // Validation des paramètres
    if (!phoneNumber || !amount || !paymentMethod) {
      console.warn("⚠️ Paramètres manquants :", req.body);
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants'
      });
    }

    const parsedAmount = parseFloat(amount);
    //console.log("💰 Montant parsé :", parsedAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.warn("⚠️ Montant invalide :", amount);
      return res.status(400).json({
        success: false,
        message: 'Montant invalide'
      });
    }

    if (parsedAmount < MIN_WITHDRAWAL) {
      console.warn(`⚠️ Montant en dessous du minimum (${MIN_WITHDRAWAL})`);
      return res.status(400).json({
        success: false,
        message: `Montant minimum: ${MIN_WITHDRAWAL} FCFA`
      });
    }

    if (parsedAmount > MAX_WITHDRAWAL) {
      console.warn(`⚠️ Montant au-dessus du maximum (${MAX_WITHDRAWAL})`);
      return res.status(400).json({
        success: false,
        message: `Montant maximum: ${MAX_WITHDRAWAL.toLocaleString()} FCFA`
      });
    }

    const actionnaire = await User.findById(adminId);
    //console.log("👤 Actionnaire trouvé :", actionnaire ? actionnaire._id : "Aucun");

    const availableDividend = parseFloat(actionnaire.dividende_project) || 0;
    //console.log(`💵 Dividende disponible : ${availableDividend}`);

    if (availableDividend < parsedAmount) {
      //console.warn("❌ Solde insuffisant", { available: availableDividend, requested: parsedAmount });
      return res.status(400).json({
        success: false,
        message: `Solde insuffisant. Disponible: ${availableDividend.toLocaleString()} FCFA`,
        data: {
          available: availableDividend,
          requested: parsedAmount,
          shortage: parsedAmount - availableDividend
        }
      });
    }

    //console.log("🟦 Envoi de la requête PayDunya...");

    let transferResult;
    try {
      transferResult = await transferToAgent({
        account_alias: phoneNumber,
        amount: parsedAmount,
        withdraw_mode: paymentMethod,
        callback_url: 'https://www.diokogroup.com'
      });
      //console.log("🟩 Réponse PayDunya :", transferResult);
    } catch (error) {
      console.error("❌ Erreur PayDunya :", error);
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la création du retrait'
      });
    }

    // ✅ Vérifier succès PayDunya
    if (!transferResult || transferResult.response_code !== "00") {
      console.error("❌ PayDunya échec :", transferResult);
      return res.status(400).json({
        success: false,
        message: transferResult?.message || 'Erreur PayDunya'
      });
    }

    // disburse_token = preuve de retrait en cours
    const disburseInvoice = transferResult.disburse_token;
    if (!disburseInvoice) {
      console.error("❌ disburse_token manquant :", transferResult);
      return res.status(400).json({
        success: false,
        message: 'Réponse PayDunya incomplète'
      });
    }
    //console.log("📄 disburse_token reçu :", disburseInvoice);

    // Génération OTP
    const reference = generateReference(adminId);
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

   /*  console.log("🔐 OTP généré :", otp);
    console.log("📌 Référence :", reference);
    console.log("⏳ Expiration OTP :", expiresAt); */

    // Stocker OTP
    otpStore.set(adminId.toString(), {
      code: otp,
      expiresAt,
      reference,
      amount: parsedAmount,
      phoneNumber,
      paymentMethod,
      disburseInvoice
    });
    //console.log("🗄️ OTP stocké pour :", adminId);

    // Envoi OTP via WhatsApp
    if (actionnaire.telephone) {
      const message = `Code UniversallFab: ${otp} Retrait de ${parsedAmount.toLocaleString()} FCFA vers ${phoneNumber} Valide 5 minutes.`;
      //console.log("📨 Envoi OTP WhatsApp :", message);
      try {
        await sendWhatsAppMessage(actionnaire.telephone, message);
       // console.log("🟩 OTP envoyé avec succès !");
      } catch (error) {
        console.warn("⚠️ Échec envoi OTP :", error.message);
      }
    }

    //console.log("✅ Retrait initialisé avec succès");

    return res.json({
      success: true,
      message: 'Code de confirmation envoyé par Whatsapp',
      data: {
        reference,
        amount: parsedAmount,
        phoneNumber,
        paymentMethod,
        expiresIn: '5 minutes',
        currentBalance: availableDividend,
        remainingAfter: availableDividend - parsedAmount
      }
    });

  } catch (error) {
    console.error("❌ ERREUR INITIALE initiateDividendWithdrawal :", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};


exports.confirmDividendProjectWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { otpCode } = req.body;
    const adminId = req.user.id;

    const admin = await User.findById(adminId).session(session);
const superAdmin = await User.findOne({ isTheSuperAdmin: true });
    // Vérifier les données stockées
    const otpData = otpStore.get(adminId.toString());

    if (!otpData) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Aucune demande de retrait trouvée ou expirée'
      });
    }

    // Si OTP requis (pays dans la liste SMS), valider le code
    if (!otpData.skipOTP) {
      // Validation du code OTP
      if (!otpCode) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Code OTP requis'
        });
      }

      if (otpData.code !== otpCode) {
        await session.abortTransaction();
        return res.status(401).json({
          success: false,
          message: 'Code OTP incorrect'
        });
      }

      if (new Date() > otpData.expiresAt) {
        otpStore.delete(adminId.toString());
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Code OTP expiré'
        });
      }
    }
    // Fin de la validation OTP - continuer avec le traitement du retrait

    // Vérifier le solde (en centimes)
    const currentDividendCents = Math.round((admin.dividende_project || 0) * 100);
    const amountCents = Math.round(otpData.amount * 100);
    
    if (currentDividendCents < amountCents) {
      otpStore.delete(adminId.toString());
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Solde insuffisant: ${currentDividendCents / 100} FCFA`
      });
    }

    // Soumettre à PayDunya
    const disbursementResult = await submitDisburseInvoice(otpData.disburseInvoice);
    
    // Vérifier le résultat
    const isSuccess = disbursementResult.success && 
      disbursementResult.data?.response_code === '00';

    if (!isSuccess) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: disbursementResult.message || 'Transaction échouée'
      });
    }

    // Déterminer le statut
  const paydounyaStatus = disbursementResult.data?.status;
    let transactionStatus = 'confirmed';
   
    if (paydounyaStatus === 'pending' || paydounyaStatus === 'processing') {
      transactionStatus = 'pending';
    }else if(paydounyaStatus === "failed"){
       await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: disbursementResult.message || 'Transaction échouée'
      });
    }


    // Créer la transaction
    const transaction = new Transaction({
      type: 'dividend_withdrawal',
      amount: otpData.amount,
      userId: adminId,
      recipientPhone: otpData.phoneNumber,
      paymentMethod: otpData.paymentMethod,
      status: transactionStatus,
      description: `Retrait dividendes ${otpData.amount.toLocaleString()} FCFA`,
      reference: otpData.reference,
      id_transaction: generateTransactionId(),
      invoiceToken: otpData.disburseInvoice,
      paydounyaReferenceId: disbursementResult.data?.transaction_id,
      token: crypto.randomBytes(16).toString('hex')
    });
    
    await transaction.save({ session });

    // Mettre à jour les dividendes
    const newDividendCents = currentDividendCents - amountCents;
    admin.dividende_project = newDividendCents / 100;
     superAdmin.dividende_actions = newDividendCents /100;
    await admin.save({ session });
    await superAdmin.save({session})

    // Supprimer l'OTP
    otpStore.delete(adminId.toString());

    // Commit
    await session.commitTransaction();

    // Notification (hors transaction)
   /*  if (admin.telephone) {
      const message = transactionStatus === 'completed'
        ? `Retrait confirmé ! Montant: ${otpData.amount.toLocaleString()} FCFA Vers: ${otpData.phoneNumber} Référence: ${otpData.reference} Solde: ${(newDividendCents / 100).toLocaleString()} FCFA`
        : `Retrait en cours Montant: ${otpData.amount.toLocaleString()} FCFA Vers: ${otpData.phoneNumber} Référence: ${otpData.reference}`;
      
      try {
        await sendWhatsAppMessage(actionnaire.telephone, message);
      } catch (error) {
        console.warn('⚠️ Erreur notification:', error.message);
      }
    } */

    // Réponse
    return res.json({
      success: true,
      message: transactionStatus === 'completed' 
        ? 'Retrait effectué avec succès' 
        : 'Retrait en cours de traitement',
      transaction: {
        id: transaction._id,
        reference: transaction.reference,
        amount: otpData.amount,
        status: transactionStatus
      },
      dividends: {
        previous: currentDividendCents / 100,
        withdrawn: otpData.amount,
        remaining: newDividendCents / 100
      }
    });
    
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    
    console.error('❌ Erreur confirmation:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur'
    });
    
  } finally {
    session.endSession();
  }
};
exports.confirmDividendActionsWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { otpCode } = req.body;
    const adminId = req.user.id;

    const admin = await User.findById(adminId).session(session);
    const superAdmin = await User.findOne({ isTheSuperAdmin: true });
    // Vérifier les données stockées
    const otpData = otpStore.get(adminId.toString());

    if (!otpData) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Aucune demande de retrait trouvée ou expirée'
      });
    }

    // Si OTP requis (pays dans la liste SMS), valider le code
    if (!otpData.skipOTP) {
      // Validation du code OTP
      if (!otpCode) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Code OTP requis'
        });
      }

      if (otpData.code !== otpCode) {
        await session.abortTransaction();
        return res.status(401).json({
          success: false,
          message: 'Code OTP incorrect'
        });
      }

      if (new Date() > otpData.expiresAt) {
        otpStore.delete(adminId.toString());
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Code OTP expiré'
        });
      }
    }
    // Fin de la validation OTP - continuer avec le traitement du retrait

    // Vérifier le solde (en centimes)
    const currentDividendCents = Math.round((admin.dividende_actions || 0) * 100);
    const amountCents = Math.round(otpData.amount * 100);
    
    if (currentDividendCents < amountCents) {
      otpStore.delete(adminId.toString());
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Solde insuffisant: ${currentDividendCents / 100} FCFA`
      });
    }

    // Soumettre à PayDunya
    const disbursementResult = await submitDisburseInvoice(otpData.disburseInvoice);
    
    // Vérifier le résultat
    const isSuccess = disbursementResult.success && 
      disbursementResult.data?.response_code === '00';

    if (!isSuccess) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: disbursementResult.message || 'Transaction échouée'
      });
    }

    
    const paydounyaStatus = disbursementResult.data?.status;
    let transactionStatus = 'confirmed';
   
    if (paydounyaStatus === 'pending' || paydounyaStatus === 'processing') {
      transactionStatus = 'pending';
    }else if(paydounyaStatus === "failed"){
       await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: disbursementResult.message || 'Transaction échouée'
      });
    }

    // Créer la transaction
    const transaction = new Transaction({
      type: 'dividend_withdrawal',
      amount: otpData.amount,
      userId: adminId,
      recipientPhone: otpData.phoneNumber,
      paymentMethod: otpData.paymentMethod,
      status: transactionStatus,
      description: `Retrait dividendes ${otpData.amount.toLocaleString()} FCFA`,
      reference: otpData.reference,
      id_transaction: generateTransactionId(),
      invoiceToken: otpData.disburseInvoice,
      paydounyaReferenceId: disbursementResult.data?.transaction_id,
      token: crypto.randomBytes(16).toString('hex')
    });
    
    await transaction.save({ session });

    // Mettre à jour les dividendes
    const newDividendCents = currentDividendCents - amountCents;
    admin.dividende_actions = newDividendCents / 100;
    superAdmin.dividende_actions = newDividendCents /100;
    await admin.save({ session });
    await superAdmin.save({session})
    // Supprimer l'OTP
    otpStore.delete(adminId.toString());

    // Commit
    await session.commitTransaction();

    // Notification (hors transaction)
   /*  if (admin.telephone) {
      const message = transactionStatus === 'completed'
        ? `Retrait confirmé ! Montant: ${otpData.amount.toLocaleString()} FCFA Vers: ${otpData.phoneNumber} Référence: ${otpData.reference} Solde: ${(newDividendCents / 100).toLocaleString()} FCFA`
        : `Retrait en cours Montant: ${otpData.amount.toLocaleString()} FCFA Vers: ${otpData.phoneNumber} Référence: ${otpData.reference}`;
      
      try {
        await sendWhatsAppMessage(actionnaire.telephone, message);
      } catch (error) {
        console.warn('⚠️ Erreur notification:', error.message);
      }
    } */

    // Réponse
    return res.json({
      success: true,
      message: transactionStatus === 'completed' 
        ? 'Retrait effectué avec succès' 
        : 'Retrait en cours de traitement',
      transaction: {
        id: transaction._id,
        reference: transaction.reference,
        amount: otpData.amount,
        status: transactionStatus
      },
      dividends: {
        previous: currentDividendCents / 100,
        withdrawn: otpData.amount,
        remaining: newDividendCents / 100
      }
    });
    
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    
    console.error('❌ Erreur confirmation:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur'
    });
    
  } finally {
    session.endSession();
  }}
  
;module.exports.deducteTheFee = async (req, res) => {
  try {
    const userId = req.user.id;
    const { montant, description } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (user.isTheSuperAdmin !== true) {
      return res.status(403).json({
        message: "Vous n'avez pas l'autorisation pour cette action"
      });
    }

    const owner = await User.findOne({ isTheOwner: true });
    const superAdmin = await User.findOne({ isTheSuperAdmin: true });
    if (!owner) {
      return res.status(404).json({ message: "Owner introuvable" });
    }

    if (owner.dividende_actions < montant) {
      return res.status(400).json({ message: "Solde insuffisant" });
    }

  let reste = montant;

// Priorité aux dividendes actions
if (owner.dividende_actions >= reste) {
  owner.dividende_actions -= reste;
  superAdmin.dividende_actions -= reste;
  reste = 0;
} else {
  reste -= owner.dividende_actions;
  reste = superAdmin.dividende_actions;
  owner.dividende_actions = 0;
  superAdmin.dividende_actions=0;
}

// Puis on utilise dividende_project si nécessaire
if (reste > 0) {
  if (owner.dividende_project >= reste) {
    owner.dividende_project -= reste;
    superAdmin.dividende_project -= reste;
    reste = 0;
  } else {
    // Solde insuffisant total
    return res.status(400).json({ message: "Solde insuffisant dans les dividendes" });
  }
}
    await Fees.create({
      montant,
      description,
      createdBy: userId,
      ownerId: owner._id,
      date: new Date()
    });

    await owner.save();
    await superAdmin.save()

    // 4️⃣ Message WhatsApp (si numéro présent)
    if (owner.telephone) {
      const message = 
        `Bonjour ${owner.firstName + owner.lastName} une Déduction a etait effectuée pour des frais de service .`+`Montant : ${Number(montant).toLocaleString()} FCFA\n` +`Description : ${description}\n` + `Nouveau solde : ${owner.dividende_actions.toLocaleString()} FCFA`;
      try {
        await sendWhatsAppMessage(owner.telephone, message);
      } catch (error) {
        console.warn("⚠️ Échec d'envoi WhatsApp :", error.message);
      }
    }

    return res.status(200).json({
      message: "Frais déduits avec succès",
      nouveauSolde: owner.dividende_actions,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erreur interne du serveur",
      error: error.message
    });
  }
};

// ==========================================
// FONCTIONS POUR LES ACTIONNAIRES
// ==========================================

// Initier un retrait de dividendes pour un actionnaire
exports.initiateActionnaireWithdrawal = async (req, res) => {
  try {
    const { phoneNumber, amount, paymentMethod } = req.body;
    const userId = req.user.id;

    // Validation des paramètres
    if (!phoneNumber || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants (phoneNumber, amount, paymentMethod)'
      });
    }

    const parsedAmount = Number.parseFloat(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Montant invalide'
      });
    }

    if (parsedAmount < MIN_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Montant minimum: ${MIN_WITHDRAWAL} FCFA`
      });
    }

    if (parsedAmount > MAX_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Montant maximum: ${MAX_WITHDRAWAL.toLocaleString()} FCFA`
      });
    }

    // Récupérer l'actionnaire
    const actionnaire = await User.findById(userId);
    if (!actionnaire) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Récupérer l'owner pour vérifier son solde dividende_actions
    const owner = await User.findOne({ isTheOwner: true });
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner non trouvé'
      });
    }

    // 1. Vérifier d'abord le solde dividende_actions de l'owner (admin)
    const ownerDividendeActions = Number.parseFloat(owner.dividende_actions);
    if (ownerDividendeActions < parsedAmount) {
      return res.status(400).json({
        success: false,
        message: `Solde entreprise insuffisant.`,
        data: {
          available: ownerDividendeActions,
          requested: parsedAmount,
          shortage: parsedAmount - ownerDividendeActions
        }
      });
    }

    // 2. Ensuite vérifier le solde dividende de l'actionnaire
    const actionnaireBalance = Number.parseFloat(actionnaire.dividende) || 0;
    if (actionnaireBalance < parsedAmount) {
      return res.status(400).json({
        success: false,
        message: `Votre solde est insuffisant. Disponible: ${actionnaireBalance.toLocaleString()} FCFA`,
        data: {
          available: actionnaireBalance,
          requested: parsedAmount,
          shortage: parsedAmount - actionnaireBalance
        }
      });
    }

    // Appel PayDunya
    let transferResult;
    try {
      transferResult = await transferToAgent({
        account_alias: phoneNumber,
        amount: parsedAmount,
        withdraw_mode: paymentMethod,
        callback_url: 'https://www.diokogroup.com'
      });
    } catch (error) {
      console.error("Erreur PayDunya :", error);
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la création du retrait'
      });
    }

    // Vérifier succès PayDunya
    if (!transferResult || transferResult.response_code !== "00") {
      return res.status(400).json({
        success: false,
        message: transferResult?.message || 'Erreur PayDunya'
      });
    }

    const disburseInvoice = transferResult.disburse_token;
    if (!disburseInvoice) {
      return res.status(400).json({
        success: false,
        message: 'Réponse PayDunya incomplète'
      });
    }

    // Génération OTP
    const reference = generateReference(userId);
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    // Stocker OTP avec type 'actionnaire' et les IDs nécessaires
    otpStore.set(userId.toString(), {
      code: otp,
      expiresAt,
      reference,
      amount: parsedAmount,
      phoneNumber,
      paymentMethod,
      disburseInvoice,
      type: 'actionnaire',
      ownerId: owner._id
    });

    // Envoi OTP via WhatsApp
    if (actionnaire.telephone) {
      const message = `Code UniversallFab: ${otp}\nRetrait de ${parsedAmount.toLocaleString()} FCFA vers ${phoneNumber}\nValide 5 minutes.`;
      try {
        await sendWhatsAppMessage(actionnaire.telephone, message);
      } catch (error) {
        console.warn("Échec envoi OTP :", error.message);
      }
    }

    return res.json({
      success: true,
      message: 'Code de confirmation envoyé par WhatsApp',
      data: {
        reference,
        amount: parsedAmount,
        phoneNumber,
        paymentMethod,
        expiresIn: '5 minutes',
        currentBalance: actionnaireBalance,
        remainingAfter: actionnaireBalance - parsedAmount
      }
    });

  } catch (error) {
    console.error("Erreur initiateActionnaireWithdrawal :", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Confirmer un retrait de dividendes pour un actionnaire
exports.confirmActionnaireWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { otpCode } = req.body;
    const userId = req.user.id;

    const actionnaire = await User.findById(userId).session(session);
    if (!actionnaire) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Récupérer l'owner et le superAdmin
    const owner = await User.findOne({ isTheOwner: true }).session(session);
    const superAdmin = await User.findOne({ isTheSuperAdmin: true }).session(session);

    if (!owner) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Owner non trouvé'
      });
    }

    // Vérifier les données stockées
    const otpData = otpStore.get(userId.toString());

    if (!otpData) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Aucune demande de retrait trouvée ou expirée'
      });
    }

    // Validation du code OTP
    if (!otpCode) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Code OTP requis'
      });
    }

    if (otpData.code !== otpCode) {
      await session.abortTransaction();
      return res.status(401).json({
        success: false,
        message: 'Code OTP incorrect'
      });
    }

    if (new Date() > otpData.expiresAt) {
      otpStore.delete(userId.toString());
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Code OTP expiré'
      });
    }

    const amountCents = Math.round(otpData.amount * 100);

    // 1. Vérifier le solde dividende_actions de l'owner
    const ownerDividendeCents = Math.round((owner.dividende_actions || 0) * 100);
    if (ownerDividendeCents < amountCents) {
      otpStore.delete(userId.toString());
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Solde entreprise insuffisant: ${ownerDividendeCents / 100} FCFA`
      });
    }

    // 2. Vérifier le solde dividende de l'actionnaire
    const currentDividendCents = Math.round((actionnaire.dividende || 0) * 100);
    if (currentDividendCents < amountCents) {
      otpStore.delete(userId.toString());
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Votre solde insuffisant: ${currentDividendCents / 100} FCFA`
      });
    }

    // Soumettre à PayDunya
    const disbursementResult = await submitDisburseInvoice(otpData.disburseInvoice);

    // Vérifier le résultat
    const isSuccess = disbursementResult.success &&
      disbursementResult.data?.response_code === '00';

    if (!isSuccess) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: disbursementResult.message || 'Transaction échouée'
      });
    }

    // Déterminer le statut
   const paydounyaStatus = disbursementResult.data?.status;
    let transactionStatus = 'confirmed';
   
    if (paydounyaStatus === 'pending' || paydounyaStatus === 'processing') {
      transactionStatus = 'pending';
    }else if(paydounyaStatus === "failed"){
       await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: disbursementResult.message || 'Transaction échouée'
      });
    }


    // Créer la transaction
    const transaction = new Transaction({
      type: 'actionnaire_dividend_withdrawal',
      amount: otpData.amount,
      userId: userId,
      recipientPhone: otpData.phoneNumber,
      paymentMethod: otpData.paymentMethod,
      status: transactionStatus,
      description: `Retrait dividendes actionnaire ${otpData.amount.toLocaleString()} FCFA`,
      reference: otpData.reference,
      id_transaction: generateTransactionId(),
      invoiceToken: otpData.disburseInvoice,
      paydounyaReferenceId: disbursementResult.data?.transaction_id,
      token: crypto.randomBytes(16).toString('hex')
    });

    await transaction.save({ session });

    // Mettre à jour les dividendes de l'actionnaire
    const newDividendCents = currentDividendCents - amountCents;
    actionnaire.dividende = newDividendCents / 100;
    await actionnaire.save({ session });

    // Mettre à jour le dividende_actions de l'owner
    const newOwnerDividendeCents = ownerDividendeCents - amountCents;
    owner.dividende_actions = newOwnerDividendeCents / 100;
    await owner.save({ session });

    // Mettre à jour le superAdmin si existant
    if (superAdmin) {
      const superAdminDividendeCents = Math.round((superAdmin.dividende_actions || 0) * 100);
      superAdmin.dividende_actions = (superAdminDividendeCents - amountCents) / 100;
      await superAdmin.save({ session });
    }

    // Supprimer l'OTP
    otpStore.delete(userId.toString());

    // Commit
    await session.commitTransaction();

    // Notification WhatsApp
    if (actionnaire.telephone) {
      const message = transactionStatus === 'confirmed'
        ? `Retrait confirmé !\nMontant: ${otpData.amount.toLocaleString()} FCFA\nVers: ${otpData.phoneNumber}\nRéférence: ${otpData.reference}\nNouveau solde: ${(newDividendCents / 100).toLocaleString()} FCFA`
        : `Retrait en cours de traitement\nMontant: ${otpData.amount.toLocaleString()} FCFA\nVers: ${otpData.phoneNumber}\nRéférence: ${otpData.reference}`;

      try {
        await sendWhatsAppMessage(actionnaire.telephone, message);
      } catch (error) {
        console.warn('Erreur notification:', error.message);
      }
    }

    // Réponse
    return res.json({
      success: true,
      message: transactionStatus === 'confirmed'
        ? 'Retrait effectué avec succès'
        : 'Retrait en cours de traitement',
      transaction: {
        id: transaction._id,
        reference: transaction.reference,
        amount: otpData.amount,
        status: transactionStatus
      },
      dividends: {
        previous: currentDividendCents / 100,
        withdrawn: otpData.amount,
        remaining: newDividendCents / 100
      }
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error('Erreur confirmActionnaireWithdrawal:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });

  } finally {
    session.endSession();
  }
};
