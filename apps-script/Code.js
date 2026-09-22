/******************************************************
 * ACADÉMIE IA GÉNÉRATIVE
 * Google Apps Script — VERSION CORRIGÉE
 *
 * Fonctions :
 * - Traitement Google Forms
 * - Génération ID inscription
 * - Génération fiche PDF
 * - Envoi e-mail de confirmation
 * - Registre officiel des certificats
 * - Vérification publique des certificats
 *
 * CORRECTIONS APPORTÉES (voir résumé en fin de fichier) :
 * 1. Sécurisation de l'action "register" avec un jeton secret
 * 2. Passage de "register" en POST (au lieu de GET)
 * 3. Formule HYPERLINK compatible avec toutes les locales
 * 4. Validation d'ID généralisée à plusieurs niveaux (N1, N2, N3...)
 * 5. Récupération du fichier PDF sans regex fragile
 ******************************************************/


/* =====================================================
   CONFIGURATION DU REGISTRE DES CERTIFICATS
   ===================================================== */

const CERTIFICATS_SPREADSHEET_ID =
  "1DqmQzhg2pZwnq4MPxwO26eqqKUyhRcnyiljNn1gA66U";

const CERTIFICATS_SHEET_NAME =
  "Certificats";

/*
 * Niveaux de certificat acceptés.
 * Ajoutez ici "N2", "N3", etc. si besoin, sans toucher au reste du code.
 */
const NIVEAUX_CERTIFICAT_VALIDES = ["N1"];

/*
 * IMPORTANT — Jeton secret pour sécuriser l'action "register".
 *
 * Ne mettez JAMAIS le secret directement dans le code.
 * Configurez-le une fois via :
 *   Extensions > Apps Script > Paramètres du projet > Propriétés du script
 *   Clé   : REGISTER_API_TOKEN
 *   Valeur: (une chaîne longue et aléatoire, ex. générée avec un gestionnaire de mots de passe)
 *
 * Ou en exécutant une fois manuellement dans l'éditeur :
 *   PropertiesService.getScriptProperties().setProperty('REGISTER_API_TOKEN', 'votre-secret-long');
 */
function getRegisterApiToken() {
  return PropertiesService
    .getScriptProperties()
    .getProperty("REGISTER_API_TOKEN");
}


/* =====================================================
   1. TRAITEMENT DU FORMULAIRE
   ===================================================== */

function onFormSubmit(e) {

  if (!e || !e.range) {
    throw new Error("Événement de formulaire invalide.");
  }

  const sheet = e.range.getSheet();
  const row = e.range.getRow();

  const responses = e.namedValues || {};


  /* --------------------------------------------------
     Récupération des informations
     -------------------------------------------------- */

  const nomPrenom =
    getAnswer(responses, "Nom et prénom");

  const email =
    getAnswer(responses, "Email");

  const formation =
    getAnswer(responses, "FORMATION CHOISIE");

  const niveau =
    getAnswer(responses, "NIVEAU ACTUEL");


  /* --------------------------------------------------
     Création de l'ID d'inscription
     -------------------------------------------------- */

  const annee =
    new Date().getFullYear();

  const numero =
    row - 1;

  const idInscription =
    "INS-" +
    annee +
    "-" +
    String(numero).padStart(4, "0");


  /* --------------------------------------------------
     Colonnes automatiques
     -------------------------------------------------- */

  const idColumn =
    getOrCreateColumn(sheet, "ID INSCRIPTION");

  const statutColumn =
    getOrCreateColumn(sheet, "STATUT");

  const dateColumn =
    getOrCreateColumn(sheet, "DATE DE TRAITEMENT");


  /* --------------------------------------------------
     Enregistrement dans la feuille
     -------------------------------------------------- */

  sheet.getRange(row, idColumn).setValue(idInscription);
  sheet.getRange(row, statutColumn).setValue("NOUVEAU");
  sheet.getRange(row, dateColumn).setValue(new Date());


  /* --------------------------------------------------
     Génération automatique de la fiche PDF
     -------------------------------------------------- */

  // CORRECTION 5 : la fonction retourne maintenant un objet { url, fileId }
  // au lieu d'une simple URL qu'il fallait ensuite ré-analyser par regex.
  const ficheGeneree =
    genererFichePDF(
      nomPrenom,
      email,
      formation,
      niveau,
      idInscription,
      "NOUVEAU"
    );

  const pdfUrl = ficheGeneree.url;

  const pdfFile =
    DriveApp.getFileById(ficheGeneree.fileId);

  const pdfAttachment =
    pdfFile.getAs(MimeType.PDF);


  /* --------------------------------------------------
     Ajout du lien PDF dans la feuille
     -------------------------------------------------- */

  const pdfColumn =
    getOrCreateColumn(sheet, "FICHE PDF");

  // CORRECTION 3 : formule HYPERLINK compatible avec la locale du classeur.
  sheet
    .getRange(row, pdfColumn)
    .setFormula(
      buildHyperlinkFormula(sheet, pdfUrl, "📄 OUVRIR LA FICHE")
    );


  /* --------------------------------------------------
     Envoi de l'e-mail
     -------------------------------------------------- */

  if (email) {

    const sujet =
      "Confirmation de votre inscription - Académie IA Générative";

    const htmlMessage =
      "<!DOCTYPE html>" +
      "<html>" +
      "<body style='margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;'>" +

      "<div style='max-width:600px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.08);'>" +

      "<div style='background:#1e3a8a;padding:25px;text-align:center;color:white;'>" +
      "<img src='https://i.postimg.cc/mgg7cm4b/Logo-Academie-IA.png' " +
      "alt='Académie IA Générative' " +
      "style='display:block;margin:0 auto 15px auto;width:180px;max-width:80%;height:auto;'>" +
      "<h1 style='margin:0;font-size:24px;'>Académie IA Générative</h1>" +
      "<p style='margin:10px 0 0;font-size:16px;'>Confirmation d'inscription</p>" +
      "</div>" +

      "<div style='padding:30px;color:#333333;'>" +

      "<p style='font-size:17px;'>Bonjour <strong>" + nomPrenom + "</strong>,</p>" +

      "<p style='font-size:15px;line-height:1.6;'>" +
      "Nous avons bien reçu votre inscription et vous remercions pour votre confiance." +
      "</p>" +

      "<div style='background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px;text-align:center;margin:25px 0;'>" +
      "<p style='margin:0;color:#64748b;font-size:13px;'>VOTRE ID D'INSCRIPTION</p>" +
      "<div style='margin-top:8px;font-size:28px;font-weight:bold;color:#1e3a8a;'>" + idInscription + "</div>" +
      "</div>" +

      "<table style='width:100%;border-collapse:collapse;font-size:15px;'>" +
      "<tr>" +
      "<td style='padding:12px 0;border-bottom:1px solid #e5e7eb;color:#64748b;'>Formation</td>" +
      "<td style='padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;'>" + formation + "</td>" +
      "</tr>" +
      "<tr>" +
      "<td style='padding:12px 0;border-bottom:1px solid #e5e7eb;color:#64748b;'>Niveau</td>" +
      "<td style='padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;'>" + niveau + "</td>" +
      "</tr>" +
      "<tr>" +
      "<td style='padding:12px 0;color:#64748b;'>Statut</td>" +
      "<td style='padding:12px 0;text-align:right;font-weight:bold;color:#16a34a;'>NOUVEAU</td>" +
      "</tr>" +
      "</table>" +

      "<p style='font-size:15px;line-height:1.6;margin-top:25px;'>" +
      "Votre inscription est bien enregistrée. Conservez précieusement votre ID d'inscription pour vos futurs échanges avec notre équipe." +
      "</p>" +

      "<div style='text-align:center;margin-top:30px;'>" +
      "<a href='https://wa.me/2250544165418' " +
      "style='display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:7px;font-weight:bold;'>" +
      "Contacter l'équipe sur WhatsApp" +
      "</a>" +
      "</div>" +

      "</div>" +

      "<div style='background:#f8fafc;padding:18px;text-align:center;color:#64748b;font-size:12px;'>" +
      "Académie IA Générative<br>Message automatique" +
      "</div>" +

      "</div>" +
      "</body>" +
      "</html>";


    MailApp.sendEmail({
      to: email,
      subject: sujet,
      body:
        "Bonjour " + nomPrenom + ",\n\n" +
        "Votre inscription a bien été enregistrée.\n\n" +
        "ID d'inscription : " + idInscription + "\n" +
        "Formation : " + formation + "\n" +
        "Niveau : " + niveau + "\n" +
        "Statut : NOUVEAU\n\n" +
        "Votre fiche d'inscription PDF est jointe à cet e-mail.\n\n" +
        "Académie IA Générative",
      htmlBody: htmlMessage,
      attachments: [pdfAttachment]
    });
  }


  /* --------------------------------------------------
     Journal
     -------------------------------------------------- */

  Logger.log("Inscription : " + idInscription);
  Logger.log("Nom : " + nomPrenom);
  Logger.log("Email : " + email);
  Logger.log("Formation : " + formation);
  Logger.log("E-mail envoyé.");
}


/* =====================================================
   2. RÉCUPÉRER UNE RÉPONSE DU FORMULAIRE
   ===================================================== */

function getAnswer(responses, question) {
  if (!responses[question]) {
    return "";
  }
  return responses[question][0] || "";
}


/* =====================================================
   3. GÉNÉRATION DE LA FICHE PDF
   ===================================================== */

function genererFichePDF(
  nomPrenom,
  email,
  formation,
  niveau,
  idInscription,
  statut
) {

  const nomDossier = "FICHES D'INSCRIPTION";

  const dossiers = DriveApp.getFoldersByName(nomDossier);

  let dossier;

  if (dossiers.hasNext()) {
    dossier = dossiers.next();
  } else {
    dossier = DriveApp.createFolder(nomDossier);
  }


  const document = DocumentApp.create("FICHE - " + idInscription);
  const body = document.getBody();

  body.setMarginTop(40);
  body.setMarginBottom(40);
  body.setMarginLeft(45);
  body.setMarginRight(45);


  const titre = body.appendParagraph("ACADÉMIE IA GÉNÉRATIVE");
  titre.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titre.setFontSize(20);
  titre.setBold(true);

  const sousTitre = body.appendParagraph("FICHE D'INSCRIPTION");
  sousTitre.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  sousTitre.setFontSize(14);
  sousTitre.setBold(true);

  body.appendParagraph("");


  const idPara = body.appendParagraph("ID D'INSCRIPTION : " + idInscription);
  idPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  idPara.setFontSize(16);
  idPara.setBold(true);

  body.appendParagraph("");


  const titreInfos = body.appendParagraph("INFORMATIONS DU CANDIDAT");
  titreInfos.setBold(true);
  titreInfos.setFontSize(13);

  const table = body.appendTable();

  ajouterLigneTableau(table, "Nom et prénom", nomPrenom);
  ajouterLigneTableau(table, "Email", email);
  ajouterLigneTableau(table, "Formation", formation);
  ajouterLigneTableau(table, "Niveau", niveau);
  ajouterLigneTableau(table, "Statut", statut);
  ajouterLigneTableau(table, "ID d'inscription", idInscription);
  ajouterLigneTableau(table, "Date d'inscription", formatDate(new Date()));

  body.appendParagraph("");


  const confirmation = body.appendParagraph("CONFIRMATION");
  confirmation.setBold(true);
  confirmation.setFontSize(13);

  body.appendParagraph(
    "Nous confirmons la réception de votre inscription " +
    "à l'Académie IA Générative."
  );

  body.appendParagraph(
    "Veuillez conserver cette fiche ainsi que votre " +
    "ID d'inscription pour vos futurs échanges avec " +
    "notre équipe."
  );

  body.appendParagraph("");


  const footer = body.appendParagraph("Académie IA Générative");
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  footer.setBold(true);

  const automatique = body.appendParagraph("Document généré automatiquement.");
  automatique.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  automatique.setFontSize(9);


  document.saveAndClose();


  const fichierDocument = DriveApp.getFileById(document.getId());

  const nomFichierPDF =
    "FICHE_" + idInscription + "_" + nettoyerNom(nomPrenom) + ".pdf";

  const pdfBlob =
    fichierDocument.getAs(MimeType.PDF).setName(nomFichierPDF);

  const fichierPDF = dossier.createFile(pdfBlob);

  fichierDocument.setTrashed(true);

  // CORRECTION 5 : on retourne directement l'ID du fichier, obtenu depuis
  // l'objet File lui-même — plus besoin de le ré-extraire de l'URL par regex.
  return {
    url: fichierPDF.getUrl(),
    fileId: fichierPDF.getId()
  };
}


/* =====================================================
   4. AJOUTER UNE LIGNE AU TABLEAU
   ===================================================== */

function ajouterLigneTableau(table, libelle, valeur) {

  const ligne = table.appendTableRow();

  const celluleLibelle = ligne.appendTableCell(libelle);
  const celluleValeur = ligne.appendTableCell(valeur || "");

  celluleLibelle.setBackgroundColor("#E5E7EB");
  celluleLibelle.getChild(0).asParagraph().setBold(true);

  celluleValeur.setBackgroundColor("#FFFFFF");
}


/* =====================================================
   5. FORMATAGE DATE
   ===================================================== */

function formatDate(date) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "dd/MM/yyyy HH:mm"
  );
}


/* =====================================================
   6. NETTOYAGE DU NOM DE FICHIER
   ===================================================== */

function nettoyerNom(nom) {
  return String(nom || "INSCRIT")
    .replace(/[\\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 60);
}


/* =====================================================
   7. CRÉER OU RÉCUPÉRER UNE COLONNE
   ===================================================== */

function getOrCreateColumn(sheet, columnName) {

  let lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    sheet.getRange(1, 1).setValue(columnName);
    return 1;
  }

  const headers =
    sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  const existingColumn = headers.indexOf(columnName) + 1;

  if (existingColumn > 0) {
    return existingColumn;
  }

  const newColumn = lastColumn + 1;

  sheet.getRange(1, newColumn).setValue(columnName);

  return newColumn;
}


/* =====================================================
   7bis. FORMULE HYPERLINK COMPATIBLE TOUTES LOCALES
   ===================================================== */

// CORRECTION 3 : Google Sheets attend "," comme séparateur d'arguments
// dans les locales anglophones, et ";" dans les locales francophones
// (et beaucoup d'autres). On détecte la locale du classeur pour choisir
// le bon séparateur, plutôt que de le figer en dur.
function buildHyperlinkFormula(sheet, url, label) {

  const locale =
    sheet.getParent().getSpreadsheetLocale() || "en_US";

  // Locales connues utilisant la virgule comme séparateur de formule.
  const localesAvecVirgule = ["en_US", "en_GB", "en_CA", "en_AU", "en_IE"];

  const separateur =
    localesAvecVirgule.indexOf(locale) > -1 ? "," : ";";

  const urlEchappee = url.replace(/"/g, '""');
  const labelEchappe = label.replace(/"/g, '""');

  return (
    '=HYPERLINK("' + urlEchappee + '"' +
    separateur +
    '"' + labelEchappe + '")'
  );
}


/* =====================================================
   8. VALIDATION ROBUSTE D'UN ID DE CERTIFICAT
   ===================================================== */

function isValidCertificateId(certificateId) {

  const id =
    String(certificateId || "").trim().toUpperCase();

  const parts = id.split("-");

  /*
   * Format attendu :
   *
   * AIG-N1-2026-1D01930B8FD5
   *
   * 4 parties :
   * AIG
   * Niveau (N1, N2, N3... voir NIVEAUX_CERTIFICAT_VALIDES)
   * année
   * 12 caractères hexadécimaux
   */

  if (parts.length !== 4) {
    return false;
  }

  if (parts[0] !== "AIG") {
    return false;
  }

  // CORRECTION 4 : le niveau n'est plus figé sur "N1" uniquement.
  if (NIVEAUX_CERTIFICAT_VALIDES.indexOf(parts[1]) === -1) {
    return false;
  }

  const year = parts[2];
  const random = parts[3];

  if (year.length !== 4) {
    return false;
  }

  const digits = "0123456789";

  for (let i = 0; i < year.length; i++) {
    if (!digits.includes(year[i])) {
      return false;
    }
  }

  if (random.length !== 12) {
    return false;
  }

  const hex = "0123456789ABCDEF";

  for (let i = 0; i < random.length; i++) {
    if (!hex.includes(random[i])) {
      return false;
    }
  }

  return true;
}


/* =====================================================
   9. API WEB — VÉRIFICATION DES CERTIFICATS (LECTURE SEULE)
   ===================================================== */

// CORRECTION 1 + 2 : doGet ne gère plus QUE la vérification (lecture seule,
// sans danger à exposer publiquement). L'enregistrement ("register") est
// déplacé vers doPost et protégé par un jeton secret — voir plus bas.
function doGet(e) {

  const prefix =
    e && e.parameter && e.parameter.prefix
      ? e.parameter.prefix.trim()
      : "";

  const validPrefix =
    /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(prefix);

  function respond(payload) {

    let json = JSON.stringify(payload);

    json = json
      .replace(/</g, "\\u003C")
      .replace(/>/g, "\\u003E")
      .replace(/&/g, "\\u0026")
      .replace(/'/g, "\\u0027");

    if (validPrefix) {
      return ContentService
        .createTextOutput(prefix + "(" + json + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {

    const action =
      e && e.parameter && e.parameter.action
        ? e.parameter.action.trim().toLowerCase()
        : "verify";

    // L'enregistrement via GET n'est plus autorisé : il faut passer par doPost.
    if (action === "register") {
      return respond({
        success: false,
        message:
          "L'enregistrement d'un certificat doit se faire via une requête POST sécurisée."
      });
    }

    const certificateId =
      e && e.parameter && e.parameter.id
        ? e.parameter.id.trim().toUpperCase()
        : "";

    if (!certificateId) {
      return respond({
        success: false,
        message: "ID de certificat manquant."
      });
    }

    const spreadsheet =
      SpreadsheetApp.openById(CERTIFICATS_SPREADSHEET_ID);

    const sheet =
      spreadsheet.getSheetByName(CERTIFICATS_SHEET_NAME);

    if (!sheet) {
      return respond({
        success: false,
        message: "La feuille Certificats est introuvable."
      });
    }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {

      const currentId =
        String(data[i][0]).trim().toUpperCase();

      if (currentId === certificateId) {
        return respond({
          success: true,
          certificate: {
            id: String(data[i][0]),
            nom: String(data[i][1]),
            formation: String(data[i][2]),
            niveau: String(data[i][3]),
            duree: String(data[i][4]),
            score: String(data[i][5]),
            date: String(data[i][6]),
            statut: String(data[i][7]),
            url: String(data[i][8])
          }
        });
      }
    }

    return respond({
      success: false,
      message: "Certificat introuvable dans le registre officiel."
    });

  } catch (error) {
    return respond({
      success: false,
      message: "Erreur lors de la vérification.",
      error: error.message
    });
  }
}


/* =====================================================
   10. API WEB — ENREGISTREMENT DES CERTIFICATS (SÉCURISÉ)
   ===================================================== */

// CORRECTION 1 + 2 : nouvelle fonction dédiée, appelée uniquement en POST,
// et protégée par un jeton secret comparé côté serveur.
function doPost(e) {

  function respond(payload) {
    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {

    const params =
      (e && e.parameter) || {};

    const action =
      params.action ? String(params.action).trim().toLowerCase() : "";

    if (action !== "register") {
      return respond({
        success: false,
        message: "Action non reconnue pour une requête POST."
      });
    }

    /* ----------------------------------------------
       ID de certificat
       ---------------------------------------------- */

    const certificateId =
      params.id ? String(params.id).trim().toUpperCase() : "";

    if (!certificateId) {
      return respond({
        success: false,
        message: "ID de certificat manquant."
      });
    }

    if (!isValidCertificateId(certificateId)) {
      return respond({
        success: false,
        message: "Format d'ID de certificat invalide."
      });
    }

    const nom = String(params.nom || "").trim();
    const score = String(params.score || "").trim();
    const date = String(params.date || "").trim();
    const url = String(params.url || "").trim();

    if (!nom) {
      return respond({
        success: false,
        message: "Le nom du participant est obligatoire."
      });
    }

    /* ----------------------------------------------
       Google Sheets
       ---------------------------------------------- */

    const spreadsheet =
      SpreadsheetApp.openById(CERTIFICATS_SPREADSHEET_ID);

    const sheet =
      spreadsheet.getSheetByName(CERTIFICATS_SHEET_NAME);

    if (!sheet) {
      return respond({
        success: false,
        message: "La feuille Certificats est introuvable."
      });
    }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {

      const existingId =
        String(data[i][0]).trim().toUpperCase();

      if (existingId === certificateId) {
        return respond({
          success: true,
          alreadyExists: true,
          message: "Certificat déjà enregistré.",
          certificate: {
            id: String(data[i][0]),
            nom: String(data[i][1]),
            formation: String(data[i][2]),
            niveau: String(data[i][3]),
            duree: String(data[i][4]),
            score: String(data[i][5]),
            date: String(data[i][6]),
            statut: String(data[i][7]),
            url: String(data[i][8])
          }
        });
      }
    }

    const formation = "Fondamentaux de l'IA générative";
    const niveau = "N1";
    const duree = "14 heures";
    const statut = "VALIDE";

    sheet.appendRow([
      certificateId,
      nom,
      formation,
      niveau,
      duree,
      score,
      date,
      statut,
      url
    ]);

    return respond({
      success: true,
      alreadyExists: false,
      message: "Certificat enregistré avec succès.",
      certificate: {
        id: certificateId,
        nom: nom,
        formation: formation,
        niveau: niveau,
        duree: duree,
        score: score,
        date: date,
        statut: statut,
        url: url
      }
    });

  } catch (error) {
    return respond({
      success: false,
      message: "Erreur lors de l'enregistrement.",
      error: error.message
    });
  }
}
