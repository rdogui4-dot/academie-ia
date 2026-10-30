/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_URL =
    "https://script.google.com/macros/s/AKfycbzKWXJK2w8Whm4MzYw4qrfPxZO6o6fWAZv9Pphpa27AUbq1_6Sqy0SKLTJmBZXB4l1l/exec";


/* =========================================================
   ÉLÉMENTS
   ========================================================= */

const params =
    new URLSearchParams(
        window.location.search
    );

const id =
    (params.get("id") || "")
        .trim()
        .toUpperCase();

const card =
    document.getElementById(
        "verificationCard"
    );

const icon =
    document.getElementById(
        "verifyIcon"
    );

const status =
    document.getElementById(
        "verifyStatus"
    );

const verifyId =
    document.getElementById(
        "verifyId"
    );

const note =
    document.getElementById(
        "verifyNote"
    );

const verifyData =
    document.getElementById(
        "verifyData"
    );


/* =========================================================
   AFFICHER L'ID
   ========================================================= */

verifyId.textContent =
    id || "Aucun identifiant fourni";


/* =========================================================
   CALLBACK JSONP
   ========================================================= */

function recevoirVerification(data) {

    if (!data || !data.success) {

        card.classList.add("invalid");

        icon.textContent = "⚠️";

        status.textContent =
            "Certificat introuvable";

        note.textContent =
            data && data.message
                ? data.message
                : "Aucun certificat correspondant à cet identifiant n'a été trouvé dans le registre officiel.";

        return;

    }


    const certificate =
        data.certificate || {};


    if (
        String(certificate.statut || "")
            .toUpperCase() !== "VALIDE"
    ) {

        card.classList.add("invalid");

        icon.textContent = "⚠️";

        status.textContent =
            "Certificat non valide";

        note.textContent =
            "Le certificat existe dans le registre, mais son statut n'est pas VALIDE.";

    } else {

        card.classList.add("valid");

        icon.textContent = "✅";

        status.textContent =
            "Certificat authentifié";

        note.textContent =
            "Ce certificat a été retrouvé dans le registre officiel de l'Académie IA Générative.";

    }


    document.getElementById("dataNiveau").textContent =
        certificate.niveau || "—";

    document.getElementById("dataDate").textContent =
        formatDate(certificate.date);

    document.getElementById("dataStatut").textContent =
        certificate.statut || "—";


    verifyData.style.display =
        "block";

}


/* =========================================================
   FORMATAGE DATE
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    return String(value);

}


/* =========================================================
   VALIDATION DE L'ID
   ========================================================= */

const validId =
    /^AIG-N1-20\d{2}-[A-F0-9]{12}$/i
        .test(id);


if (!id) {

    card.classList.add("invalid");

    icon.textContent = "⚠️";

    status.textContent =
        "Identifiant manquant";

    note.textContent =
        "Aucun identifiant de certificat n'a été transmis dans l'adresse de vérification.";

} else if (!validId) {

    card.classList.add("invalid");

    icon.textContent = "⚠️";

    status.textContent =
        "Identifiant invalide";

    note.textContent =
        "Le format de l'identifiant ne correspond pas à celui d'un certificat N1.";

} else {

    /* =====================================================
       APPEL JSONP VERS APPS SCRIPT
       ===================================================== */

    const script =
        document.createElement("script");

    const callbackName =
        "recevoirVerification";

    script.src =
        API_URL +
        "?id=" +
        encodeURIComponent(id) +
        "&prefix=" +
        encodeURIComponent(callbackName);

    script.onerror =
        function () {

            card.classList.add("error");

            icon.textContent = "⚠️";

            status.textContent =
                "Service de vérification indisponible";

            note.textContent =
                "Impossible de contacter le registre officiel. Réessayez plus tard.";

        };

    document.body.appendChild(script);

}
