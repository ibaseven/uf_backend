// const User = require("../Models/UserModel");
// const Action = require("../Models/ActionModel");
// const { createInvoice } = require("../Services/paydunya");
// const callbackurl = process.env.BACKEND_URL;
// const Transactions = require("../Models/TransactionModel");
// const { generateContractPDF, uploadPDFToS3 } = require("../utils/generatedPdf");
// const { sendWhatsAppMessage } = require("../utils/Whatsapp");
// const Settings = require("../Models/SettingsModel")

// /* module.exports.buyAction = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { actionNumber, parrain } = req.body;

//     // Vérifier si l'utilisateur existe
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "Utilisateur non trouvé" });
//     }

//     // Vérifier le parrain (facultatif)
//     let referral = null;
//     if (parrain) {
//       referral = await User.findOne({ _id: parrain });
//       if (!referral) {
//         return res.status(400).json({ message: "Parrain introuvable" });
//       }
//       user.parrain = referral._id; 
//       await user.save();
//     }

//     // Prix et total
//     const pricePerAction = 200;
//     const totalPrice = pricePerAction * actionNumber;

//     const items = [{ name: `Participation projet`, unit_price: totalPrice }];
//     const actionsdescrip = "Achat d'actions";

//     const invoice = await createInvoice({
//       items,
//       totalAmount: totalPrice,
//       callbackUrl: `${callbackUrl}/api/ipnpayment`,
//     });

//     // Création de l'action
//     const newAction = new Action({
//       userId,
//       actionNumber,
//       price: totalPrice,
//       invoiceToken: invoice.token,
//       callbackUrl: invoice.callbackUrl,
//     });
//     await newAction.save();

//     // Création de la transaction
//     const transaction = new Transactions({
//       actions: [newAction._id],
//       userId,
//       actionNumber,
//       description: actionsdescrip,
//       amount: totalPrice,
//       invoiceToken: invoice.token,
//       callbackUrl: invoice.callbackUrl,
//     });
//     await transaction.save();

//     return res.status(201).json({
//       message: "Achat effectué avec succès !",
//       data: newAction,
//       invoice,
//       transaction,
//     });
//   } catch (error) {
//     console.error("Erreur lors de l'achat :", error);
//     return res.status(500).json({ message: "Erreur serveur." });
//   }
// }; */

// /* module.exports.updateStatusBuyAction = async (invoiceToken, status) => {
//   try {
//     // 1️⃣ Chercher la transaction (dans Action)
//     const transaction = await Action.findOne({ invoiceToken });
//     if (!transaction) {
//       return {
//         error: true,
//         statusCode: 404,
//         message: "Transaction introuvable.",
//       };
//     }

//     // 2️⃣ Si déjà confirmée
//     if (transaction.status === "confirmed") {
//       return {
//         error: true,
//         statusCode: 200,
//         message: "Transaction déjà traitée.",
//         transaction,
//       };
//     }

//     // 3️⃣ Si le paiement a échoué
//     if (status !== "completed") {
//       transaction.status = "failed";
//       await transaction.save();
//       return {
//         error: true,
//         statusCode: 400,
//         message: "Paiement non validé.",
//         transaction,
//       };
//     }

//     // 4️⃣ Récupérer l'utilisateur
//     const user = await User.findById(transaction.userId);
//     if (!user) {
//       return {
//         error: true,
//         statusCode: 404,
//         message: "Utilisateur introuvable.",
//       };
//     }

//     // 5️⃣ Mettre à jour le nombre d'actions de l'utilisateur
//     user.actionsNumber = (user.actionsNumber || 0) + transaction.actionNumber;
//     await user.save();

//     // 6️⃣ Bonus pour le parrain (si l’utilisateur a un parrain)
//     if (user.parrain) {
//       const referral = await User.findById(user.parrain);
//       if (referral) {
//         const bonus = transaction.price * 0.1; // 💰 10% du montant total
//         referral.balance = (referral.balance || 0) + bonus;
//         await referral.save();
//         console.log(
//           `✅ Bonus de ${bonus} ajouté au parrain ${referral.firstName || referral._id}`
//         );
//       }
//     }

//     // 7️⃣ Marquer la transaction comme confirmée
//     transaction.status = "confirmed";
//     await transaction.save();

//     return {
//       error: false,
//       message: "Paiement confirmé, actions mises à jour et bonus versé.",
//       transaction,
//       user,
//     };
//   } catch (error) {
//     console.error("Erreur dans updateStatusBuyAction:", error);
//     return {
//       error: true,
//       statusCode: 500,
//       message: "Erreur serveur",
//       details: error.message,
//     };
//   }
// };
//  */

// module.exports.buyAction = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { actionNumber, parrainPhone } = req.body;

//     // 1️⃣ Vérifier si l'utilisateur existe
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "Utilisateur non trouvé" });
//     }

//     // 2️⃣ Gestion du parrain
//     if (user.parrain) {
//       // L'utilisateur a DÉJÀ un parrain
      
//       if (parrainPhone) {
//         // Il essaie de renseigner un numéro
//         const existingParrain = await User.findById(user.parrain);
        
//         if (!existingParrain) {
//           return res.status(400).json({ 
//             message: "Erreur : parrain introuvable dans la base" 
//           });
//         }
        
//         // Vérifier que c'est bien le MÊME numéro que son parrain actuel
//         if (existingParrain.telephone !== parrainPhone) {
//           return res.status(400).json({ 
//             message: `Vous avez déjà un parrain (${existingParrain.telephone}). Vous ne pouvez pas changer de parrain.` 
//           });
//         }
//       }
//       // Sinon il ne renseigne rien → OK, on continue avec son parrain existant
      
//     } else {
      
//       if (parrainPhone) {
//         const referral = await User.findOne({ telephone: parrainPhone });
        
//         if (!referral) {
//           return res.status(400).json({ 
//             message: "Aucun utilisateur avec ce numéro de téléphone" 
//           });
//         }
//         if (referral._id.toString() === userId) {
//           return res.status(400).json({ 
//             message: "Vous ne pouvez pas être votre propre parrain" 
//           });
//         }
//         user.parrain = referral._id;
//         await user.save();
//       }
//     }
//     const settings = await Settings.findOne();
// const pricePerAction = settings.pricePerAction;


// const totalPrice = pricePerAction * actionNumber;

//     // 4️⃣ Création de la facture
//     const items = [
//       { name: `Achat de ${actionNumber} actions`, unit_price: totalPrice }
//     ];
//     const actionsdescrip = `Achat de ${actionNumber} action${actionNumber > 1 ? 's' : ''}`;

//     const invoice = await createInvoice({
//       items,
//       totalAmount: totalPrice,
//       callbackUrl: `${callbackurl}/api/ipnpayment`,
//     });

//     // 5️⃣ Création de l'action
//     const newAction = new Action({
//       userId,
//       actionNumber,
//       price: totalPrice,
//       invoiceToken: invoice.token,
//       callbackUrl: invoice.callbackUrl,
//       status: "pending",
//     });
//     await newAction.save();

//     // 6️⃣ Création de la transaction
//     const transaction = new Transactions({
//       actions: [newAction._id],
//       userId,
//       actionNumber,
//       description: actionsdescrip,
//       amount: totalPrice,
//       invoiceToken: invoice.token,
//       callbackUrl: invoice.callbackUrl,
//       status: "pending",
//     });
//     await transaction.save();

//     return res.status(201).json({
//       message: "Achat effectué avec succès !",
//       data: newAction,
//       invoice,
//       transaction,
//     });
//   } catch (error) {
//     console.error("Erreur lors de l'achat :", error);
//     return res.status(500).json({ message: "Erreur serveur." });
//   }
// };

// module.exports.updateStatusBuyAction = async (invoiceToken, status) => {
//   try {
//     const actionsTransaction = await Action.findOne({ invoiceToken });
//     const transactionSce= await Transactions.findOne({invoiceToken})
//     if (!actionsTransaction) {
//       return {
//         error: true,
//         statusCode: 404,
//         message: "Transaction introuvable.",
//       };
//     }

//     if (actionsTransaction.status === "confirmed") {
//       return {
//         error: true,
//         statusCode: 200,
//         message: "Transaction déjà traitée.",
//         transactionSce,
//       };
//     }

//     if (status !== "completed") {
//       actionsTransaction.status = "failed";
//       await transactionSce.save();
//       return {
//         error: true,
//         statusCode: 400,
//         message: "Paiement non validé.",
//         transactionSce,
//       };
//     }

//     const user = await User.findById(actionsTransaction.userId);
//     if (!user) {
//       return {
//         error: true,
//         statusCode: 404,
//         message: "Utilisateur introuvable.",
//       };
//     }

//     // Augmenter le nombre d'actions
//     user.actionsNumber = (user.actionsNumber || 0) + actionsTransaction.actionNumber;
//     if (user._id.toString() === MAIN_ADMIN_ID) {
//   user.balance = (user.balance || 0) + (perProjectAmount * 0.06);
// }
//     await user.save();
// const mainAdmin = await User.findById(MAIN_ADMIN_ID);

// if (mainAdmin) {
//   mainAdmin.dividende = (mainAdmin.dividende || 0) + (actionsTransaction.price * 0.06);
//   await mainAdmin.save();
// }
//     // Marquer comme confirmée
//     actionsTransaction.status = "confirmed";
//     transactionSce.status="confirmed"
//     await transactionSce.save();
//     await actionsTransaction.save();

//     // 🎯 BONUS DE PARRAINAGE 10% À CHAQUE ACHAT
//     if (user.parrain) {
//       const parrain = await User.findById(user.parrain);
//       if (parrain) {
//         const bonus = Math.floor(actionsTransaction.price * 0.10); // 10% du montant
//         parrain.dividende = (parrain.dividende || 0) + bonus;
//         await parrain.save();
        
//         console.log(`💰 Bonus de ${bonus} FCFA ajouté au parrain ${parrain.telephone}`);
//       }
//     }
//    try {
//           console.log('📄 Génération du contrat PDF...');
//           const pdfBuffer = await generateContractPDF(actionsTransaction, user);
//           const fileName = `ContratActions${actionsTransaction._id}${Date.now()}.pdf`;
//           const pdfUrl = await uploadPDFToS3(pdfBuffer, fileName);
          

//          // console.log('✅ PDF uploadé sur S3:', pdfUrl);

//           // Envoi WhatsApp
//           await sendWhatsAppMessage(
//             user.telephone,
//             ` Félicitations ${user.firstName} !
// Voici votre contrat d'achat d'actions.

//  ${pdfUrl.cleanUrl}
// Nombre d'actions : ${actionsTransaction.actionNumber}
//  Montant payé : ${actionsTransaction.price.toLocaleString()} FCFA

// Merci pour votre confiance !
// `
//           );

//           console.log('✅ Contrat PDF envoyé par WhatsApp');

//         } catch (pdfError) {
//           console.error('❌ Erreur envoi contrat PDF:', pdfError.message);
//         }
//     return {
//       error: false,
//       message: "Paiement confirmé et nombre d'actions mis à jour.",
//       actionsTransaction,
//       user,
//     };

//   } catch (error) {
//     console.error("Erreur dans updateStatusBuyAction:", error);
//     return {
//       error: true,
//       statusCode: 500,
//       message: "Erreur serveur",
//       details: error.message,
//     };
//   }
// };




const User = require("../Models/UserModel");
const Action = require("../Models/ActionModel");
const { createInvoice } = require("../Services/paydunya");
const callbackurl = process.env.BACKEND_URL;
const Transactions = require("../Models/TransactionModel");
const { generateContractPDF, uploadPDFToS3 } = require("../utils/generatedPdf");
const { sendWhatsAppMessage, sendWhatsAppDocument } = require("../utils/Whatsapp");
const Settings = require("../Models/SettingsModel")
const MAIN_ADMIN_ID = process.env.MAIN_ADMIN_ID
const mongoose = require('mongoose');
/* module.exports.buyAction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { actionNumber, parrain } = req.body;

    // Vérifier si l'utilisateur existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier le parrain (facultatif)
    let referral = null;
    if (parrain) {
      referral = await User.findOne({ _id: parrain });
      if (!referral) {
        return res.status(400).json({ message: "Parrain introuvable" });
      }
      user.parrain = referral._id; 
      await user.save();
    }

    // Prix et total
    const pricePerAction = 200;
    const totalPrice = pricePerAction * actionNumber;

    const items = [{ name: `Participation projet`, unit_price: totalPrice }];
    const actionsdescrip = "Achat d'actions";

    const invoice = await createInvoice({
      items,
      totalAmount: totalPrice,
      callbackUrl: `${callbackUrl}/api/ipnpayment`,
    });

    // Création de l'action
    const newAction = new Action({
      userId,
      actionNumber,
      price: totalPrice,
      invoiceToken: invoice.token,
      callbackUrl: invoice.callbackUrl,
    });
    await newAction.save();

    // Création de la transaction
    const transaction = new Transactions({
      actions: [newAction._id],
      userId,
      actionNumber,
      description: actionsdescrip,
      amount: totalPrice,
      invoiceToken: invoice.token,
      callbackUrl: invoice.callbackUrl,
    });
    await transaction.save();

    return res.status(201).json({
      message: "Achat effectué avec succès !",
      data: newAction,
      invoice,
      transaction,
    });
  } catch (error) {
    console.error("Erreur lors de l'achat :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
}; */

/* module.exports.updateStatusBuyAction = async (invoiceToken, status) => {
  try {
    // 1️⃣ Chercher la transaction (dans Action)
    const transaction = await Action.findOne({ invoiceToken });
    if (!transaction) {
      return {
        error: true,
        statusCode: 404,
        message: "Transaction introuvable.",
      };
    }

    // 2️⃣ Si déjà confirmée
    if (transaction.status === "confirmed") {
      return {
        error: true,
        statusCode: 200,
        message: "Transaction déjà traitée.",
        transaction,
      };
    }

    // 3️⃣ Si le paiement a échoué
    if (status !== "completed") {
      transaction.status = "failed";
      await transaction.save();
      return {
        error: true,
        statusCode: 400,
        message: "Paiement non validé.",
        transaction,
      };
    }

    // 4️⃣ Récupérer l'utilisateur
    const user = await User.findById(transaction.userId);
    if (!user) {
      return {
        error: true,
        statusCode: 404,
        message: "Utilisateur introuvable.",
      };
    }

    // 5️⃣ Mettre à jour le nombre d'actions de l'utilisateur
    user.actionsNumber = (user.actionsNumber || 0) + transaction.actionNumber;
    await user.save();

    // 6️⃣ Bonus pour le parrain (si l’utilisateur a un parrain)
    if (user.parrain) {
      const referral = await User.findById(user.parrain);
      if (referral) {
        const bonus = transaction.price * 0.1; // 💰 10% du montant total
        referral.balance = (referral.balance || 0) + bonus;
        await referral.save();
        console.log(
          `✅ Bonus de ${bonus} ajouté au parrain ${referral.firstName || referral._id}`
        );
      }
    }

    // 7️⃣ Marquer la transaction comme confirmée
    transaction.status = "confirmed";
    await transaction.save();

    return {
      error: false,
      message: "Paiement confirmé, actions mises à jour et bonus versé.",
      transaction,
      user,
    };
  } catch (error) {
    console.error("Erreur dans updateStatusBuyAction:", error);
    return {
      error: true,
      statusCode: 500,
      message: "Erreur serveur",
      details: error.message,
    };
  }
};
 */

module.exports.buyAction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { actionNumber, parrainPhone } = req.body;

    // 1️⃣ Vérifier si l'utilisateur existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // 2️⃣ Gestion du parrain
    if (user.parrain) {
      // L'utilisateur a DÉJÀ un parrain
      
      if (parrainPhone) {
        // Il essaie de renseigner un numéro
        const existingParrain = await User.findById(user.parrain);
        
        if (!existingParrain) {
          return res.status(400).json({ 
            message: "Erreur : parrain introuvable dans la base" 
          });
        }
        
        // Vérifier que c'est bien le MÊME numéro que son parrain actuel
        if (existingParrain.telephone !== parrainPhone) {
          return res.status(400).json({ 
            message: `Vous avez déjà un parrain (${existingParrain.telephone}). Vous ne pouvez pas changer de parrain.` 
          });
        }
      }
      // Sinon il ne renseigne rien → OK, on continue avec son parrain existant
      
    } else {
      
      if (parrainPhone) {
        const referral = await User.findOne({ telephone: parrainPhone });
        
        if (!referral) {
          return res.status(400).json({ 
            message: "Aucun utilisateur avec ce numéro de téléphone" 
          });
        }
        if (referral._id.toString() === userId) {
          return res.status(400).json({ 
            message: "Vous ne pouvez pas être votre propre parrain" 
          });
        }
        user.parrain = referral._id;
        await user.save();
      }
    }
    const settings = await Settings.findOne();
const pricePerAction = settings.pricePerAction;


const totalPrice = pricePerAction * actionNumber;

    // 4️⃣ Création de la facture
    const items = [
      { name: `Achat de ${actionNumber} actions`, unit_price: totalPrice }
    ];
    const actionsdescrip = `Achat de ${actionNumber} action${actionNumber > 1 ? 's' : ''}`;

    const invoice = await createInvoice({
      items,
      totalAmount: totalPrice,
      callbackUrl: `${callbackurl}/api/ipnpayment`,
    });

    // 5️⃣ Création de l'action
    const newAction = new Action({
      userId,
      actionNumber,
      price: totalPrice,
      invoiceToken: invoice.token,
      callbackUrl: invoice.callbackUrl,
      status: "pending",
    });
    await newAction.save();

    // 6️⃣ Création de la transaction
    const transaction = new Transactions({
      actions: [newAction._id],
      userId,
      actionNumber,
      description: actionsdescrip,
      amount: totalPrice,
      invoiceToken: invoice.token,
      callbackUrl: invoice.callbackUrl,
      status: "pending",
    });
    await transaction.save();

    return res.status(201).json({
      message: "Achat effectué avec succès !",
      data: newAction,
      invoice,
      transaction,
    });
  } catch (error) {
    console.error("Erreur lors de l'achat :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};


module.exports.buyActionWithDividends = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const userId = req.user.id;
        const { actionNumber } = req.body;

     
        if (!actionNumber || actionNumber < 5) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Nombre d'actions invalide (minimum 5 actions)"
            });
        }

        if (actionNumber % 5 !== 0) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Le nombre d'actions doit être un multiple de 5 (5, 10, 15, 20...)"
            });
        }

        // Récupérer l'utilisateur
        const user = await User.findById(userId).session(session);
        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        // Récupérer le prix par action
        const settings = await Settings.findOne().session(session);
        if (!settings || !settings.pricePerAction) {
            await session.abortTransaction();
            return res.status(500).json({ message: "Prix par action non configuré" });
        }

        const pricePerAction = settings.pricePerAction;
        const totalPrice = pricePerAction * actionNumber;

        // Vérifier le solde de dividende
        const userDividend = user.dividende || 0;
        if (userDividend < totalPrice) {
            await session.abortTransaction();
            return res.status(400).json({
                message: `Solde de dividende insuffisant. Disponible: ${userDividend.toLocaleString()} FCFA, Requis: ${totalPrice.toLocaleString()} FCFA`
            });
        }

        // Déduire le montant du dividende
        user.dividende = userDividend - totalPrice;

        // Augmenter le nombre d'actions
        const actionNumberInt = Number.parseInt(actionNumber) || 0;
        user.actionsNumber = (Number.parseInt(user.actionsNumber) || 0) + actionNumberInt;

        await user.save({ session });

      
        if (user.parrain && mongoose.Types.ObjectId.isValid(user.parrain)) {
            const parrain = await User.findById(user.parrain).session(session);

            if (parrain) {
                const priceCents = Math.round(totalPrice * 100);
                const bonusCents = Math.round(priceCents * 0.10);
                const parrainDividendeCents = Math.round((parrain.dividende || 0) * 100);
                const newParrainDividendeCents = parrainDividendeCents + bonusCents;

                parrain.dividende = newParrainDividendeCents / 100;
                await parrain.save({ session });

                console.log(`💰 Bonus parrainage de ${bonusCents / 100} FCFA ajouté au parrain ${parrain.telephone}`);
            }
        }

        // Créer l'action (déjà confirmée car payée par dividende)
        const newAction = new Action({
            userId,
            actionNumber: actionNumberInt,
            price: totalPrice,
            invoiceToken: `DIV_${Date.now()}_${userId}`,
            status: "confirmed",
            paidWithDividend: true
        });
        await newAction.save({ session });

        // Créer la transaction
        const transaction = new Transactions({
            actions: [newAction._id],
            userId,
            actionNumber: actionNumberInt,
            description: `Achat de ${actionNumberInt} action${actionNumberInt > 1 ? 's' : ''} avec dividendes`,
            amount: totalPrice,
            invoiceToken: newAction.invoiceToken,
            status: "confirmed",
            paidWithDividend: true
        });
        await transaction.save({ session });

        await session.commitTransaction();

        // Génération et envoi du contrat PDF (hors transaction)
        try {
            console.log('📄 Génération du contrat PDF (achat avec dividendes)...');
            const pdfBuffer = await generateContractPDF(newAction, user);
            const fileName = `ContratActions_DIV_${newAction._id}_${Date.now()}.pdf`;
            const pdfUrl = await uploadPDFToS3(pdfBuffer, fileName);

            await sendWhatsAppDocument(
                user.telephone,
                pdfUrl.cleanUrl,
                `🎉 Félicitations ${user.firstName} !
Votre contrat d'achat d'actions est prêt.
📄 Nombre d'actions : ${actionNumberInt}
💰 Montant payé : ${totalPrice.toLocaleString()} FCFA (via dividendes)
Merci pour votre confiance 🙏`
            );

            console.log('✅ Contrat PDF envoyé par WhatsApp');

        } catch (pdfError) {
            console.error('❌ Erreur envoi contrat PDF:', pdfError.message);
        }

        return res.status(201).json({
            message: "Achat d'actions avec dividendes effectué avec succès !",
            data: {
                action: newAction,
                transaction,
                newDividendBalance: user.dividende,
                newActionsNumber: user.actionsNumber,
                totalPaid: totalPrice
            }
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        console.error("❌ Erreur buyActionWithDividends:", error.message);
        return res.status(500).json({
            message: "Erreur serveur",
            details: error.message
        });

    } finally {
        session.endSession();
    }
};

module.exports.updateStatusBuyAction = async (invoiceToken, status) => {
    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();
        
        // Verrou atomique
        const actionsTransaction = await Action.findOneAndUpdate(
            { 
                invoiceToken,
                status: { $ne: 'confirmed' }
            },
            {
                $set: { lastUpdateAttempt: new Date() }
            },
            {
                new: false,
                session
            }
        );
        
        if (!actionsTransaction) {
            const existing = await Action.findOne({ invoiceToken }).session(session);
            
            if (!existing) {
                await session.abortTransaction();
                return {
                    error: true,
                    statusCode: 404,
                    message: "Transaction introuvable"
                };
            }
            
            if (existing.status === 'confirmed') {
                await session.abortTransaction();
                return {
                    error: true,
                    statusCode: 200,
                    message: "Transaction déjà traitée"
                };
            }
            
            await session.abortTransaction();
            return {
                error: true,
                statusCode: 500,
                message: "Impossible de verrouiller la transaction"
            };
        }
        
        const transactionSce = await Transactions.findOne({ invoiceToken }).session(session);
        
        // Vérification statut
        if (status !== 'completed') {
            actionsTransaction.status = 'failed';
            await actionsTransaction.save({ session });
            
            if (transactionSce) {
                transactionSce.status = 'failed';
                await transactionSce.save({ session });
            }
            
            await session.commitTransaction();
            return {
                error: true,
                statusCode: 400,
                message: "Paiement non validé"
            };
        }
        
        // Récupération utilisateur
        const user = await User.findById(actionsTransaction.userId).session(session);
        if (!user) {
            await session.abortTransaction();
            return {
                error: true,
                statusCode: 404,
                message: "Utilisateur introuvable"
            };
        }
        
        // ✅ Calculs en centimes
        const actionNumberInt = Number.parseInt(actionsTransaction.actionNumber) || 0;
        const priceCents = Math.round((actionsTransaction.price || 0) * 100);
        
        // ✅ CORRECTION: 6% pour l'entrepreneur, 94% pour l'admin
        const entrepreneurCommissionCents = Math.round(priceCents * 0.06);  // 6% pour VOUS
        const adminShareCents = priceCents - entrepreneurCommissionCents;   // 94% pour ADMIN
        
        // Augmenter actions utilisateur
        user.actionsNumber = (Number.parseInt(user.actionsNumber) || 0) + actionNumberInt;
        await user.save({ session });
        
        // ✅ Part de l'admin (94%)
       // Trouver l'admin principal via isMainAdmin
const mainAdmins = await User.find({
  $or: [
    { isTheOwner: true },
    { isTheSuperAdmin: true }
  ]
}).session(session);

if (mainAdmins && mainAdmins.length > 0) {
    for (const admin of mainAdmins) {
        const currentAdminDividendeCents = Math.round((admin.dividende_actions || 0) * 100);
        const newAdminDividendeCents = currentAdminDividendeCents + adminShareCents;
        admin.dividende_actions = newAdminDividendeCents / 100;
        await admin.save({ session });
    }
}

        // Confirmation
        actionsTransaction.status = 'confirmed';
        await actionsTransaction.save({ session });
        
        if (transactionSce) {
            transactionSce.status = 'confirmed';
            await transactionSce.save({ session });
        }
        
        // Bonus parrainage (10%)
        if (user.parrain && mongoose.Types.ObjectId.isValid(user.parrain)) {
            const parrain = await User.findById(user.parrain).session(session);
            
            if (parrain) {
                const bonusCents = Math.round(priceCents * 0.10);
                const parrainDividendeCents = Math.round((parrain.dividende || 0) * 100);
                const newParrainDividendeCents = parrainDividendeCents + bonusCents;
                
                parrain.dividende = newParrainDividendeCents / 100;
                await parrain.save({ session });
            }
        }
        
        await session.commitTransaction();
        
        // Envoi PDF (hors transaction)
        try {
            const pdfBuffer = await generateContractPDF(actionsTransaction, user);
            const fileName = `ContratActions${actionsTransaction._id}${Date.now()}.pdf`;
            const pdfUrl = await uploadPDFToS3(pdfBuffer, fileName);
            
          await sendWhatsAppDocument(
    user.telephone,
    pdfUrl.cleanUrl,
    `🎉 Félicitations ${user.firstName} !Votre contrat d'achat d'actions est prêt.
📄 Nombre d'actions : ${actionNumberInt}
💰 Montant payé : ${(priceCents / 100).toLocaleString()} FCFA
Merci pour votre confiance 🙏`
);

        } catch (pdfError) {
            console.error('❌ Erreur PDF:', pdfError.message);
        }
        
        return {
            error: false,
            message: "Paiement confirmé",
            actionsTransaction,
            user
        };
        
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        
        console.error("❌ Erreur updateStatusBuyAction:", error.message);
        
        return {
            error: true,
            statusCode: 500,
            message: "Erreur serveur"
        };
        
    } finally {
        session.endSession();
    }
};

