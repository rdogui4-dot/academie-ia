const TOTAL_MODULES = 5;


/* ============================= */
/* RÉCUPÉRER LA PROGRESSION */
/* ============================= */

function getProgress() {

    let completedModules = 0;

    for (let i = 1; i <= TOTAL_MODULES; i++) {

        const completed = localStorage.getItem(
            `n1-module-${i}-complete`
        );

        if (completed === "true") {
            completedModules++;
        }
    }

    return Math.round(
        (completedModules / TOTAL_MODULES) * 100
    );
}


/* ============================= */
/* AFFICHER LA PROGRESSION */
/* ============================= */

function updateProgress() {

    const progress = getProgress();

    const progressFill =
        document.querySelector(".progress-fill");

    const progressText =
        document.querySelector(".progress-text");


    if (progressFill) {

        progressFill.style.width =
            `${progress}%`;
    }


    if (progressText) {

        progressText.textContent =
            `Progression : ${progress} %`;
    }


    updateModuleMenu();
}


/* ============================= */
/* MENU DES MODULES */
/* ============================= */

function updateModuleMenu() {

    const modules =
        document.querySelectorAll(".course-menu li");


    modules.forEach((module, index) => {

        const moduleNumber = index + 1;


        const completed =
            localStorage.getItem(
                `n1-module-${moduleNumber}-complete`
            );


        const previousCompleted =
            moduleNumber === 1 ||
            localStorage.getItem(
                `n1-module-${moduleNumber - 1}-complete`
            ) === "true";


        /* MODULE TERMINÉ */

        if (completed === "true") {

            module.textContent =
                `✓ Module ${moduleNumber}`;

            module.classList.add("completed");

            module.classList.remove("locked");

            return;
        }


        /* MODULE ACCESSIBLE */

        if (previousCompleted) {

            module.textContent =
                `🔓 Module ${moduleNumber}`;

            module.classList.remove("locked");

            return;
        }


        /* MODULE VERROUILLÉ */

        module.textContent =
            `🔒 Module ${moduleNumber}`;

        module.classList.add("locked");

    });

}


/* ============================= */
/* TERMINER UN MODULE */
/* ============================= */

function completeModule(moduleNumber) {

    localStorage.setItem(
        `n1-module-${moduleNumber}-complete`,
        "true"
    );


    updateProgress();


    alert(
        `Bravo ! Le Module ${moduleNumber} est terminé.`
    );
}


/* ============================= */
/* VÉRIFIER L'ACCÈS AU MODULE */
/* ============================= */

function checkModuleAccess() {

    const currentPage =
        window.location.pathname;


    /* ============================= */
    /* VÉRIFIER L'ACCÈS AU QUIZ */
    /* ============================= */

    if (currentPage.endsWith("quiz-n1.html")) {

        const allModulesCompleted =
            getProgress() === 100;


        if (!allModulesCompleted) {

            alert(
                "🔒 Vous devez terminer les 5 modules avant d'accéder au quiz final."
            );


            window.location.href =
                "n1-module-1.html";

            return;
        }

        return;
    }


    /* ============================= */
    /* VÉRIFIER L'ACCÈS AUX MODULES */
    /* ============================= */

    const match =
        currentPage.match(
            /n1-module-(\d+)\.html$/
        );


    if (!match) {
        return;
    }


    const moduleNumber =
        parseInt(match[1], 10);


    if (moduleNumber === 1) {
        return;
    }


    const previousModule =
        moduleNumber - 1;


    const previousCompleted =
        localStorage.getItem(
            `n1-module-${previousModule}-complete`
        );


    if (previousCompleted !== "true") {

        alert(
            `🔒 Vous devez terminer le Module ${previousModule} avant d'accéder au Module ${moduleNumber}.`
        );


        window.location.href =
            `n1-module-${previousModule}.html`;
    }

}


/* ============================= */
/* INITIALISATION */
/* ============================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateProgress();

        checkModuleAccess();

    }
);
