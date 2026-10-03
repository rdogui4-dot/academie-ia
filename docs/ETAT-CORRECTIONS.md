# État des corrections — 3 octobre 2026

Le paquet corrige le code et prépare la migration. Il n'est pas activé dans les comptes de l'utilisateur. Il ne faut pas confondre correction préparée et fonctionnalité disponible sur le site public.

| Irrégularité | Correction préparée | Reste à faire pour l'activation |
|---|---|---|
| Inscriptions sans lien avec N1–N4 | Tous les CTA reviennent au formulaire Google ; le script conserve la question et produit quatre liens préremplis exacts | Exécuter le script dans le formulaire ; renseigner les liens ; vérifier e-mails et PDF existants |
| Prix affichés | Montants retirés du catalogue web | Publier le frontend généré ; aucune modification des plateformes externes |
| Accès public aux cours | Bucket privé et RLS par niveau ; aucun support dans dist | Importer les fichiers ; configurer Supabase ; retirer les anciennes copies publiques de la publication |
| Deux N1 indépendants | Un parcours N1 de huit étapes ; anciens liens redirigés | Les anciennes lectures ne sont pas converties en certification ; import explicite des brouillons disponible |
| Critères d'évaluation contradictoires | Barèmes propres aux quatre niveaux, QCM supervisé et projet requis ; N3 normalisé sur 100 | Organiser les sessions et habiliter les formateurs ; pas de nouvelle banque d'examen confidentielle livrée |
| Certificat basé sur localStorage | Évaluation réservée aux formateurs ; seuils vérifiés en SQL ; registre, révocation, copie du projet et journal des décisions | Exécuter la migration ; fermer l'ancien POST du registre Apps Script avec sauvegarde puis redéployer |
| Objectifs et exercices génériques | 41 activités distinctes avec objectif observable, livrable et critères | Relecture pédagogique par le responsable de formation |
| Slides absentes du site public | 144 slides et téléchargements reliés au stockage privé | Importer 20 fichiers et publier l'interface |
| Tuteur désactivé | Fonction Edge avec identité, droits du niveau, corpus, citations et quotas persistants | Configurer modèle et clé côté serveur ; faire un essai réel ; activer tutorEnabled |
| Carnet limité à un appareil | Carnet et progression synchronisés par compte avec RLS | Activer Auth et SMTP ; l'ancien brouillon local n'est importé que sur demande de l'apprenant |
| Intitulés différents | Intitulé officiel N1 repris dans le catalogue, le parcours, le certificat et les couvertures du manuel PDF, des slides PDF et du PowerPoint ; nom de l’Académie corrigé sur la couverture du manuel | La révision technique intégrale des documents sources reste distincte de ces corrections ciblées |
| Tests obsolètes | Remplacés par tests du frontend, de PostgreSQL/RLS et des handlers Edge | Tests réels Google Forms → Sheets → Supabase → accès et certificat |
| Charte et métadonnées incomplètes | Police Poppins locale, favicons, descriptions, liens canoniques, sitemap, pages privées non indexées | Contrôle visuel desktop/mobile non effectué : téléchargement du navigateur de test défaillant |
| Informations de transparence absentes | Page informations : parcours, données, évaluation, contact, absence de paiement sur le site | Compléter l'identification administrative, les conditions contractuelles et la conservation à partir des documents réels de l'organisme |

## Tests effectués

- 13 scénarios exécutés sur PostgreSQL local PGlite : attente, activation, isolation des niveaux et utilisateurs, refus d'auto-activation/auto-évaluation, remise obligatoire, seuils des quatre niveaux, vérification publique minimale, correction/révocation et quotas.
- 7 contrôles du frontend : liens d'inscription, quatre niveaux, absence de supports privés dans dist, suppression des anciens parcours concurrents, 41 activités distinctes, charte/métadonnées et refus de publication non configurée.
- Vérification des handlers webhook/tuteur avec requêtes locales et fournisseur IA simulé : HMAC, horodatage, corps altéré, identité, origine, niveau, quota et corpus isolé.
- Couverture N1 corrigée dans les PDF et le PowerPoint ; 32 slides rendues, sans changement de rendu des 31 autres slides.
- Fonctions Edge compilées en TypeScript strict avec le SDK Supabase 2.117.2.
- 22 pages HTML et 255 liens locaux vérifiés lors du contrôle du frontend ; les contrôles ultérieurs peuvent faire évoluer ce compteur.

Aucun e-mail, formulaire, paiement, appel IA facturé ou certificat réel n'a été envoyé/créé lors de ces tests. Aucune modification des projets Google/Supabase ni publication GitHub n'a été effectuée.

## Limites à ne pas masquer

Les informations administratives et contractuelles manquantes ne sont pas inventées. La banque d'examen supervisé doit être définie par le formateur ; les QCM corrigés des manuels sont des supports de révision. Les couvertures N1 ont été harmonisées et contrôlées visuellement. Une révision technique intégrale des documents originaux reste distincte de cette correction du site. Le comportement visuel et les automatismes e-mail/PDF existants restent à vérifier dans les comptes réels.
