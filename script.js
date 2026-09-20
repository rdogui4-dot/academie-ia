const TOTAL_MODULES = 5;


/* ============================= */
/* RÉCUPÉRER LA PROGRESSION */
/* ============================= */

function getProgress() {

    let completedModules = 0;

    for (
        let i = 1;
        i <= TOTAL_MODULES;
        i++
    ) {

        const completed =
            localStorage.getItem(
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

    const progress =
        getProgress();


    const progressFill =
        document.querySelector(
            ".progress-fill"
        );


    const progressText =
        document.querySelector(
            ".progress-text"
        );


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
/* METTRE À JOUR LE MENU */
/* ============================= */

function updateModuleMenu() {

    const modules =
        document.querySelectorAll(
            ".course-menu li"
        );


    modules.forEach(
        (module, index) => {

            const moduleNumber =
                index + 1;


            const completed =
                localStorage.getItem(
                    `n1-module-${moduleNumber}-complete`
                );


            if (
                completed === "true"
            ) {

                module.textContent =
                    `✓ Module ${moduleNumber}`;

            }

        }
    );

}


/* ============================= */
/* TERMINER UN MODULE */
/* ============================= */

function completeModule(
    moduleNumber
) {

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
/* VERROUILLAGE DES MODULES */
/* ============================= */

function checkModuleAccess() {

    const page =
        window.location.pathname;

    const match =
        page.match(/n1-module-(\d+)\.html/);

    if (!match) {
        return;
    }

    const moduleNumber =
        parseInt(match[1]);

    // Le Module 1 est toujours accessible
    if (moduleNumber === 1) {
        return;
    }

    // Vérifier que le module précédent est terminé
    const previousModule =
        moduleNumber - 1;

    const completed =
        localStorage.getItem(
            `n1-module-${previousModule}-complete`
        );

    if (completed !== "true") {

        alert(
            `Vous devez terminer le Module ${previousModule} avant d'accéder à ce module.`
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
