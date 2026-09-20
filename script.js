function completeLesson() {

    localStorage.setItem(
        "n1-module-1-complete",
        "true"
    );

    updateProgress();

    alert(
        "Bravo ! Le Module 1 est terminé."
    );
}


function updateProgress() {

    const completed =
        localStorage.getItem(
            "n1-module-1-complete"
        );

    const progressFill =
        document.querySelector(
            ".progress-fill"
        );

    const progressText =
        document.querySelector(
            ".progress-text"
        );

    const moduleStatus =
        document.querySelector(
            ".course-menu li.active"
        );


    if (completed === "true") {

        progressFill.style.width = "20%";

        progressText.textContent =
            "Progression : 20 %";

        moduleStatus.textContent =
            "✓ Module 1 — Bienvenue";

    }

}


document.addEventListener(
    "DOMContentLoaded",
    updateProgress
);
