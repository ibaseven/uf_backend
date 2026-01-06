const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../Models/UserModel');
const Transaction = require('../Models/TransactionModel');
const { transferToAgent, submitDisburseInvoice } = require('../Services/paydunya');
const { sendWhatsAppMessage, sendOTPMessage, shouldUseOTP } = require('../utils/Whatsapp');



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

    // Vérifier si ce pays nécessite un OTP
    if (!shouldUseOTP(actionnaire.telephone)) {
      // Pour les pays hors liste : pas d'OTP requis
      // On stocke quand même les données pour la confirmation
      otpStore.set(adminId.toString(), {
        code: null, // Pas de code OTP
        expiresAt,
        reference,
        amount: parsedAmount,
        phoneNumber,
        paymentMethod,
        disburseInvoice,
        skipOTP: true // Indicateur pour sauter la vérification OTP
      });

      return res.json({
        success: true,
        message: 'Retrait initialisé. Vous pouvez confirmer directement.',
        requireOTP: false,
        data: {
          reference,
          amount: parsedAmount,
          phoneNumber,
          paymentMethod,
          currentBalance: availableDividend,
          remainingAfter: availableDividend - parsedAmount
        }
      });
    }

    // Pour les pays dans la liste SMS : envoyer OTP
    if (actionnaire.telephone) {
      const message = `Code UniversallFab: ${otp} Retrait de ${parsedAmount.toLocaleString()} FCFA vers ${phoneNumber} Valide 5 minutes.`;
      try {
        await sendOTPMessage(actionnaire.telephone, message);
      } catch (error) {
        console.warn("⚠️ Échec envoi OTP :", error.message);
      }
    }

    return res.json({
      success: true,
      message: `Code de confirmation envoyé par SMS`,
      requireOTP: true,
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

    // Vérifier si ce pays nécessite un OTP
    if (!shouldUseOTP(actionnaire.telephone)) {
      // Pour les pays hors liste : pas d'OTP requis
      // On stocke quand même les données pour la confirmation
      otpStore.set(adminId.toString(), {
        code: null, // Pas de code OTP
        expiresAt,
        reference,
        amount: parsedAmount,
        phoneNumber,
        paymentMethod,
        disburseInvoice,
        skipOTP: true // Indicateur pour sauter la vérification OTP
      });

      return res.json({
        success: true,
        message: 'Retrait initialisé. Vous pouvez confirmer directement.',
        requireOTP: false,
        data: {
          reference,
          amount: parsedAmount,
          phoneNumber,
          paymentMethod,
          currentBalance: availableDividend,
          remainingAfter: availableDividend - parsedAmount
        }
      });
    }

    // Pour les pays dans la liste SMS : envoyer OTP
    if (actionnaire.telephone) {
      const message = `Code UniversallFab: ${otp} Retrait de ${parsedAmount.toLocaleString()} FCFA vers ${phoneNumber} Valide 5 minutes.`;
      try {
        await sendOTPMessage(actionnaire.telephone, message);
      } catch (error) {
        console.warn("⚠️ Échec envoi OTP :", error.message);
      }
    }

    return res.json({
      success: true,
      message: `Code de confirmation envoyé par SMS`,
      requireOTP: true,
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

    // Déterminer le statut
    const paydounyaStatus = disbursementResult.data?.status;
    let transactionStatus = 'confirmed';
    
    if (paydounyaStatus === 'pending' || paydounyaStatus === 'processing') {
      transactionStatus = 'pending';
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
  }
};