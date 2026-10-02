/* Les mêmes clés et les mêmes URL que le parcours N1 existant. */
document.addEventListener("DOMContentLoaded", function () {
    const resumeLink = document.getElementById("resume-course");
    const progressText = document.getElementById("portal-progress-text");
    const progressBar = document.getElementById("portal-progress-bar");
    const progressFill = document.getElementById("portal-progress-fill");

    if (!resumeLink || !progressText || !progressBar || !progressFill) {
        return;
    }

    try {
        const completed = Array.from({ length: 5 }, function (_, index) {
            return localStorage.getItem(`n1-module-${index + 1}-complete`) === "true";
        });
        const count = completed.filter(Boolean).length;
        const percent = count * 20;

        progressText.textContent = `N1 : ${count} module${count === 1 ? "" : "s"} terminé${count === 1 ? "" : "s"} sur 5 — ${percent} %`;
        progressFill.style.width = `${percent}%`;
        progressBar.setAttribute("aria-valuenow", String(percent));

        const nextModule = completed.indexOf(false) + 1;

        if (nextModule > 0) {
            resumeLink.href = `modules/n1-module-${nextModule}.html`;
            resumeLink.textContent = count === 0
                ? "Commencer le module 1"
                : `Reprendre le module ${nextModule}`;
        } else if (localStorage.getItem("n1-quiz-passed") === "true") {
            resumeLink.href = "formations/n1-terminee.html";
            resumeLink.textContent = "Voir ma réussite et mon certificat";
        } else {
            resumeLink.href = "modules/quiz-n1.html";
            resumeLink.textContent = "Passer le quiz final";
        }
    } catch {
        progressText.textContent = "Le suivi de progression nécessite le stockage local de votre navigateur.";
    }
});
