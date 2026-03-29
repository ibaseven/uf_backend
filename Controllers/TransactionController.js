const { model } = require("mongoose");
const Transaction = require("../Models/TransactionModel");
const User = require("../Models/UserModel");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
module.exports.getAllTransactionsByUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const transactions = await Transaction.find({ userId })
      .populate({
        path: "projectIds",
        model: "Project",
        select: "nameProject packPrice",
      })
      .populate({
        path: "userId",
        model: "User",
        select: "firstName lastName email telephone",
      })
      .populate({
        path: "actions",
        model: "Action", // Ajout du model
        select: "actionNumber price status", // Ajout de plus de champs utiles
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "Récupération réussie",
      total: transactions.length,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        telephone: user.telephone,
      },
      transactions,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des transactions :", error);
    return res.status(500).json({
      message: "Erreur interne du serveur",
      error: error.message,
    });
  }
};

module.exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate({
        path: "projectIds",
        model: "Project",
        select: "nameProject packPrice",
      })
      .populate({
        path: "userId",
        model: "User",
        select: "firstName lastName email telephone",
      })
      .populate({
        path: "actions",
        model: "Action",
        select: "actionNumber price status",
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "Transactions récupérées avec succès",
      total: transactions.length,
      transactions,
    });

  } catch (error) {
    console.error("Erreur lors de la récupération des transactions :", error);
    return res.status(500).json({
      message: "Erreur interne du serveur",
      error: error.message,
    });
  }
};


module.exports.getTransactionsByProcess = async (req, res) => {
  try {
    const transactions = await Transaction.find();

    // Filtrer sur la description
    const actionsTransactions = transactions.filter(t =>
      t.description && t.description.includes("actions")
    );

    const particeProjectTransactions = transactions.filter(t =>
      t.description && t.description.includes("projets")
    );
const sommeActionsTransactions = actionsTransactions
  .filter(t => t.status === "confirmed")
  .reduce((total, t) => total + (t.amount || 0), 0);
const sommeProjectTransactions = particeProjectTransactions
  .filter(t => t.status === "confirmed")
  .reduce((total, t) => total + (t.amount || 0), 0);
    return res.status(200).json({
      message: "Transactions récupérées avec succès",
      actions: actionsTransactions.length,
      sommeActions:sommeActionsTransactions,
      sommeProject:sommeProjectTransactions,
      project: particeProjectTransactions.length,
      particeProjectTransactions,
      actionsTransactions
    });

  } catch (error) {
    console.error("Erreur lors de la récupération des transactions :", error);
    return res.status(500).json({
      message: "Erreur interne du serveur",
      error: error.message,
    });
  }
};

// ─── Helpers partagés ───────────────────────────────────────────────────────
function getStatusLabel(status) {
  switch (status) {
    case "confirmed": return "Complétée";
    case "pending":   return "En attente";
    case "failed":    return "Échouée";
    default:          return "En attente";
  }
}

function fetchAllTransactions() {
  return Transaction.find()
    .populate({ path: "projectIds", model: "Project", select: "nameProject packPrice" })
    .populate({ path: "userId",     model: "User",    select: "firstName lastName telephone" })
    .populate({ path: "actions",    model: "Action",  select: "actionNumber price status" })
    .sort({ createdAt: -1 })
    .lean();
}

// ─── Export PDF ──────────────────────────────────────────────────────────────
module.exports.exportTransactionsPDF = async (req, res) => {
  try {
    const transactions = await fetchAllTransactions();

    // ── Calcul des statistiques ──────────────────────────────────────────────
    const getCategory = (t) => {
      const desc = (t.description || "").toLowerCase();
      if (desc.includes("retrait"))                                  return "retraits";
      if (desc.includes("moratoire"))                                return "achat-moratoire";
      if (t.paidWithDividend || desc.includes("avec dividendes"))   return "achat-dividendes";
      if (t.actions)                                                 return "achat-paydunya";
      return "dividendes";
    };

    const fmt       = (n) => new Intl.NumberFormat("fr-FR").format(n) + " XOF";
    const byStatus  = (list, s) => list.filter(t => (t.status || "pending") === s);
    const sumAmount = (list)    => list.reduce((s, t) => s + (t.amount || 0), 0);

    const catList = (key) => transactions.filter(t => getCategory(t) === key);

    const ad = catList("achat-dividendes");
    const ap = catList("achat-paydunya");
    const am = catList("achat-moratoire");
    const dv = catList("dividendes");
    const rt = catList("retraits");

    const apConfAmount = sumAmount(byStatus(ap, "confirmed"));
    const amConfAmount = sumAmount(byStatus(am, "confirmed"));
    const totalCommissionable = apConfAmount + amConfAmount;
    const commission6   = Math.round(totalCommissionable * 0.06);
    const adminShare94  = totalCommissionable - commission6;

    const stats = {
      total:           transactions.length,
      totalConfirmed:  byStatus(transactions, "confirmed").length,
      totalPending:    byStatus(transactions, "pending").length,
      totalFailed:     byStatus(transactions, "failed").length,
      totalAmount:     sumAmount(byStatus(transactions, "confirmed")),

      adCount: ad.length, adConf: byStatus(ad,"confirmed").length, adPend: byStatus(ad,"pending").length, adAmount: sumAmount(byStatus(ad,"confirmed")),
      apCount: ap.length, apConf: byStatus(ap,"confirmed").length, apPend: byStatus(ap,"pending").length, apAmount: apConfAmount,
        apCommission: Math.round(apConfAmount * 0.06), apAdminShare: Math.round(apConfAmount * 0.94),
      amCount: am.length, amConf: byStatus(am,"confirmed").length, amPend: byStatus(am,"pending").length, amAmount: amConfAmount,
        amCommission: Math.round(amConfAmount * 0.06), amAdminShare: Math.round(amConfAmount * 0.94),
      dvCount: dv.length, dvConf: byStatus(dv,"confirmed").length, dvPend: byStatus(dv,"pending").length, dvAmount: sumAmount(byStatus(dv,"confirmed")),
      rtCount: rt.length, rtConf: byStatus(rt,"confirmed").length, rtPend: byStatus(rt,"pending").length, rtAmount: sumAmount(byStatus(rt,"confirmed")),

      totalCommissionable,
      commission6,
      adminShare94,
    };

    // ── Document ─────────────────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="transactions_${new Date().toISOString().split("T")[0]}.pdf"`
    );
    doc.pipe(res);

    const pageW  = doc.page.width  - 80; // largeur utile
    const startX = 40;

    // ── En-tête principal ────────────────────────────────────────────────────
    doc.rect(startX, 30, pageW, 36).fill("#1D4ED8");
    doc.fontSize(16).fillColor("#FFFFFF")
       .text("DiokoVente – Rapport des Transactions", startX + 10, 38, { width: pageW - 20, align: "center" });

    doc.rect(startX, 66, pageW, 18).fill("#DBEAFE");
    doc.fontSize(9).fillColor("#1E40AF")
       .text(
         `Généré le ${new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}   •   ${stats.total} transaction(s) au total`,
         startX + 10, 70, { width: pageW - 20, align: "center" }
       );

    // ── Bloc statistiques ────────────────────────────────────────────────────
    let y = 98;

    // Titre section stats
    doc.rect(startX, y, pageW, 16).fill("#F1F5F9");
    doc.fontSize(9).fillColor("#374151")
       .text("RÉSUMÉ STATISTIQUE", startX + 6, y + 4, { width: pageW - 12 });
    y += 20;

    // ---- Ligne 1 : cartes résumé global ----
    const cardW = pageW / 4 - 4;
    const cardH = 44;
    const cardData = [
      { label: "Total transactions", value: stats.total,          sub: null,                  bg: "#EFF6FF", border: "#93C5FD", txt: "#1D4ED8" },
      { label: "Completees",         value: stats.totalConfirmed, sub: fmt(stats.totalAmount), bg: "#F0FDF4", border: "#86EFAC", txt: "#15803D" },
      { label: "En attente",         value: stats.totalPending,   sub: null,                  bg: "#FFFBEB", border: "#FCD34D", txt: "#B45309" },
      { label: "Echouees",           value: stats.totalFailed,    sub: null,                  bg: "#FEF2F2", border: "#FCA5A5", txt: "#DC2626" },
    ];
    cardData.forEach((card, i) => {
      const cx = startX + i * (cardW + 5);
      doc.rect(cx, y, cardW, cardH).fillAndStroke(card.bg, card.border);
      doc.fontSize(8).fillColor("#6B7280").text(card.label, cx + 6, y + 6, { width: cardW - 12 });
      doc.fontSize(18).fillColor(card.txt).text(String(card.value), cx + 6, y + 16, { width: cardW - 12 });
      if (card.sub) doc.fontSize(7).fillColor(card.txt).text(card.sub, cx + 6, y + 34, { width: cardW - 12, ellipsis: true });
    });
    y += cardH + 8;

    // ---- Ligne 2 : 3 sous-catégories Achats ----
    doc.fontSize(8).fillColor("#374151").text("Achats d'Actions :", startX, y, { underline: true });
    y += 12;

    const ac3W = pageW / 3 - 4;
    const ac3H = 52;
    const achatCats = [
      { label: "Achat avec Dividendes", count: stats.adCount, conf: stats.adConf, pend: stats.adPend, amount: fmt(stats.adAmount), bg: "#F0FDF4", border: "#34D399", txt: "#065F46" },
      { label: "Achat via PayDunya",    count: stats.apCount, conf: stats.apConf, pend: stats.apPend, amount: fmt(stats.apAmount), bg: "#FAF5FF", border: "#A78BFA", txt: "#5B21B6" },
      { label: "Versement Moratoire",   count: stats.amCount, conf: stats.amConf, pend: stats.amPend, amount: fmt(stats.amAmount), bg: "#F0F9FF", border: "#38BDF8", txt: "#0C4A6E" },
    ];
    achatCats.forEach((cat, i) => {
      const cx = startX + i * (ac3W + 6);
      doc.rect(cx, y, ac3W, ac3H).fillAndStroke(cat.bg, cat.border);
      doc.fontSize(8).fillColor(cat.txt).text(cat.label, cx + 5, y + 5, { width: ac3W - 10 });
      doc.fontSize(7).fillColor("#374151").text(`Total : ${cat.count}`, cx + 5, y + 17, { width: ac3W / 2 - 5 });
      doc.fontSize(7).fillColor("#15803D").text(`Completees : ${cat.conf}`, cx + 5, y + 27);
      doc.fontSize(7).fillColor("#B45309").text(`En attente : ${cat.pend}`, cx + ac3W / 2, y + 27, { width: ac3W / 2 - 5 });
      doc.rect(cx + 4, y + 37, ac3W - 8, 11).fill(cat.border);
      doc.fontSize(7).fillColor("#FFFFFF").text(`Confirme : ${cat.amount}`, cx + 7, y + 40, { width: ac3W - 14, ellipsis: true });
    });
    y += ac3H + 8;

    // ---- Ligne 3 : Dividendes + Retraits ----
    const lastW = pageW / 2 - 4;
    const lastH = 44;
    const lastCats = [
      { label: "Dividendes", count: stats.dvCount, conf: stats.dvConf, pend: stats.dvPend, amount: fmt(stats.dvAmount), bg: "#EEF2FF", border: "#818CF8", txt: "#3730A3" },
      { label: "Retraits",   count: stats.rtCount, conf: stats.rtConf, pend: stats.rtPend, amount: fmt(stats.rtAmount), bg: "#FFF7ED", border: "#FB923C", txt: "#C2410C" },
    ];
    lastCats.forEach((cat, i) => {
      const cx = startX + i * (lastW + 8);
      doc.rect(cx, y, lastW, lastH).fillAndStroke(cat.bg, cat.border);
      doc.fontSize(8).fillColor(cat.txt).text(cat.label, cx + 5, y + 5, { width: lastW - 10 });
      doc.fontSize(7).fillColor("#374151").text(`Total : ${cat.count}`, cx + 5, y + 17, { width: lastW / 3 });
      doc.fontSize(7).fillColor("#15803D").text(`Completees : ${cat.conf}`, cx + 5, y + 27);
      doc.fontSize(7).fillColor("#B45309").text(`En attente : ${cat.pend}`, cx + lastW / 2, y + 27, { width: lastW / 2 - 5 });
      doc.rect(cx + 4, y + 33, lastW - 8, 9).fill(cat.border);
      doc.fontSize(7).fillColor("#FFFFFF").text(`Confirme : ${cat.amount}`, cx + 7, y + 35, { width: lastW - 14, ellipsis: true });
    });
    y += lastH + 14;

    // ── Bloc répartition commission ──────────────────────────────────────────
    if (stats.totalCommissionable > 0) {
      // Titre section
      doc.rect(startX, y, pageW, 16).fill("#1E293B");
      doc.fontSize(9).fillColor("#FFFFFF")
         .text("REPARTITION DES COMMISSIONS  —  Achats PayDunya & Moratoire (confirmes)", startX + 6, y + 4, { width: pageW - 12 });
      y += 20;

      // Barre visuelle 6% / 94%
      const barW = pageW;
      const bar6 = Math.round(barW * 0.06);
      doc.rect(startX, y, bar6, 12).fill("#F59E0B");           // 6% ambre
      doc.rect(startX + bar6, y, barW - bar6, 12).fill("#10B981"); // 94% vert
      doc.fontSize(7).fillColor("#FFFFFF")
         .text("6%", startX + 2, y + 3, { width: bar6 - 4 });
      doc.fontSize(7).fillColor("#FFFFFF")
         .text("94% Admin", startX + bar6 + 4, y + 3, { width: barW - bar6 - 8 });
      y += 18;

      // 3 cases : Total | Commission 6% | Part Admin 94%
      const cW = pageW / 3 - 4;
      const cH = 42;
      const commCases = [
        { label: "Montant total collecte", val: fmt(stats.totalCommissionable), sub: "PayDunya + Moratoire confirmes", bg: "#F8FAFC", border: "#94A3B8", txt: "#334155" },
        { label: "Commission plateforme (6%)", val: fmt(stats.commission6),
          sub: `PayDunya: ${fmt(stats.apCommission)}  |  Moratoire: ${fmt(stats.amCommission)}`,
          bg: "#FFFBEB", border: "#F59E0B", txt: "#B45309" },
        { label: "Verse a l'Admin (94%)", val: fmt(stats.adminShare94),
          sub: `PayDunya: ${fmt(stats.apAdminShare)}  |  Moratoire: ${fmt(stats.amAdminShare)}`,
          bg: "#F0FDF4", border: "#10B981", txt: "#065F46" },
      ];
      commCases.forEach((c, i) => {
        const cx = startX + i * (cW + 6);
        doc.rect(cx, y, cW, cH).fillAndStroke(c.bg, c.border);
        doc.fontSize(7).fillColor(c.txt).text(c.label, cx + 5, y + 4, { width: cW - 10 });
        doc.fontSize(12).fillColor(c.txt).text(c.val, cx + 5, y + 14, { width: cW - 10 });
        doc.fontSize(6).fillColor("#6B7280").text(c.sub, cx + 5, y + 30, { width: cW - 10, ellipsis: true });
      });
      y += cH + 12;
    }

    // ── Séparateur ───────────────────────────────────────────────────────────
    doc.moveTo(startX, y).lineTo(startX + pageW, y).strokeColor("#CBD5E1").lineWidth(1).stroke();
    y += 8;

    // Titre section tableau
    doc.rect(startX, y, pageW, 16).fill("#F1F5F9");
    doc.fontSize(9).fillColor("#374151")
       .text("DÉTAIL DES TRANSACTIONS", startX + 6, y + 4, { width: pageW - 12 });
    y += 20;

    // ── Tableau de détail ────────────────────────────────────────────────────
    const cols = [
      { label: "Date",          width: 82 },
      { label: "Catégorie",     width: 80 },
      { label: "Utilisateur",   width: 110 },
      { label: "Téléphone",     width: 88 },
      { label: "Projet(s)",     width: 120 },
      { label: "Actions",       width: 46 },
      { label: "Montant (XOF)", width: 90 },
      { label: "Statut",        width: 65 },
    ];
    const rowH = 18;
    const totalW = cols.reduce((s, c) => s + c.width, 0);

    // En-tête colonnes
    doc.fontSize(8).fillColor("#FFFFFF");
    let cx = startX;
    cols.forEach(col => {
      doc.rect(cx, y, col.width, rowH).fill("#1D4ED8");
      doc.fillColor("#FFFFFF").text(col.label, cx + 3, y + 5, { width: col.width - 6, ellipsis: true });
      cx += col.width;
    });
    y += rowH;

    // Lignes de données
    const catColors = {
      "achat-dividendes": "#065F46", "achat-paydunya": "#5B21B6",
      "achat-moratoire":  "#0C4A6E", "dividendes": "#3730A3", "retraits": "#C2410C"
    };
    const catLabels = {
      "achat-dividendes": "Achat/Dividendes", "achat-paydunya": "Achat/PayDunya",
      "achat-moratoire":  "Moratoire",         "dividendes": "Dividende", "retraits": "Retrait"
    };

    transactions.forEach((t, i) => {
      if (y + rowH > doc.page.height - 50) {
        doc.addPage({ margin: 40, size: "A4", layout: "landscape" });
        y = 40;
        // Répéter en-tête colonnes sur nouvelle page
        cx = startX;
        cols.forEach(col => {
          doc.rect(cx, y, col.width, rowH).fill("#1D4ED8");
          doc.fillColor("#FFFFFF").text(col.label, cx + 3, y + 5, { width: col.width - 6, ellipsis: true });
          cx += col.width;
        });
        y += rowH;
      }

      const bg = i % 2 === 0 ? "#F9FAFB" : "#FFFFFF";
      doc.rect(startX, y, totalW, rowH).fill(bg);

      const cat      = getCategory(t);
      const catLabel = catLabels[cat];
      const catColor = catColors[cat];
      const userName = t.userId ? `${t.userId.firstName} ${t.userId.lastName}` : "–";
      const phone    = t.userId?.telephone || "–";
      const projects = t.projectIds?.map(p => p.nameProject).join(", ") || "–";
      const actionN  = t.actions ? String(t.actions.actionNumber) : "–";
      const amount   = new Intl.NumberFormat("fr-FR").format(t.amount);
      const date     = new Date(t.createdAt).toLocaleDateString("fr-FR");
      const status   = getStatusLabel(t.status);

      const statusColor = t.status === "confirmed" ? "#15803D" : t.status === "failed" ? "#DC2626" : "#B45309";

      doc.fontSize(7).fillColor("#111827");
      cx = startX;
      [date, catLabel, userName, phone, projects, actionN, amount, status].forEach((val, idx) => {
        let color = "#111827";
        if (idx === 1) color = catColor;         // catégorie colorée
        if (idx === 7) color = statusColor;      // statut coloré
        doc.fillColor(color).text(val, cx + 3, y + 5, { width: cols[idx].width - 6, ellipsis: true });
        cx += cols[idx].width;
      });

      doc.moveTo(startX, y + rowH).lineTo(startX + totalW, y + rowH).strokeColor("#E5E7EB").lineWidth(0.4).stroke();
      y += rowH;
    });

    // ── Pied de page – récapitulatif final ───────────────────────────────────
    y += 10;
    if (y + 30 > doc.page.height - 40) {
      doc.addPage({ margin: 40, size: "A4", layout: "landscape" });
      y = 40;
    }

    doc.rect(startX, y, totalW, 22).fill("#1D4ED8");
    doc.fontSize(9).fillColor("#FFFFFF")
       .text(
         `MONTANT TOTAL CONFIRMÉ  :  ${fmt(stats.totalAmount)}`,
         startX + 6, y + 7, { width: totalW - 12, align: "right" }
       );

    doc.end();
  } catch (error) {
    console.error("Erreur export PDF :", error);
    return res.status(500).json({ message: "Erreur interne du serveur", error: error.message });
  }
};

// ─── Export Excel ────────────────────────────────────────────────────────────
module.exports.exportTransactionsExcel = async (req, res) => {
  try {
    const transactions = await fetchAllTransactions();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "DiokoVente";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Transactions", {
      pageSetup: { fitToPage: true, orientation: "landscape" },
    });

    // ── Titre fusionné ──
    sheet.mergeCells("A1:J1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "DiokoVente – Rapport des Transactions";
    titleCell.font = { bold: true, size: 14, color: { argb: "FF1D4ED8" } };
    titleCell.alignment = { horizontal: "center" };

    sheet.mergeCells("A2:J2");
    const subtitleCell = sheet.getCell("A2");
    subtitleCell.value = `Généré le ${new Date().toLocaleDateString("fr-FR")}  |  Total : ${transactions.length} transaction(s)`;
    subtitleCell.font = { size: 10, color: { argb: "FF6B7280" } };
    subtitleCell.alignment = { horizontal: "center" };

    sheet.addRow([]);

    // ── En-tête colonnes ──
    const headers = [
      "Date", "Type", "ID Transaction", "Utilisateur", "Téléphone",
      "Projet(s)", "Nb Actions", "Montant (XOF)", "Statut", "Token",
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
    });
    headerRow.height = 22;

    // ── Données ──
    transactions.forEach((t, i) => {
      const row = sheet.addRow([
        new Date(t.createdAt).toLocaleDateString("fr-FR"),
        { "achat-dividendes": "Achat/Dividendes", "achat-paydunya": "Achat/PayDunya", "achat-moratoire": "Moratoire", "dividendes": "Dividende", "retraits": "Retrait" }[getCategory(t)],
        t._id.toString(),
        t.userId ? `${t.userId.firstName} ${t.userId.lastName}` : "–",
        t.userId?.telephone || "–",
        t.projectIds?.map(p => p.nameProject).join(", ") || "–",
        t.actions ? t.actions.actionNumber : "–",
        t.amount,
        getStatusLabel(t.status),
        t.invoiceToken || "–",
      ]);

      const bgColor = i % 2 === 0 ? "FFF9FAFB" : "FFFFFFFF";
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        cell.font = { size: 9 };
        cell.alignment = { vertical: "middle" };
        cell.border = {
          top: { style: "hair" }, bottom: { style: "hair" },
          left: { style: "hair" }, right: { style: "hair" },
        };
      });

      // Couleur statut
      const statusCell = row.getCell(9);
      if (t.status === "confirmed") statusCell.font = { size: 9, color: { argb: "FF16A34A" }, bold: true };
      else if (t.status === "failed") statusCell.font = { size: 9, color: { argb: "FFDC2626" }, bold: true };
      else statusCell.font = { size: 9, color: { argb: "FFD97706" } };

      row.height = 18;
    });

    // ── Ligne totaux ──
    sheet.addRow([]);
    const totalConfirmed = transactions.filter(t => t.status === "confirmed").reduce((s, t) => s + t.amount, 0);
    const totalRow = sheet.addRow(["", "", "", "", "", "", "Total confirmé :", totalConfirmed, "", ""]);
    const labelCell = totalRow.getCell(7);
    labelCell.font = { bold: true, size: 10 };
    labelCell.alignment = { horizontal: "right" };
    const amountCell = totalRow.getCell(8);
    amountCell.font = { bold: true, size: 10, color: { argb: "FF16A34A" } };
    amountCell.numFmt = '#,##0';

    // ── Largeurs colonnes ──
    const colWidths = [14, 12, 30, 22, 16, 30, 12, 16, 14, 30];
    colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

    // ── Auto-filtre ──
    sheet.autoFilter = { from: "A4", to: "J4" };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="transactions_${new Date().toISOString().split("T")[0]}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Erreur export Excel :", error);
    return res.status(500).json({ message: "Erreur interne du serveur", error: error.message });
  }
};
