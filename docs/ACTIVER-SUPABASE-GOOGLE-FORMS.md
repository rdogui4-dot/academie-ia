# Activer les inscriptions Google Forms et les parcours Supabase

Cette version remplace le portail Python proposé précédemment. Toutes les inscriptions utilisent le formulaire Google EXISTANT. Supabase gère la connexion, les droits par niveau, les supports privés, le carnet, les projets et les certificats. Google Sheets conserve les réponses via la liaison déjà existante du formulaire.

## 1. Créer le projet Supabase

Créer un projet dédié et conserver ses accès dans les consoles. Relever l'URL du projet et la clé publique « publishable » pour le site. Ne jamais mettre la clé service_role ou le secret du webhook dans assets/config.js, une capture publique ou Git.

Dans SQL Editor, exécuter une seule fois supabase/migrations/202610030001_academy.sql. La migration crée les tables, règles RLS, fonctions et un bucket academy-private PRIVÉ. Elle ne supprime pas d'anciennes données. Une relance manuelle complète s'arrête sur les objets existants ; le suivi des migrations peut ensuite être géré par la CLI.

## 2. Déployer la synchronisation du formulaire

Créer la fonction Edge enrollment-sync avec supabase/functions/enrollment-sync/index.ts, puis désactiver « Verify JWT » pour cette fonction : elle vérifie sa propre signature HMAC. Le fichier supabase/config.toml contient cette configuration pour la CLI. Sans cette configuration, Google ne pourra pas appeler la fonction.

Générer un secret aléatoire d'au moins 32 caractères, par exemple avec :

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Le saisir comme secret ENROLLMENT_WEBHOOK_SECRET de la fonction Supabase. Ne pas le copier dans la conversation. Le même secret sera saisi dans les propriétés du projet Apps Script.

## 3. Corriger le formulaire existant et installer le déclencheur

Ouvrir le formulaire Google, puis son projet Apps Script (lié au FORMULAIRE, pas seulement à la feuille). Ajouter le fichier InscriptionSupabase.gs fourni, sans remplacer les automatisations existantes.

Dans Paramètres du projet > Propriétés du script, ajouter SUPABASE_URL et ENROLLMENT_WEBHOOK_SECRET. Exécuter academyConfigurerFormulaire :

- une copie de sauvegarde du formulaire est créée avant modification ;
- la question existante de formation conserve son identifiant et son titre, afin de préserver autant que possible les automatisations basées sur les noms de champs ;
- ses choix deviennent N1, N2, N3, N4, avec les intitulés officiels ;
- les quatre liens préremplis exacts apparaissent dans le journal d'exécution.

Copier ces liens dans assets/config.js > formLinks. Puis exécuter academyInstallerSynchronisation. Cette fonction ajoute seulement ses deux déclencheurs : soumission et réessai. Elle ne supprime pas les anciens déclencheurs.

Les automatismes existants lisant la VALEUR de la formation (par exemple « Prompt Engineering ») doivent être adaptés aux nouveaux intitulés. Le titre historique de question est volontairement conservé pour éviter une rupture supplémentaire. Tester la confirmation e-mail et la fiche PDF existantes avant publication. Leur code n'est pas présent dans ce dépôt et n'a pas pu être validé.

La soumission arrive dans Sheets et dans Supabase avec le statut pending. Un échec réseau est mis en attente pour réessai ; une réponse historique sans niveau explicite exige une reprise manuelle. Modifier une réponse déjà synchronisée ne modifie pas automatiquement ses droits. Le formateur doit traiter les changements de parcours.

## 4. Configurer la connexion et les formateurs

Dans Supabase Auth, activer Email et configurer Site URL et les redirections autorisées, notamment :

https://rdogui4-dot.github.io/academie-ia/connexion.html
https://rdogui4-dot.github.io/academie-ia/connexion.html**

Vérifier la syntaxe des motifs dans la console et autoriser uniquement votre site. Configurer un SMTP de production et les limites d'envoi : le service d'e-mail de test Supabase n'est pas un service de diffusion général. Le lien magique standard fonctionne ; pour fournir aussi un code, ajouter {{ .Token }} au modèle d'e-mail.

Se connecter d'abord avec l'adresse du formateur. Relever son UUID dans Authentication > Users puis, dans SQL Editor uniquement :

```sql
insert into academy_private.admins(user_id) values ('UUID_DU_FORMATEUR');
```

Ne pas donner le rôle formateur par des métadonnées modifiables par l'utilisateur. La page administration.html vérifie les droits côté base. Elle permet de valider/suspendre une inscription et d'enregistrer les résultats. Une connexion Auth seule ne donne aucun accès aux cours.

## 5. Importer les documents privés

Depuis le dossier du paquet contenant private-content, exécuter :

```powershell
python build-tools/upload_private.py
```

Le script demande l'URL et une clé serveur service_role avec saisie masquée. Cette clé reste dans le processus et n'est pas enregistrée dans les fichiers. Le script importe 20 fichiers : données de cours, corpus du tuteur, manuel, PDF de slides et PowerPoint pour chacun des quatre niveaux. La clé ne doit jamais être partagée.

Vérifier dans Storage que academy-private est PRIVÉ. Le dossier private-content ne doit PAS être ajouté au dépôt public. Les ressources ne sont pas mises dans le frontend dist. Les anciennes copies et l'historique Git publics ne deviennent pas rétroactivement privés.

## 6. Activer le tuteur si souhaité

Déployer la fonction tutor avec Verify JWT désactivé : son code vérifie le jeton utilisateur auprès d'Auth, puis les droits du niveau. Définir OPENAI_API_KEY, TUTOR_MODEL et SITE_ORIGIN=https://rdogui4-dot.github.io (origine, sans /academie-ia). La clé et le modèle ne figurent pas dans le site public. Mettre tutorEnabled:true dans config.js seulement après un essai réel concluant.

Les quotas sont de 30 demandes par utilisateur et 200 au total par jour ; les réservations sont atomiques. Le tuteur cite les pages du niveau et ne délivre aucun certificat. Aucun appel payant réel n'a été effectué pendant la préparation.

## 7. Évaluation et registre historique

N1 : QCM 28/40, projet 42/60. N2 : QCM 21/30, projet 49/70. N3 : QCM 28/40, projet 50/70 ; la note QCM est ramenée à /30 pour le total. N4 : QCM 21/30, projet 50/70. Total minimal 70/100 dans tous les cas.

Le formateur organise et corrige une évaluation supervisée, puis enregistre les notes. Les questions et corrigés fournis dans les manuels sont destinés à l'entraînement ; ce site ne prétend pas offrir une banque d'examen secrète. Un projet doit avoir été remis. Le serveur vérifie les seuils et conserve une copie du texte remis avec l'évaluation. Le QCM historique de dix questions et la génération depuis localStorage ne sont plus utilisés.

Pour fermer l'ancien endpoint de création de certificats sans écraser vos changements Apps Script : exporter le Code.js ACTUEL, puis exécuter :

```powershell
python build-tools/block_legacy_registration.py "CHEMIN\VERS\Code.js"
```

Le script crée une sauvegarde et ajoute un refus au début de doPost. Relire puis remplacer le fichier dans le projet du REGISTRE et redéployer ce projet. Cela désactive tous les POST de ce registre historique ; ne pas l'appliquer au projet d'inscription ou à un script partagé avec d'autres fonctions. Le registre historique GET reste consultable. Tant que l'ancien déploiement n'est pas mis à jour, sa faiblesse reste présente.

## 8. Publier uniquement le frontend généré

Renseigner config.js avec l'URL, la clé publique et les quatre liens exacts, puis :

```powershell
python build-tools/build_public.py
python tools/verify.py dist
```

La construction refuse une configuration incomplète. Dans GitHub Pages, sélectionner la source GitHub Actions, puis lancer manuellement le workflow fourni. Seul dist est publié. Ne PAS sélectionner une publication depuis la racine de la branche : les dossiers de travail ne constituent pas la publication autorisée.

## 9. Vérifications finales obligatoires dans vos comptes

Effectuer une inscription N1–N4 d'essai avec vos propres adresses, vérifier chaque ligne Sheets et la réception Supabase ; valider l'inscription puis se connecter avec la même adresse. Tester un autre niveau non autorisé, un accès direct à un document, la suspension, une remise de projet et un certificat. Vérifier e-mail, PDF d'inscription, tuteur et affichage mobile. Aucune de ces opérations dans vos comptes n'a été exécutée ici.

Les informations administratives de l'organisme, les conditions de vente/annulation et la durée de conservation ne peuvent pas être inventées. Compléter informations.html à partir de vos documents réels avant ouverture commerciale. Les couvertures N1 ont été harmonisées. Les autres contenus sources n’ont pas fait l’objet d’une réécriture technique intégrale.
