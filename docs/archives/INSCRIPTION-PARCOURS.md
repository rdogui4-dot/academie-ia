# Inscription et parcours — contrôle du 3 octobre 2026

## Constats sur l'inscription actuelle

Le formulaire public a été lu sans soumettre de réponse. Son titre est « INSCRIPTON FORMATION ACADEMIE IA GENERATIVE ». Les champs sont Nom, Prenoms, Email, Numero whatsap, QUELLES FORMATIONS VOUS INTERESSE?, NIVEAU ACTUEL et PROFESSION. « FORMATION CHOISIE » est un titre de section, pas une question renseignable.

Les trois choix de formation sont Prompt Engineering, Éthique de l’IA et Formation sur mesure. Aucun choix N1, N2, N3 ou N4 n'est défini. Les boutons du site ouvraient tous ce formulaire sans transmettre le niveau.

La question « NIVEAU ACTUEL » décrit l'expérience préalable du candidat, pas le parcours auquel il s'inscrit. Elle ne peut pas servir d'autorisation N1/N2/N3/N4. Les champs Nom et Prenoms sont séparés : vérifier les clés lues par toute automatisation qui attendrait « Nom et prénom ». Les e-mails automatiques existants n'ont pas été testés ou modifiés.

## Parcours prévu et préparé

Accueil N1 → description N1 → Je m'inscris au N1 → demande N1 enregistrée → validation de l'inscription → code N1 → cours N1.
Même correspondance pour N2, N3 et N4. Aucun tarif n'est affiché dans le catalogue. L'inscription à un niveau n'exige pas automatiquement de terminer le niveau précédent : les prérequis annoncés restent à examiner par l'équipe pédagogique.

Le choix « validation par l'Académie » permet de vérifier l'identité du destinataire et les prérequis avant de transmettre un code. Cliquer sur « Je m'inscris » ou envoyer une demande ne déverrouille pas un parcours.

Le serveur refuse l'accès aux cours historiques, lecteurs, données des slides et PDF/PPTX sans session autorisée. Un code N1 ne donne pas accès à N2–N4. Le code JavaScript ne décide pas de l'autorisation. La vérification publique des anciens certificats reste accessible.

## État réel

Modifications préparées et testées localement uniquement. Pas de déploiement ni de migration des inscriptions Google. Le nouveau formulaire enregistre les demandes dans la base privée du portail. Il n'est pas connecté à Google Sheets et ne déclenche pas les anciens e-mails ni fiches PDF. Le README du serveur décrit l'exploitation et ces limites.

L'hébergement GitHub Pages actuel est statique. Il faut un serveur pour appliquer ce contrôle aux fichiers. Ne pas pousser simplement ce dossier sur GitHub Pages : cela n'activerait pas les inscriptions. Le formulaire se désactive sans serveur et les anciennes copies des cours resteraient publiques.

La migration doit inclure le domaine du portail, le stockage persistant, HTTPS, la transmission des codes, la sauvegarde des inscriptions et le retrait des anciennes copies publiques. Les contenus déjà téléchargés ou présents dans l'historique Git ne deviennent pas rétroactivement privés. Aucune suppression d'historique n'a été effectuée.

## Hors périmètre de cette correction

La chaîne d'évaluation/certification, l'unification pédagogique complète des anciens modules et l'activation du tuteur IA restent les points de l'audit précédent. Un accès validé n'est pas une certification. Les tarifs éventuels intégrés aux anciens documents sources ou à des plateformes externes ne sont pas modifiés par le retrait des prix du catalogue web.
