# État de production — 17 octobre 2026

## Décision de mise en service

Le catalogue public est publié sur [GitHub Pages](https://rdogui4-dot.github.io/academie-ia/). Le projet Supabase **Academie** (`feryogknkzewcaazeoax`) est actif et relié au compte `rdogui4-dot`. Le backend de formation est partiellement activé, mais la plateforme pédagogique complète ne doit pas encore être annoncée comme pleinement opérationnelle : les banques de quiz et d’examen sont vides et le parcours réel Google Forms → Supabase n’a pas été validé de bout en bout.

## Éléments constatés

- Les fonctions Supabase `enrollment-sync` (v8), `tutor` (v2) et `certificate-pdf` (v1) sont actives. `verify_jwt=false` est compensé par une validation explicite dans chaque fonction concernée. Les clés serveur ne sont pas lues ni exposées dans ce rapport.
- Le stockage `academy-private` est privé et contient 422 objets. `academy-certificates` est privé et vide : aucun certificat réel n’a encore été archivé.
- Les 3 profils existants ont un IUID au format `AIG-11 caractères-année`. Aucun certificat n’a encore été émis ; l’affichage du certificat n’a donc pas pu être vérifié sur un résultat réel.
- Le rendu PDF est dimensionné à 841,89 × 595,28 points (A4 paysage) ; il porte le nom, l’IUID et, au N4, la spécialité. La vérification publique renvoie seulement le numéro, le niveau, la date et l’état de validité.
- Les huit spécialités N4 sont présentes. La base contient 22 guides de correction : deux pour chaque guide générique N1–N3 et deux pour chacune des huit spécialités N4.
- Les tables de versions et d’affectations de quiz/examen, ainsi que les affectations de cas, contiennent actuellement zéro entrée. Il n’y a donc ni quiz d’étape distribuable ni examen final disponible dans le parcours.
- Les tables du schéma `academy_private` n’accordent ni usage du schéma ni droits de table aux rôles `anon` et `authenticated`. Les fonctions `SECURITY DEFINER` sont l’interface contrôlée prévue pour ces données.
- La migration `security_function_grants` retire l’exécution anonyme de `academy_has_access`, `academy_is_admin`, `academy_set_enrollment` et `academy_tutor_quota`, tout en la conservant pour les utilisateurs connectés. La vérification de certificat reste publique par conception. Les définitions des fonctions de correction vérifiées délèguent l’autorisation à `academy_can_review`.

## Écarts à fermer avant la recette complète

1. Rédiger, tester et faire relire les quiz à partir des manuels : le cahier de charge prévoit cinq QCM et deux questions courtes par étape comme modèle, soit jusqu’à 287 questions pour 41 étapes, à adapter aux étapes courtes. Publier les versions et affectations par niveau ; ne pas transformer les questions-réponses visibles dans les manuels en examen confidentiel.
2. Créer et faire valider les examens finaux ainsi que les plans d’affectation des cas. Maintenir la correction humaine pour les réponses développées et les cas métiers.
3. Vérifier dans Google le formulaire existant, le script de synchronisation, les liens d’inscription N1–N4 et la confirmation e-mail/PDF. L’éditeur du formulaire indique que Google collecte déjà l’adresse e-mail automatiquement, alors qu’une question « Email » obligatoire la redemande ; aucune question de spécialité N4 n’est présente. Le profil apprenant propose ce choix seulement après activation de l’inscription. Le script de synchronisation préparé en dépôt n’envoie que niveau/nom/e-mail, même si la fonction Edge sait accepter une spécialité. Avant de modifier le formulaire en production, vérifier ses déclencheurs et automatisations existants, sauvegarder le formulaire et adapter ensemble le script, les liens N4 et la synchronisation. Aucun test réel du flux de soumission n’est consigné ici.
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
