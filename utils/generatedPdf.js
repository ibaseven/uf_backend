const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const qs = require('qs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

const uploadPDFToS3 = async function (pdfBuffer, fileName) {
  const s3Key = `contrats/${fileName}`;

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);

  // URL propre accessible publiquement
  const cleanUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

  return {
    cleanUrl,
    s3Key,
  };
};


const generateContractPDF = async (purchaseData, userData) => {
  return new Promise((resolve, reject) => {
    try {
      // Créer un nouveau document PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 60,
          bottom: 60,
          left: 60,
          right: 60
        }
      });

      // Buffer pour stocker le PDF
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // === GESTION DU LOGO ===
      const logoPath = path.join(__dirname, '../assets/logo.png');
      let logoAdded = false;
      
      try {
        if (fs.existsSync(logoPath)) {
          const stats = fs.statSync(logoPath);
          if (stats.isFile() && stats.size > 0) {
            const logoWidth = 80;
            const logoHeight = 60;
            const pageWidth = doc.page.width;
            const logoX = (pageWidth - logoWidth) / 2;
            
            doc.image(logoPath, logoX, 45, { 
              width: logoWidth,
              height: logoHeight,
              fit: [logoWidth, logoHeight],
              align: 'center'
            });
            logoAdded = true;
            doc.moveDown(4);
          }
        }
      } catch (logoError) {
        console.warn('Erreur lors du chargement du logo:', logoError.message);
      }
      
      if (!logoAdded) {
        console.log('Logo non trouvé, continuation sans logo');
        doc.moveDown(2);
      }

      // Titre principal centré avec espacement important
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('CONTRAT DE CESSION', { align: 'center' })
         .moveDown(2);

      // Récupération des données utilisateur
      const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || '[Nom complet]';
      const birthDate = userData.dateNaissance || '[date de naissance]';
      const nationality = userData.nationalite || '[nationalité]';
      const address = userData.adresse || `${userData.ville || '[ville]'}, ${userData.pays || '[pays]'}`;

      // Fonction de formatage des montants
      const formatMontant = (montant) => {
        return montant.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      };

      // Récupération sécurisée des données d'achat
      const rawNombreActionsAchat = purchaseData?.actionNumber;
      const nombreActionsAchat = Number(rawNombreActionsAchat);
      
      // Récupération sécurisée des données utilisateur
      const rawNombreActionsTotal = userData?.actionsNumber;
      const nombreActionsTotal = Number(rawNombreActionsTotal);
      
      // Récupération du prix par action et calcul du montant total
      const prixParAction = purchaseData?.price || 2000;
      const montantTotal = nombreActionsAchat * prixParAction;
      
      // Calculs des pourcentages
      const capitalTotal = 1000000; // Capital total de la société
      const pourcentageAchat = Number((nombreActionsAchat / capitalTotal * 100).toFixed(5));
      const pourcentageTotal = Number(((nombreActionsTotal / capitalTotal) * 100).toFixed(5));

      // Le soussigné
      doc.fontSize(11)
         .font('Helvetica')
         .text('Le soussigné :', { align: 'left' })
         .moveDown(0.5);

      // Description de la société cédante
      doc.font('Helvetica')
         .text('la société ', { continued: true })
         .font('Helvetica-Bold')
         .text('UNIVERSAL FAB SASU', { continued: true })
         .font('Helvetica')
         .text(', société par actions simplifiée unipersonnelle au capital de ', { continued: true })
         .font('Helvetica-Bold')
         .text('1 000 000 FCFA', { continued: true })
         .font('Helvetica')
         .text(',')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('dont le siège social est situé à ', { continued: true })
         .font('Helvetica-Bold')
         .text('Saly Carrefour PLLE 67/A.T140/413748, Mbour - Sénégal', { continued: true })
         .font('Helvetica')
         .text(',')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('immatriculée au Registre du Commerce et des Sociétés de Thies sous le numéro ', { continued: true })
         .font('Helvetica-Bold')
         .text('011238484', { continued: true })
         .font('Helvetica')
         .text(' -')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('RC : ', { continued: true })
         .font('Helvetica-Bold')
         .text('SN.THS.2024.A.2422', { continued: true })
         .font('Helvetica')
         .text(', représentée par ', { continued: true })
         .font('Helvetica-Bold')
         .text('Monsieur Magatte Mbaye', { continued: true })
         .font('Helvetica')
         .text(', en sa qualité de')
         .moveDown(0.5);

      doc.font('Helvetica-Bold')
         .text('Directeur Général', { continued: true })
         .font('Helvetica')
         .text(',')
         .moveDown(1);

      // Cède à (Bénéficiaire) - AJOUT DES INFORMATIONS DU USER
      doc.font('Helvetica')
         .text('cède à ', { continued: true })
         .font('Helvetica-Bold')
         .text(`M(me) ${fullName}`, { continued: true })
         .font('Helvetica')
         .text(`, né le ${birthDate}, de nationalité ${nationality}, demeurant à ${address},`)
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('ci-après désigné ', { continued: true })
         .font('Helvetica-Bold')
         .text('« le Bénéficiaire »', { continued: true })
         .font('Helvetica')
         .text(' ou ', { continued: true })
         .font('Helvetica-Bold')
         .text('« le Participant »', { continued: true })
         .font('Helvetica')
         .text(',')
         .moveDown(0.5);

      // Informations sur la cession avec les montants de l'achat
      doc.font('Helvetica-Bold')
         .text(`${formatMontant(nombreActionsAchat)} unités de participation`, { continued: true })
         .font('Helvetica')
         .text(' représentant ', { continued: true })
         .font('Helvetica-Bold')
         .text(`${pourcentageAchat}%`, { continued: true })
         .font('Helvetica')
         .text(' du capital économique, pour un montant total de ', { continued: true })
         .font('Helvetica-Bold')
         .text(`${formatMontant(montantTotal)} FCFA`, { continued: true })
         .font('Helvetica')
         .text('.')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le Bénéficiaire détient désormais un total de ', { continued: true })
         .font('Helvetica-Bold')
         .text(`${formatMontant(nombreActionsTotal)} unités`, { continued: true })
         .font('Helvetica')
         .text(', représentant ', { continued: true })
         .font('Helvetica-Bold')
         .text(`${pourcentageTotal}%`, { continued: true })
         .font('Helvetica')
         .text(' de participation économique.')
         .moveDown(1);

      // Il a été convenu ce qui suit
      doc.font('Helvetica')
         .text('Il a été convenu ce qui suit :')
         .moveDown(1);

      // Article 1
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 1 – Qualification et portée')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le présent contrat constitue un instrument sui generis d\'intéressement économique, de nature strictement contractuelle, excluant toute qualification de valeur mobilière, de titre financier ou de droit social, et se situe hors du champ de l\'appel public à l\'épargne.')
         .moveDown(1);

      // Article 2
      doc.font('Helvetica-Bold')
         .text('Article 2 – Unités et métrique économique')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('La participation est mesurée en unités abstraites, chacune fixée à deux mille (2 000) FCFA, représentant un coefficient économique de 0,001 %, servant exclusivement à la ventilation des flux de rémunération contractuelle, à l\'exclusion de toute prétention patrimoniale sur le capital.')
         .moveDown(1);

      // Article 3
      doc.font('Helvetica-Bold')
         .text('Article 3 – Renonciation aux droits sociaux')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le Participant renonce irrévocablement à toute prétention assimilable à des droits d\'associé, incluant le droit de vote, d\'information institutionnelle étendue, de représentation ou de co-gestion, ces prérogatives étant réservées aux seuls actionnaires inscrits.')
         .moveDown(1);

      // Article 4
      doc.font('Helvetica-Bold')
         .text('Article 4 – Rémunération conditionnelle')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('La rémunération, purement aléatoire par essence économique, est fonction du chiffre d\'affaires net encaissé, selon des clés arrêtées unilatéralement par la plateforme, sans garantie de périodicité, de minimum ou de rendement.')
         .moveDown(1);

      // Article 5
      doc.font('Helvetica-Bold')
         .text('Article 5 – Convertibilité éventuelle')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('À titre de simple faculté et non de droit, le Participant peut solliciter la conversion de tout ou partie de ses unités en droits sociaux, sous réserve d\'agrément, de purge des incompatibilités et de réalisation des conditions légales et statutaires.')
         .moveDown(1);

      // Article 6
      doc.font('Helvetica-Bold')
         .text('Article 6 - Effet de la cession')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le transfert de propriété prend effet à la date de signature du présent acte. Le Bénéficiaire devient propriétaire des parts, avec tous les droits y afférents.')
         .moveDown(1);

      // Article 7
      doc.font('Helvetica-Bold')
         .text('Article 7 - Acceptation des statuts')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le Bénéficiaire déclare avoir pris connaissance des statuts de la société UNIVERSAL FAB SASU et les accepter sans réserve.')
         .moveDown(1);

      // Article 8
      doc.font('Helvetica-Bold')
         .text('Article 8 - Garanties')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le Cédant garantit que les parts cédées sont :')
         .moveDown(0.3);

      doc.text('- librement cessibles,')
         .moveDown(0.2);
      doc.text('- entièrement libérées,')
         .moveDown(0.2);
      doc.text('- non grevées d\'aucune charge ou engagement envers des tiers.')
         .moveDown(1);

      // Article 9
      doc.font('Helvetica-Bold')
         .text('Article 9 - Formalités Les parties s\'engagent à :')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('- faire enregistrer cette cession dans le registre des mouvements de titres de la société,')
         .moveDown(0.2);
      doc.text('- procéder à la mise à jour du registre des participants')
         .moveDown(1.5);

      // Lieu et date
      const dateSignature = new Date().toLocaleDateString('fr-FR');
      doc.font('Helvetica')
         .text(`Fait à Mbour, le ${dateSignature}`)
         .moveDown(2);

      // Signatures
      doc.font('Helvetica')
         .text('Signatures :')
         .moveDown(1);

      // Zone signature du cédant
      doc.text('Le Cédant :')
         .moveDown(0.5);
      
      doc.text('Monsieur Magatte Mbaye')
         .moveDown(0.3);
      
      doc.text('Directeur Général')
         .moveDown(0.3);
      
      doc.text('UNIVERSAL FAB SASU')
         .moveDown(0.5);

      // === GESTION DE LA SIGNATURE ===
      const signaturePath = path.join(__dirname, '../assets/SIGNATURE UNIVERS FAB.png');
      let signatureAdded = false;
      
      try {
        const possibleSignaturePaths = [
          path.join(__dirname, '../assets/SIGNATURE UNIVERS FAB.png'),
          path.join(__dirname, '../assets/signature_dg.jpg'),
          path.join(__dirname, '../assets/signature_dg.jpeg'),
          path.join(__dirname, '../assets/signature.png'),
          path.join(__dirname, '../assets/signature.jpg')
        ];
        
        for (const sigPath of possibleSignaturePaths) {
          if (fs.existsSync(sigPath)) {
            const stats = fs.statSync(sigPath);
            if (stats.isFile() && stats.size > 0) {
              doc.image(sigPath, doc.x, doc.y, { 
                width: 120,
                height: 60,
                fit: [120, 60],
                align: 'left'
              });
              signatureAdded = true;
              doc.moveDown(4);
              break;
            }
          }
        }
      } catch (signatureError) {
        console.warn('Erreur lors du chargement de la signature:', signatureError.message);
      }
      
      if (!signatureAdded) {
        console.log('Signature non trouvée, continuation sans signature');
        doc.moveDown(2);
      }

      // Espace avant le bénéficiaire
      doc.moveDown(1.5);

      // Zone signature du bénéficiaire
      doc.text('Le Bénéficiaire :')
         .moveDown(0.5);
      
      doc.text(`${fullName}`)
         .moveDown(0.3);
      
      doc.text(`Né le ${birthDate}`)
         .moveDown(0.3);
      
      doc.text(`${nationality}`)
         .moveDown(1.5)
         .text('……………………………………………');

      // === NOUVELLE PAGE : STATUTS ===
      doc.addPage();

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('STATUTS DE LA SOCIÉTÉ PAR ACTIONS SIMPLIFIÉE UNIPERSONNELLE', { align: 'center' })
         .moveDown(0.5);
      
      doc.fontSize(13)
         .text('UNIVERSAL FAB', { align: 'center' })
         .moveDown(2);

      // Articles des statuts
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 1 – Forme juridique', { align: 'left' })
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Il est formé entre l\'associé unique une Société par Actions Simplifiée Unipersonnelle (SASU), régie par l\'Acte uniforme OHADA relatif au droit des sociétés commerciales et du groupement d\'intérêt économique, ainsi que par les présents statuts.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 2 – Dénomination sociale')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('La société prend la dénomination sociale : UNIVERSAL FAB.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 3 – Objet social')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('La société a pour objet, au Sénégal et à l\'international :')
         .moveDown(0.3);
      
      doc.text('- la conception, la fabrication et le développement de projets industriels et technologiques ;')
         .moveDown(0.2);
      doc.text('- la création et l\'exploitation de plateformes économiques et industrielles ;')
         .moveDown(0.2);
      doc.text('- la mise en place de programmes de participation économique non capitalistiques ;')
         .moveDown(0.2);
      doc.text('- l\'ingénierie financière, organisationnelle et stratégique ;')
         .moveDown(0.2);
      doc.text('- et plus généralement toutes opérations se rattachant directement ou indirectement à l\'objet social.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 4 – Siège social')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le siège social est fixé au Sénégal. Il peut être transféré sur décision du Président.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 5 – Durée')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('La durée de la société est fixée à quatre-vingt-dix-neuf (99) années.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 6 – Capital social')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le capital social est fixé à un million (1 000 000) de francs CFA, divisé en cent mille (100 000) actions ordinaires representant chacune 0,001% . Le capital est affecté exclusivement à la structuration des pouvoirs, de la gouvernance et de la représentation sociale, à l’exclusion de toute fonction de collecte participative.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 7 – Nature du capital')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le capital social est destiné exclusivement à la gouvernance, au contrôle et à la représentation légale de la société. Il est juridiquement distinct de tout programme de participation économique.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 8 – Président')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('La société est dirigée par un Président, personne physique ou morale, nommé par l\'associé unique, disposant des pouvoirs les plus étendus pour agir en toute circonstance au nom de la société.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 9 – Actions')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Seules les personnes inscrites au registre des actionnaires ont la qualité d\'actionnaire. Les participants aux programmes économiques ne disposent d\'aucun droit lié au capital.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 10 – Programmes de participation économique')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('La société peut proposer à des tiers des participations économiques contractuelles :')
         .moveDown(0.3);
      
      doc.text('- 1 unité = 2 000 FCFA')
         .moveDown(0.2);
      doc.text('- 1 unité = 0,001 % économique')
         .moveDown(0.2);
      doc.text('- Minimum : 5 unités')
         .moveDown(0.3);
      
      doc.text('Ces participations ne constituent ni des actions, ni des parts sociales, ni des titres financiers.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 11 – Accès au capital')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('L\'accès au capital est réservé aux participants ayant atteint un seuil de mille (1 000) unités, soit un apport équivalent à deux millions (2 000 000) FCFA. La conversion est soumise à validation de la société et à formalisation notariée.')
         .moveDown(2);

      // === NOUVELLE PAGE : ACTE DE CONVERSION ===
      doc.addPage();

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('ACTE DE CONVERSION DE PARTICIPATION EN ACTIONS', { align: 'center' })
         .moveDown(0.5);
      
      doc.fontSize(13)
         .text('UNIVERSAL FAB', { align: 'center' })
         .moveDown(2);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 1 – Objet', { align: 'left' })
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le présent acte constate la conversion d\'une participation économique en actions du capital social d\'Universal Fab.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 2 – Conditions de conversion')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Le participant justifie avoir atteint mille (1 000) unités, soit deux millions (2 000 000) FCFA de participation cumulée.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 3 – Effets')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('Les unités sont annulées. Le participant devient actionnaire à hauteur de 1 % du capital social, avec tous les droits attachés à ce statut.')
         .moveDown(1);

      doc.font('Helvetica-Bold')
         .text('Article 4 – Formalisation')
         .moveDown(0.5);

      doc.font('Helvetica')
         .text('La conversion prend effet après signature devant notaire et mise à jour du RCCM.')
         .moveDown(2);

      // Finaliser le document
      doc.end();

    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      reject(error);
    }
  });
};

module.exports = {
  generateContractPDF,
  uploadPDFToS3
};