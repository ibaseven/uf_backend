const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

const uploadMoratoirePDFToS3 = async (pdfBuffer, fileName) => {
  const s3Key = `contrats/moratoire/${fileName}`;
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  };
  await s3Client.send(new PutObjectCommand(params));
  const cleanUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
  return { cleanUrl, s3Key };
};

const formatMontant = (montant) => {
  return Math.round(montant).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
};

const getDurationInMonths = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  return Math.round(diffMs / (1000 * 60 * 60 * 24 * 30));
};

const generateMoratoirePDF = async (moratoireData, userData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 60, right: 60 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Données utilisateur
      const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || '[Nom complet]';
      const birthDate = userData.dateNaissance || '[date de naissance]';
      const nationality = userData.nationalite || '[nationalité]';
      const address = userData.adresse || `${userData.ville || '[ville]'}, ${userData.pays || '[pays]'}`;
      const telephone = userData.telephone || '[téléphone]';

      // Données moratoire
      const { actionNumber, totalAmount, versementMontant, startDate, endDate } = moratoireData;
      const dureeEnMois = getDurationInMonths(startDate, endDate);
      const capitalTotal = 1000000;
      const pourcentage = Number((actionNumber / capitalTotal * 100).toFixed(5));

      // === LOGO ===
      const logoPath = path.join(__dirname, '../assets/logo.png');
      try {
        if (fs.existsSync(logoPath) && fs.statSync(logoPath).size > 0) {
          const logoWidth = 80;
          const logoHeight = 60;
          const pageWidth = doc.page.width;
          doc.image(logoPath, (pageWidth - logoWidth) / 2, 45, {
            width: logoWidth, height: logoHeight, fit: [logoWidth, logoHeight], align: 'center'
          });
          doc.moveDown(4);
        } else {
          doc.moveDown(2);
        }
      } catch (e) {
        doc.moveDown(2);
      }

      // === EN-TÊTE SOCIÉTÉ ===
      doc.fontSize(9).font('Helvetica')
        .text('UNIVERSAL FAB S.A.S.', { align: 'center' })
        .text('Siège social : Mbour, Saly, Sénégal', { align: 'center' })
        .text('Téléphone : +221 710100856 / +221 78 757 99 99', { align: 'center' })
        .text('Site web : https://universalfabsn.com', { align: 'center' })
        .text('Plateforme : https://actionuniversalfab.com', { align: 'center' })
        .text('Représentée par M. Magatte Mbaye, Président Directeur Général', { align: 'center' })
        .text('NINEA : 011238484   RC : SN.THS.2024.A.2224', { align: 'center' })
        .moveDown(1.5);

      // === TITRE ===
      doc.fontSize(13).font('Helvetica-Bold')
        .text('CONTRAT D\'ENGAGEMENT DE PAIEMENT MORATOIRE EXCEPTIONNEL', { align: 'center' })
        .text('POUR ACQUISITION D\'ACTIONS', { align: 'center' })
        .moveDown(1.5);

      // === PARTIES ===
      doc.fontSize(11).font('Helvetica-Bold')
        .text('ENTRE LES SOUSSIGNÉS :')
        .moveDown(0.5);

      doc.font('Helvetica')
        .text('La société ', { continued: true })
        .font('Helvetica-Bold').text('UNIVERSAL FAB S.A.S.', { continued: true })
        .font('Helvetica').text(', représentée par M. Magatte Mbaye, PDG,')
        .text('ci-après désignée « la Société »,')
        .moveDown(0.5)
        .text('ET')
        .moveDown(0.5);

      doc.font('Helvetica-Bold').text(`M(me) ${fullName}`, { continued: true })
        .font('Helvetica').text(`, né(e) le ${birthDate}, de nationalité ${nationality},`)
        .text(`demeurant à ${address}, téléphone : ${telephone},`)
        .text('ci-après désigné(e) « le Bénéficiaire ».')
        .moveDown(1);

      doc.font('Helvetica').text('Il a été convenu et arrêté ce qui suit :').moveDown(1);

      // === ARTICLE 1 ===
      doc.font('Helvetica-Bold').text('ARTICLE 1 — OBJET DU CONTRAT').moveDown(0.5);
      doc.font('Helvetica').text(
        `L'engagement du Bénéficiaire à acquérir ` +
        `${formatMontant(actionNumber)} unités de participation économique, ` +
        `représentant ${pourcentage}% de participation économique dans UNIVERSAL FAB, ` +
        `pour un montant total de ${formatMontant(totalAmount)} francs CFA. ` +
        `Mesure exceptionnelle autorisée par la Direction Générale après clôture officielle ` +
        `de la période de vente d'actions.`
      ).moveDown(1);

      // === ARTICLE 2 ===
      doc.font('Helvetica-Bold').text('ARTICLE 2 — MODALITÉS DE PAIEMENT').moveDown(0.5);
      doc.font('Helvetica')
        .text(`- Montant du versement : ${formatMontant(versementMontant)} francs CFA`)
        .text(`- Durée : ${dureeEnMois} mois consécutifs`)
        .text(`- Date de début : ${formatDate(startDate)}`)
        .text(`- Date de fin prévue : ${formatDate(endDate)}`)
        .text('- Modes de paiement : Espèces, services de transfert électronique (Wave, Orange Money),')
        .text('  virement bancaire, ou via la plateforme officielle')
        .text('- Numéros commerciaux valides : 00221 787579999 ou 00221 777500215')
        .moveDown(1);

      // === ARTICLE 3 ===
      doc.font('Helvetica-Bold').text('ARTICLE 3 — ENGAGEMENT IRRÉVOCABLE').moveDown(0.5);
      doc.font('Helvetica').text(
        `Le Bénéficiaire s'engage sans interruption pendant ${dureeEnMois} mois. ` +
        `Tout retard de 2 versements consécutifs entraîne l'arrêt automatique du contrat. ` +
        `Le montant déjà versé devient la seule part d'action du bénéficiaire.`
      ).moveDown(1);

      // === ARTICLE 4 ===
      doc.font('Helvetica-Bold').text('ARTICLE 4 — TRANSFERT DES ACTIONS').moveDown(0.5);
      doc.font('Helvetica')
        .text(`Les actions ne seront transférées qu'après paiement intégral de ${formatMontant(totalAmount)} FCFA.`)
        .text('- En cas de rupture après 2 versements consécutifs manqués, seul le montant versé est conservé')
        .text('- Avant l\'échéance, aucun droit de vote, dividende ou décision')
        .text('- À paiement complet : certificat d\'actionnaire + inscription au registre officiel')
        .moveDown(1);

      // === ARTICLE 5 ===
      doc.font('Helvetica-Bold').text('ARTICLE 5 — CARACTÈRE EXCEPTIONNEL').moveDown(0.5);
      doc.font('Helvetica').text(
        'Le présent contrat ne constitue pas un précédent pour d\'autres investisseurs ' +
        'et revêt un caractère strictement exceptionnel autorisé par la Direction Générale.'
      ).moveDown(1);

      // === ARTICLE 6 ===
      doc.font('Helvetica-Bold').text('ARTICLE 6 — RÉSILIATION').moveDown(0.5);
      doc.font('Helvetica').text(
        'En cas de manquement grave aux obligations du présent contrat, la Société peut le résilier. ' +
        'Les sommes déjà versées correspondent au seul nombre d\'actions à attribuer au prorata.'
      ).moveDown(1);

      // === ARTICLE 7 ===
      doc.font('Helvetica-Bold').text('ARTICLE 7 — LOI APPLICABLE').moveDown(0.5);
      doc.font('Helvetica').text(
        'Le présent contrat est soumis à la législation de la République du Sénégal. ' +
        'Tout litige sera porté devant le Tribunal de Commerce de Mbour.'
      ).moveDown(1);

      // === ARTICLE 8 ===
      doc.font('Helvetica-Bold').text('ARTICLE 8 — ENTRÉE EN VIGUEUR').moveDown(0.5);
      doc.font('Helvetica').text(
        'Le contrat prend effet à compter de sa signature par les deux parties.'
      ).moveDown(2);

      // === SIGNATURES ===
      const dateSignature = new Date().toLocaleDateString('fr-FR');
      doc.font('Helvetica').text(`Fait à Mbour, le ${dateSignature}`).moveDown(2);

      doc.font('Helvetica').text('Signatures :').moveDown(1);

      doc.text('La Société :').moveDown(0.5);
      doc.text('Monsieur Magatte Mbaye').moveDown(0.3);
      doc.text('Président Directeur Général').moveDown(0.3);
      doc.text('UNIVERSAL FAB S.A.S.').moveDown(0.5);

      // Signature image
      const possibleSignaturePaths = [
        path.join(__dirname, '../assets/SIGNATURE UNIVERS FAB.png'),
        path.join(__dirname, '../assets/signature.png'),
        path.join(__dirname, '../assets/signature.jpg')
      ];
      let signatureAdded = false;
      for (const sigPath of possibleSignaturePaths) {
        try {
          if (fs.existsSync(sigPath) && fs.statSync(sigPath).size > 0) {
            doc.image(sigPath, doc.x, doc.y, {
              width: 120, height: 60, fit: [120, 60], align: 'left'
            });
            signatureAdded = true;
            doc.moveDown(4);
            break;
          }
        } catch (e) { /* ignore */ }
      }
      if (!signatureAdded) doc.moveDown(2);

      doc.moveDown(1.5);
      doc.text('Le Bénéficiaire :').moveDown(0.5);
      doc.text(`${fullName}`).moveDown(0.3);
      doc.text(`Né(e) le ${birthDate}`).moveDown(0.3);
      doc.text(`${nationality}`).moveDown(1.5);
      doc.text('……………………………………………');

      doc.end();

    } catch (error) {
      console.error('Erreur génération PDF moratoire:', error);
      reject(error);
    }
  });
};

module.exports = { generateMoratoirePDF, uploadMoratoirePDFToS3 };
