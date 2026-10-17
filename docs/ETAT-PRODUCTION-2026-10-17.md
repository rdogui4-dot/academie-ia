# État de production — 17 octobre 2026

## Décision de mise en service

Le catalogue public est publié sur [GitHub Pages](https://rdogui4-dot.github.io/academie-ia/). Le projet Supabase **Academie** (`feryogknkzewcaazeoax`) est actif et relié au compte `rdogui4-dot`. Le backend est partiellement activé : les examens finaux sont importés en brouillons privés, les quiz d’étape restent non publiés, et le parcours réel Google Forms → Supabase n’a pas été validé de bout en bout. La plateforme pédagogique ne doit donc pas encore être annoncée comme pleinement opérationnelle.

## Éléments constatés

- Les fonctions Supabase `enrollment-sync` (v8), `tutor` (v2) et `certificate-pdf` (v1) sont actives. `verify_jwt=false` est compensé par une validation explicite dans chaque fonction concernée. Les clés serveur ne sont pas lues ni exposées dans ce rapport.
- Le stockage `academy-private` est privé et contient 422 objets. `academy-certificates` est privé et vide : aucun certificat réel n’a encore été archivé.
- Les 3 profils existants ont un IUID au format `AIG-11 caractères-année`. Aucun certificat n’a encore été émis ; l’affichage du certificat n’a donc pas pu être vérifié sur un résultat réel.
- Le déploiement Apps Script « Quiz N1 serveur - test », auparavant ouvert à tout le monde, a été archivé ; les routes historiques `startquizn1`, `statusquizn1` et `submitquizn1` du déploiement du registre répondent désormais par un refus explicite. Le déploiement du registre reste actif pour la compatibilité des vérifications historiques. Sa version 16, publiée le 17 octobre 2026, renvoie uniquement l’identifiant, le niveau, la date et le statut ; aucun nom, score, durée ni lien de document n’est exposé. Un appel avec un faux identifiant confirme le refus d’un quiz et l’absence de correspondance sans consulter un dossier réel.
- Le rendu PDF est dimensionné à 841,89 × 595,28 points (A4 paysage) ; il porte le nom, l’IUID et, au N4, la spécialité. La vérification publique renvoie seulement le numéro, le niveau, la date et l’état de validité.
- Les huit spécialités N4 sont présentes. La base contient 22 guides de correction : deux pour chaque guide générique N1–N3 et deux pour chacune des huit spécialités N4.
- Les banques de quiz ne sont pas encore publiées. Les quatre examens finaux sont présents comme brouillons privés (`published_at` nul), totalisant 70 questions ; aucun examen n’est affecté à un apprenant. Les tables d’affectations de quiz/examen et de cas restent vides, donc aucun quiz ni examen n’est actuellement distribuable dans les parcours.
- La bibliothèque privée contient le corpus N1–N4, 41 quiz d’étape (287 questions) et quatre examens finaux (70 QCM). La validation de provenance/structure et la simulation PostgreSQL locale passent avec données fictives. Les 70 QCM d’examen ont été chargés sur Supabase par `academy_draft_exam` en quatre brouillons privés, sans publication ni affectation. Les 287 quiz restent non publiés et non importés. Toutes ces questions sont en `editorial_review` : les tests techniques ne remplacent pas la relecture pédagogique indépendante.
- Les tables du schéma `academy_private` n’accordent ni usage du schéma ni droits de table aux rôles `anon` et `authenticated`. Les fonctions `SECURITY DEFINER` sont l’interface contrôlée prévue pour ces données.
- La migration `security_function_grants` retire l’exécution anonyme de `academy_has_access`, `academy_is_admin`, `academy_set_enrollment` et `academy_tutor_quota`, tout en la conservant pour les utilisateurs connectés. La vérification de certificat reste publique par conception. Les définitions des fonctions de correction vérifiées délèguent l’autorisation à `academy_can_review`.

## Écarts à fermer avant la recette complète

1. Faire relire indépendamment les 287 questions de la banque privée (41 étapes) à partir des corpus N1–N4, corriger les anomalies éditoriales puis décider de la publication. Les tests locaux couvrent l’import idempotent, la correction, les trois tentatives et les seuils ; aucune banque n’est encore publiée ni affectée sur Supabase. Garder les corrigés privés et ne jamais exposer les examens finaux dans le site public.
2. Faire relire indépendamment les 70 QCM d’examen final (20 N1, 15 N2, 20 N3, 15 N4), les publier après validation distincte et piloter les affectations. Les examens restent en `editorial_review`; maintenir la correction humaine des réponses développées et des cas métiers.
3. Vérifier le script de synchronisation, les liens N1–N4 et la confirmation e-mail/PDF. Le formulaire comporte maintenant le champ obligatoire « Spécialité N4 », sous forme de liste déroulante avec huit choix et une option « Sans objet » pour N1–N3. Le champ n’est pas conditionnel : les candidats N1–N3 doivent eux aussi choisir « Sans objet ». Le script lié `InscriptionSupabase` a exécuté `academyConfigurerFormulaire` sans erreur après l’ajout du champ, mais aucun essai de soumission n’a été fait en production ; la transmission de la spécialité à `enrollment-sync` reste à certifier en recette. Ne pas créer de fausse inscription dans la base de production. La question « Email » obligatoire double la collecte automatique Google et reste en place jusqu’à vérification des dépendances des déclencheurs et de la feuille de réponses. Contrôler aussi la confirmation e-mail/PDF.
4. Réaliser la recette authentifiée complète : compte confirmé, accès selon niveau, spécialité N4, quiz et remédiation, correction par un formateur affecté, décision de réussite, création et révocation d’un certificat A4 avec scan du QR.
5. Réconcilier le suivi de migrations : le dépôt contient les migrations `202610030001` à `202610030003`, tandis que Supabase ne déclare dans son historique que `20261017115012 security_function_grants`. Ne pas re-jouer les anciennes migrations ni fabriquer un historique ; comparer le schéma réel, produire une baseline documentée, puis tester la restauration.
6. Revoir les 47 alertes de fonctions `SECURITY DEFINER` exécutables par des utilisateurs connectés fonction par fonction. Les alertes sont génériques ; les contrôles d’accès doivent être confirmés sur chaque chemin RPC avant de les supprimer ou de changer leur mode d’exécution. Les 22 index FK signalés sont des améliorations de performance à évaluer, pas des preuves de fuite de données.

## Contrôles encore non réalisés

Aucun essai avec un vrai apprenant/formateur et aucune création ou révocation réelle de certificat n’ont été faits lors de cet audit. La configuration secrète du tuteur, un appel IA réel et la chaîne Google Forms → Sheets → Supabase n’ont pas été certifiés. Le catalogue public visible ne prouve pas à lui seul le bon fonctionnement des parcours authentifiés.

## Références

- Cahier des charges de référence : pièce jointe utilisateur « DEMANDE-ET-FEUILLE-DE-ROUTE-AIG.txt » (version 2, paramètres validés le 4 octobre 2026).
- [Guide d’activation Supabase et Google Forms](./ACTIVER-SUPABASE-GOOGLE-FORMS.md)
- [État des corrections préparées](./ETAT-CORRECTIONS.md)
- [Avis de sécurité Supabase — fonctions SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Avis Supabase — fonctions accessibles sans connexion](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
