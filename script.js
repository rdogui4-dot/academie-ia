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
/* INITIALISATION */
/* ============================= */

document.addEventListener(
    "DOMContentLoaded",
    updateProgress
);
