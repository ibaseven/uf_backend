const mongoose = require('mongoose');
const Moratoire = require('../Models/MoratoireModel');
const User = require('../Models/UserModel');
const Transactions = require('../Models/TransactionModel');
const Settings = require('../Models/SettingsModel');
const { createInvoice } = require('../Services/paydunya');
const { generateMoratoirePDF, uploadMoratoirePDFToS3 } = require('../utils/generateMoratoirePdf');
const { generateContractPDF, uploadPDFToS3 } = require('../utils/generatedPdf');
const { sendWhatsAppDocument, sendWhatsAppMessage } = require('../utils/Whatsapp');

// ─── ADMIN : Créer un engagement moratoire ───────────────────────────────────
module.exports.createMoratoireEngagement = async (req, res) => {
  try {
    const { userId, actionNumber, totalAmount: totalAmountBody, versementMontant, startDate, endDate } = req.body;

    if (!userId || !actionNumber || !versementMontant || !startDate || !endDate) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Actionnaire introuvable.' });

    // Utiliser le montant total fourni par l'admin, sinon calculer depuis settings
    let totalAmount = totalAmountBody;
    if (!totalAmount || totalAmount <= 0) {
      const settings = await Settings.findOne();
      const pricePerAction = settings?.pricePerAction || 2000;
      totalAmount = pricePerAction * actionNumber;
    }

    // Créer l'engagement
    const moratoire = new Moratoire({
      userId,
      actionNumber,
      totalAmount,
      versementMontant,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
    await moratoire.save();

    // Générer et envoyer le contrat moratoire par WhatsApp
    try {
      console.log('📄 Génération du contrat moratoire PDF...');
      const pdfBuffer = await generateMoratoirePDF(moratoire, user);
      const fileName = `ContratMoratoire_${moratoire._id}_${Date.now()}.pdf`;
      const pdfUrl = await uploadMoratoirePDFToS3(pdfBuffer, fileName);

      moratoire.contractPdfUrl = pdfUrl.cleanUrl;
      await moratoire.save();

      await sendWhatsAppDocument(
        user.telephone,
        pdfUrl.cleanUrl,
        `Bonjour ${user.firstName} !\n` +
        `Votre contrat d'engagement de paiement moratoire est prêt.\n` +
        `Nombre d'actions : ${actionNumber}\n` +
        `Montant total : ${totalAmount.toLocaleString()} FCFA\n` +
        `Versement : ${versementMontant.toLocaleString()} FCFA\n` +
        `Début : ${new Date(startDate).toLocaleDateString('fr-FR')}\n` +
        `Fin : ${new Date(endDate).toLocaleDateString('fr-FR')}\n` +
        `Connectez-vous sur la plateforme pour effectuer vos versements.`
      );

      console.log('✅ Contrat moratoire envoyé par WhatsApp');
    } catch (pdfErr) {
      console.error('❌ Erreur envoi contrat moratoire:', pdfErr.message);
    }

    return res.status(201).json({
      message: 'Engagement moratoire créé avec succès.',
      data: moratoire
    });
  } catch (error) {
    console.error('❌ createMoratoireEngagement:', error.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// ─── ADMIN : Lister tous les engagements moratoires ──────────────────────────
module.exports.getAllMoratoireEngagements = async (req, res) => {
  try {
    const moratoires = await Moratoire.find()
      .populate('userId', 'firstName lastName telephone actionsNumber')
      .sort({ createdAt: -1 });
    return res.status(200).json({ data: moratoires });
  } catch (error) {
    console.error('❌ getAllMoratoireEngagements:', error.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// ─── ADMIN : Obtenir un engagement par ID ────────────────────────────────────
module.exports.getMoratoireById = async (req, res) => {
  try {
    const { id } = req.params;
    const moratoire = await Moratoire.findById(id)
      .populate('userId', 'firstName lastName telephone actionsNumber nationalite dateNaissance adresse ville pays');
    if (!moratoire) return res.status(404).json({ message: 'Engagement moratoire introuvable.' });
    return res.status(200).json({ data: moratoire });
  } catch (error) {
    console.error('❌ getMoratoireById:', error.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// ─── ACTIONNAIRE : Obtenir ses propres engagements moratoires ─────────────────
module.exports.getMoratoireByUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const moratoires = await Moratoire.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json({ data: moratoires });
  } catch (error) {
    console.error('❌ getMoratoireByUser:', error.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// ─── ADMIN : Modifier le montant du versement ─────────────────────────────────
module.exports.updateVersementMontant = async (req, res) => {
  try {
    const { id } = req.params;
    const { versementMontant } = req.body;

    if (!versementMontant || versementMontant <= 0) {
      return res.status(400).json({ message: 'Montant de versement invalide.' });
    }

    const moratoire = await Moratoire.findById(id);
    if (!moratoire) return res.status(404).json({ message: 'Engagement moratoire introuvable.' });
    if (moratoire.status !== 'active') {
      return res.status(400).json({ message: 'Impossible de modifier un engagement non actif.' });
    }

    moratoire.versementMontant = versementMontant;
    await moratoire.save();

    // Notifier l'actionnaire
   /*  try {
      const user = await User.findById(moratoire.userId);
      if (user) {
        await sendWhatsAppMessage(
          user.telephone,
          `Bonjour ${user.firstName} !\n` +
          `Le montant de votre versement moratoire a été mis à jour.\n` +
          `Nouveau montant : ${versementMontant.toLocaleString()} FCFA\n` +
          `Connectez-vous sur la plateforme pour effectuer votre prochain versement.`
        );
      }
    } catch (e) {
      console.error('❌ Notification WhatsApp:', e.message);
    } */

    return res.status(200).json({
      message: 'Montant de versement mis à jour.',
      data: moratoire
    });
  } catch (error) {
    console.error('❌ updateVersementMontant:', error.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// ─── ADMIN : Enregistrer un versement manuel (espèces) ───────────────────────
module.exports.addVersementManuel = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { id } = req.params;
    const { amount, note } = req.body;

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Montant invalide.' });
    }

    const moratoire = await Moratoire.findById(id).session(session);
    if (!moratoire) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Engagement moratoire introuvable.' });
    }
    if (moratoire.status !== 'active') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Cet engagement n\'est plus actif.' });
    }

    const remaining = moratoire.totalAmount - moratoire.totalPaid;
    if (amount > remaining) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Montant trop élevé. Reste à payer : ${remaining.toLocaleString()} FCFA.`
      });
    }

    // Ajouter le versement manuel (confirmé directement)
    moratoire.versements.push({
      amount,
      invoiceToken: `MANUEL_${Date.now()}`,
      type: 'manuel',
      note: note || 'Versement en espèces',
      status: 'confirmed'
    });

    const newTotalPaidCents = Math.round((moratoire.totalPaid + amount) * 100);
    const totalAmountCents = Math.round(moratoire.totalAmount * 100);
    moratoire.totalPaid = newTotalPaidCents / 100;

    const isFullyPaid = newTotalPaidCents >= totalAmountCents;
    if (isFullyPaid) moratoire.status = 'completed';

    await moratoire.save({ session });

    // Transaction pour historique
    const transaction = new Transactions({
      userId: moratoire.userId,
      description: `Versement moratoire manuel${note ? ' — ' + note : ''}`,
      amount,
      invoiceToken: `MANUEL_${Date.now()}_${id}`,
      status: 'confirmed'
    });
    await transaction.save({ session });

    // ─── Commission : 6% marge système, 94% → dividende_actions des owners ───
    const amountCents = Math.round(amount * 100);
    const entrepreneurCommissionCents = Math.round(amountCents * 0.06);
    const adminShareCents = amountCents - entrepreneurCommissionCents;

    const mainAdmins = await User.find({
      $or: [{ isTheOwner: true }, { isTheSuperAdmin: true }]
    }).session(session);

    if (mainAdmins && mainAdmins.length > 0) {
      for (const admin of mainAdmins) {
        const currentAdminDividendeCents = Math.round((admin.dividende_actions || 0) * 100);
        admin.dividende_actions = (currentAdminDividendeCents + adminShareCents) / 100;
        await admin.save({ session });
      }
      console.log(`✅ Commission moratoire manuel : 6% = ${entrepreneurCommissionCents / 100} FCFA | 94% admin = ${adminShareCents / 100} FCFA`);
    }

    // ─── Bonus parrainage 10% ─────────────────────────────────────────────────
    const moratoireUser = await User.findById(moratoire.userId).session(session);
    if (moratoireUser?.parrain && mongoose.Types.ObjectId.isValid(moratoireUser.parrain)) {
      const parrain = await User.findById(moratoireUser.parrain).session(session);
      if (parrain) {
        const bonusCents = Math.round(amountCents * 0.10);
        const parrainDividendeCents = Math.round((parrain.dividende || 0) * 100);
        parrain.dividende = (parrainDividendeCents + bonusCents) / 100;
        await parrain.save({ session });
        console.log(`💰 Bonus parrainage moratoire (manuel) : ${bonusCents / 100} FCFA → ${parrain.telephone}`);
      }
    }

    await session.commitTransaction();

    // Actions post-paiement (hors transaction)
    const user = await User.findById(moratoire.userId);

    if (isFullyPaid && user && !moratoire.actionContractSent) {
      user.actionsNumber = (Number.parseInt(user.actionsNumber) || 0) + (Number.parseInt(moratoire.actionNumber) || 0);
      await user.save();

      try {
        const purchaseData = {
          actionNumber: moratoire.actionNumber,
          price: moratoire.totalAmount,
          _id: moratoire._id
        };
        const pdfBuffer = await generateContractPDF(purchaseData, user);
        const fileName = `ContratActions_Moratoire_${moratoire._id}_${Date.now()}.pdf`;
        const pdfUrl = await uploadPDFToS3(pdfBuffer, fileName);

        await sendWhatsAppDocument(
          user.telephone,
          pdfUrl.cleanUrl,
          `🎉 Félicitations ${user.firstName} !\n` +
          `Vous avez finalisé votre paiement moratoire.\n` +
          `Voici votre contrat d'achat d'actions.\n` +
          `📄 Nombre d'actions : ${moratoire.actionNumber}\n` +
          `💰 Montant total payé : ${moratoire.totalAmount.toLocaleString()} FCFA\n` +
          `Merci pour votre confiance 🙏`
        );

        await Moratoire.findByIdAndUpdate(moratoire._id, { actionContractSent: true });
        console.log('✅ Contrat d\'actions envoyé (versement manuel complet)');
      } catch (pdfErr) {
        console.error('❌ Erreur envoi contrat (versement manuel):', pdfErr.message);
      }
    } else if (!isFullyPaid && user) {
      try {
        await sendWhatsAppMessage(
          user.telephone,
          `✅ Versement reçu, ${user.firstName} !\n` +
          `Montant : ${amount.toLocaleString()} FCFA (espèces)\n` +
          `Total payé : ${moratoire.totalPaid.toLocaleString()} FCFA\n` +
          `Reste à payer : ${(moratoire.totalAmount - moratoire.totalPaid).toLocaleString()} FCFA`
        );
      } catch (e) {
        console.error('❌ Notification WhatsApp:', e.message);
      }
    }

    const updated = await Moratoire.findById(id).populate('userId', 'firstName lastName telephone actionsNumber');
    return res.status(200).json({
      message: isFullyPaid
        ? 'Versement enregistré. Paiement complet ! Contrat d\'actions envoyé par WhatsApp.'
        : `Versement de ${amount.toLocaleString()} FCFA enregistré.`,
      data: updated,
      isFullyPaid
    });

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('❌ addVersementManuel:', error.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  } finally {
    session.endSession();
  }
};

// ─── ACTIONNAIRE : Initier un versement moratoire via PayDunya ───────────────
module.exports.initiateMoratoireVersement = async (req, res) => {
  try {
    const userId = req.user.id;
    const { moratoireId, amount } = req.body;

    if (!moratoireId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'moratoireId et amount sont requis.' });
    }

    const moratoire = await Moratoire.findOne({ _id: moratoireId, userId });
    if (!moratoire) return res.status(404).json({ message: 'Engagement moratoire introuvable.' });
    if (moratoire.status !== 'active') {
      return res.status(400).json({ message: 'Cet engagement n\'est plus actif.' });
    }

    const remaining = moratoire.totalAmount - moratoire.totalPaid;
    if (remaining <= 0) {
      return res.status(400).json({ message: 'Vous avez déjà tout payé.' });
    }
    if (amount > remaining) {
      return res.status(400).json({
        message: `Montant trop élevé. Reste à payer : ${remaining.toLocaleString()} FCFA.`
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    const description = `Versement moratoire - ${user.firstName} ${user.lastName}`;

    const invoice = await createInvoice({
      items: [{ name: description, unit_price: amount }],
      totalAmount: amount,
      callbackUrl: `${process.env.BACKEND_URL}/api/ipnmoratoire`
    });

    if (!invoice || invoice.response_code !== '00') {
      throw new Error(invoice?.description || 'Erreur création facture PayDunya');
    }

    // Enregistrer le versement en pending
    moratoire.versements.push({
      amount,
      invoiceToken: invoice.token,
      status: 'pending'
    });
    await moratoire.save();

    // Transaction pour le tracking
    const transaction = new Transactions({
      userId,
      description,
      amount,
      invoiceToken: invoice.token,
      status: 'pending'
    });
    await transaction.save();

    return res.status(201).json({
      message: 'Versement initié avec succès.',
      invoice: {
        token: invoice.token,
        response_text: invoice.response_text,
        payment_url: invoice.response_text,
        transaction_id: invoice.token
      },
      moratoireId: moratoire._id,
      amount,
      remaining
    });
  } catch (error) {
    console.error('❌ initiateMoratoireVersement:', error.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// ─── CALLBACK PayDunya : Mettre à jour statut d'un versement moratoire ────────
module.exports.updateStatusMoratoireVersement = async (invoiceToken, status) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Trouver le moratoire contenant ce versement
    const moratoire = await Moratoire.findOneAndUpdate(
      { 'versements.invoiceToken': invoiceToken, 'versements.status': 'pending' },
      { $set: { 'versements.$.status': 'processing' } },
      { new: false, session }
    );

    if (!moratoire) {
      const existing = await Moratoire.findOne({ 'versements.invoiceToken': invoiceToken }).session(session);
      if (!existing) {
        await session.abortTransaction();
        return { error: true, statusCode: 404, message: 'Versement introuvable.' };
      }
      const versement = existing.versements.find(v => v.invoiceToken === invoiceToken);
      if (versement?.status === 'confirmed') {
        await session.abortTransaction();
        return { error: true, statusCode: 200, message: 'Versement déjà traité.' };
      }
      await session.abortTransaction();
      return { error: true, statusCode: 500, message: 'Impossible de verrouiller le versement.' };
    }

    const versement = moratoire.versements.find(v => v.invoiceToken === invoiceToken);
    if (!versement) {
      await session.abortTransaction();
      return { error: true, statusCode: 404, message: 'Versement introuvable.' };
    }

    const transactionSce = await Transactions.findOne({ invoiceToken }).session(session);

    if (status !== 'completed') {
      versement.status = 'failed';
      await moratoire.save({ session });
      if (transactionSce) {
        transactionSce.status = 'failed';
        await transactionSce.save({ session });
      }
      await session.commitTransaction();
      return { error: true, statusCode: 400, message: 'Paiement non validé.' };
    }

    // Paiement réussi
    const amountCents = Math.round((versement.amount || 0) * 100);
    const currentPaidCents = Math.round((moratoire.totalPaid || 0) * 100);
    const newPaidCents = currentPaidCents + amountCents;
    const totalAmountCents = Math.round((moratoire.totalAmount || 0) * 100);

    moratoire.totalPaid = newPaidCents / 100;
    versement.status = 'confirmed';

    const isFullyPaid = newPaidCents >= totalAmountCents;
    if (isFullyPaid) {
      moratoire.status = 'completed';
    }

    await moratoire.save({ session });

    if (transactionSce) {
      transactionSce.status = 'confirmed';
      await transactionSce.save({ session });
    }

    // ─── Commission : 6% marge système, 94% → dividende_actions des owners ───
    const entrepreneurCommissionCents = Math.round(amountCents * 0.06);
    const adminShareCents = amountCents - entrepreneurCommissionCents;

    const mainAdmins = await User.find({
      $or: [{ isTheOwner: true }, { isTheSuperAdmin: true }]
    }).session(session);

    if (mainAdmins && mainAdmins.length > 0) {
      for (const admin of mainAdmins) {
        const currentAdminDividendeCents = Math.round((admin.dividende_actions || 0) * 100);
        admin.dividende_actions = (currentAdminDividendeCents + adminShareCents) / 100;
        await admin.save({ session });
      }
    }

    // ─── Bonus parrainage 10% ─────────────────────────────────────────────────
    const moratoireUser = await User.findById(moratoire.userId).session(session);
    if (moratoireUser?.parrain && mongoose.Types.ObjectId.isValid(moratoireUser.parrain)) {
      const parrain = await User.findById(moratoireUser.parrain).session(session);
      if (parrain) {
        const bonusCents = Math.round(amountCents * 0.10);
        const parrainDividendeCents = Math.round((parrain.dividende || 0) * 100);
        parrain.dividende = (parrainDividendeCents + bonusCents) / 100;
        await parrain.save({ session });
        console.log(`💰 Bonus parrainage moratoire : ${bonusCents / 100} FCFA → ${parrain.telephone}`);
      }
    }

    await session.commitTransaction();

    // Actions post-paiement (hors transaction)
    const user = await User.findById(moratoire.userId);

    if (isFullyPaid && user && !moratoire.actionContractSent) {
      // Mettre à jour le nombre d'actions de l'actionnaire
      const actionNumberInt = Number.parseInt(moratoire.actionNumber) || 0;
      user.actionsNumber = (Number.parseInt(user.actionsNumber) || 0) + actionNumberInt;
      await user.save();

      // Générer et envoyer le contrat d'achat d'actions normal
      try {
        console.log('📄 Génération du contrat d\'achat d\'actions (moratoire complet)...');

        const purchaseData = {
          actionNumber: moratoire.actionNumber,
          price: moratoire.totalAmount,
          _id: moratoire._id
        };

        const pdfBuffer = await generateContractPDF(purchaseData, user);
        const fileName = `ContratActions_Moratoire_${moratoire._id}_${Date.now()}.pdf`;
        const pdfUrl = await uploadPDFToS3(pdfBuffer, fileName);

        await sendWhatsAppDocument(
          user.telephone,
          pdfUrl.cleanUrl,
          `🎉 Félicitations ${user.firstName} !\n` +
          `Vous avez finalisé votre paiement moratoire.\n` +
          `Voici votre contrat d'achat d'actions.\n` +
          `📄 Nombre d'actions : ${moratoire.actionNumber}\n` +
          `💰 Montant total payé : ${moratoire.totalAmount.toLocaleString()} FCFA\n` +
          `Merci pour votre confiance 🙏`
        );

        // Marquer le contrat d'actions comme envoyé
        await Moratoire.findByIdAndUpdate(moratoire._id, { actionContractSent: true });

        console.log('✅ Contrat d\'achat d\'actions (moratoire) envoyé par WhatsApp');
      } catch (pdfErr) {
        console.error('❌ Erreur envoi contrat actions (moratoire):', pdfErr.message);
      }
    } else if (!isFullyPaid && user) {
      // Notifier l'actionnaire du versement reçu
      try {
        const remaining = moratoire.totalAmount - moratoire.totalPaid;
        await sendWhatsAppMessage(
          user.telephone,
          `✅ Versement reçu, ${user.firstName} !\n` +
          `Montant versé : ${versement.amount.toLocaleString()} FCFA\n` +
          `Total payé : ${moratoire.totalPaid.toLocaleString()} FCFA\n` +
          `Reste à payer : ${remaining.toLocaleString()} FCFA\n` +
          `Continuez vos versements sur la plateforme.`
        );
      } catch (e) {
        console.error('❌ Notification WhatsApp versement:', e.message);
      }
    }

    return {
      error: false,
      message: isFullyPaid
        ? 'Paiement complet ! Contrat d\'actions généré et envoyé.'
        : 'Versement confirmé.',
      moratoire,
      isFullyPaid
    };

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('❌ updateStatusMoratoireVersement:', error.message);
    return { error: true, statusCode: 500, message: 'Erreur serveur.' };
  } finally {
    session.endSession();
  }
};

// ─── ADMIN : Changer le statut d'un engagement (suspendre, annuler) ───────────
module.exports.updateMoratoireStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'suspended', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }

    const moratoire = await Moratoire.findById(id);
    if (!moratoire) return res.status(404).json({ message: 'Engagement moratoire introuvable.' });
    if (moratoire.status === 'completed') {
      return res.status(400).json({ message: 'Impossible de modifier un engagement complété.' });
    }

    moratoire.status = status;
    await moratoire.save();

    return res.status(200).json({ message: 'Statut mis à jour.', data: moratoire });
  } catch (error) {
    console.error('❌ updateMoratoireStatus:', error.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// ─── ADMIN : Renvoyer le contrat moratoire par WhatsApp ───────────────────────
module.exports.resendMoratoireContract = async (req, res) => {
  try {
    const { id } = req.params;
    const moratoire = await Moratoire.findById(id);
    if (!moratoire) return res.status(404).json({ message: 'Engagement moratoire introuvable.' });

    const user = await User.findById(moratoire.userId);
    if (!user) return res.status(404).json({ message: 'Actionnaire introuvable.' });

    let pdfUrl = moratoire.contractPdfUrl;

    if (!pdfUrl) {
      const pdfBuffer = await generateMoratoirePDF(moratoire, user);
      const fileName = `ContratMoratoire_${moratoire._id}_${Date.now()}.pdf`;
      const uploaded = await uploadMoratoirePDFToS3(pdfBuffer, fileName);
      pdfUrl = uploaded.cleanUrl;
      moratoire.contractPdfUrl = pdfUrl;
      await moratoire.save();
    }

    await sendWhatsAppDocument(
      user.telephone,
      pdfUrl,
      `Bonjour ${user.firstName} !\n` +
      `Voici votre contrat d'engagement moratoire.\n` +
      `Actions : ${moratoire.actionNumber} | Total : ${moratoire.totalAmount.toLocaleString()} FCFA\n` +
      `Versement : ${moratoire.versementMontant.toLocaleString()} FCFA\n` +
      `Payé : ${moratoire.totalPaid.toLocaleString()} FCFA`
    );

    return res.status(200).json({ message: 'Contrat renvoyé par WhatsApp.' });
  } catch (error) {
    console.error('❌ resendMoratoireContract:', error.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};
