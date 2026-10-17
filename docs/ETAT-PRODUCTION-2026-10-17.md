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

## Dernier contrôle de sécurité Supabase

- L’avis Auth `auth_leaked_password_protection` indique que la protection contre les mots de passe compromis est désactivée. Son activation doit être vérifiée dans les paramètres Auth du projet et selon le forfait disponible.
- Le vérificateur public `academy_verify_certificate(p_id)` est la seule fonction `SECURITY DEFINER` accessible au rôle `anon` relevée par l’avis ; son résultat est limité à l’ID du certificat, au niveau, à la date d’émission et au booléen de validité, comme prévu pour la vérification publique.
- Les 47 fonctions `SECURITY DEFINER` relevées comme accessibles à `authenticated` ne sont pas toutes vulnérables par le seul fait de cet avis : les RPC de correction et de lecture du dossier consultées délèguent les contrôles à `academy_can_review` ou `academy_can_read_dossier`. Une revue complète des 47 corps de fonctions reste nécessaire avant de lever l’avis générique.
- Les quatre tables privées signalées « RLS enabled, no policy » restent en refus d’accès direct par défaut ; les tables sont dans le schéma privé. Les avis d’index FK et de réévaluation des politiques sont des sujets de performance.

## Revue éditoriale privée — 17 octobre 2026

- Contrôle structurel de la banque d’étape : 41 quiz, 287 questions, références et empreintes des corpus N1–N4 cohérentes ; les quiz restent en `editorial_review`.
- Une question exacte sur le ROI, répétée dans le quiz N2 consacré à l’automatisation, a été remplacée dans la copie privée par une question sur la mesure des gains de temps et de qualité. Aucun import ni activation n’a été effectué.
- L’examen visuel du manuel N1, page PDF 6, a révélé une incohérence dans l’exemple de tokenisation : le document annonce trois tokens pour « Bonjour le monde », puis en liste quatre. Corriger la source puis relancer la validation avant d’ouvrir les quiz N1.
- Le validateur technique des examens finaux passe sur les 70 questions, mais la relecture pédagogique indépendante reste requise pour les 287 quiz et les 70 examens.

## Écarts à fermer avant la recette complète

1. Faire relire indépendamment les 287 questions de la banque privée (41 étapes) à partir des corpus N1–N4, corriger les anomalies éditoriales puis décider de la publication. Les tests locaux couvrent l’import idempotent, la correction, les trois tentatives et les seuils ; aucune banque n’est encore publiée ni affectée sur Supabase. Garder les corrigés privés et ne jamais exposer les examens finaux dans le site public.
2. Faire relire indépendamment les 70 QCM d’examen final (20 N1, 15 N2, 20 N3, 15 N4), les publier après validation distincte et piloter les affectations. Les examens restent en `editorial_review`; maintenir la correction humaine des réponses développées et des cas métiers.
3. Un test réel d’inscription a été signalé comme réussi par le responsable du site le 17 octobre 2026 ; le courriel de confirmation et la fiche PDF ont été reçus. Le formulaire comporte le champ obligatoire « Spécialité N4 », une liste déroulante avec huit choix et une option « Sans objet » pour N1–N3 ; ce champ reste non conditionnel. La transmission de la spécialité à `enrollment-sync` reste à confirmer spécifiquement avec une inscription N4. La question « Email » obligatoire double la collecte automatique Google et reste en place jusqu’à vérification des dépendances des déclencheurs et de la feuille de réponses. Ne pas créer de test supplémentaire dans la base de production sans nécessité.
4. Réaliser la recette authentifiée complète : compte confirmé, accès selon niveau, spécialité N4, quiz et remédiation, correction par un formateur affecté, décision de réussite, création et révocation d’un certificat A4 avec scan du QR.
5. Réconcilier le suivi de migrations : le dépôt contient les migrations `202610030001` à `202610030003`, tandis que Supabase ne déclare dans son historique que `20261017115012 security_function_grants`. Ne pas re-jouer les anciennes migrations ni fabriquer un historique ; comparer le schéma réel, produire une baseline documentée, puis tester la restauration.
6. Revoir les 47 alertes de fonctions `SECURITY DEFINER` exécutables par des utilisateurs connectés fonction par fonction. Les alertes sont génériques ; les contrôles d’accès doivent être confirmés sur chaque chemin RPC avant de les supprimer ou de changer leur mode d’exécution. Les 22 index FK signalés sont des améliorations de performance à évaluer, pas des preuves de fuite de données.

## Contrôles encore non réalisés

Un test réel d’inscription a été signalé comme réussi par le responsable du site et le courriel de confirmation ainsi que la fiche PDF ont été reçus. La transmission spécifique de la spécialité N4 reste à documenter. La recette authentifiée d’un apprenant et d’un formateur, la création/révocation d’un certificat, la configuration secrète du tuteur et un appel IA réel restent à vérifier. Le catalogue public visible ne prouve pas à lui seul le bon fonctionnement des parcours authentifiés.

## Références

- Cahier des charges de référence : pièce jointe utilisateur « DEMANDE-ET-FEUILLE-DE-ROUTE-AIG.txt » (version 2, paramètres validés le 4 octobre 2026).
- [Guide d’activation Supabase et Google Forms](./ACTIVER-SUPABASE-GOOGLE-FORMS.md)
- [État des corrections préparées](./ETAT-CORRECTIONS.md)
- [Avis de sécurité Supabase — fonctions SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Avis Supabase — fonctions accessibles sans connexion](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
