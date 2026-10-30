# Nouveaux cours : analyse et ligne directive

Date : 30 octobre 2026. Source analysée : archive `cours_academie.zip` (21 fichiers HTML, extraits sans exécution). Aucun cours n'a encore été importé, supprimé ou publié.

## 1. Ce que contient l'archive

**Manuels (11)** : N1 (26 chapitres), N2 (28), N3 (26), et N4 pour 8 spécialités : autre spécialité, éducation, finance, immobilier, industrie, juridique, marketing, santé.

**Exercices d'entraînement (10)** : N1, N2, N3, et N4 pour 7 spécialités : autre spécialité, finance, immobilier, industrie, marketing, ressources humaines, santé.

**Lacunes**
- Manuel N4 **ressources humaines** : absent.
- Exercices N4 **juridique** et **éducation** : absents.
- La plateforme compte 9 spécialités N4 : il manque donc 1 manuel et 2 exercices.

## 2. Points bloquants

1. **Les exercices sont des corrigés.** Chaque fichier d'exercice contient l'énoncé et la correction (12 à 19 mentions de « corrigé »). Un corrigé ne doit jamais être visible d'un apprenant avant d'avoir répondu, ni publié sur le site.
2. **Les manuels et les corrigés sont de contenu privé.** La règle du projet : ils vivent uniquement dans le stockage privé de Supabase, jamais dans le dépôt Git ni sur GitHub Pages. Le dépôt ne doit donc pas recevoir ce lot.
3. **La structure ne correspond pas à la plateforme.** Les manuels comptent 24 à 28 chapitres. La plateforme actuelle compte 41 étapes (N1 : 8, N2 : 12, N3 : 11, N4 : 10), liées à des pages PDF précises. Il faut recalculer les étapes, les pages et les remises.
4. **Aucun outil ne transforme ces HTML en pages.** Le pipeline existant importe des pages WebP et des textes issus de manuels PDF. Il faut créer une étape de rendu HTML → PDF → pages.
5. **Les anciens cours sont en production avec des données d'apprenants.** Il y a 41 leçons, 98 remises, 182 pages de lecture, 4 examens finaux (70 QCM). La progression des apprenants y est rattachée : supprimer sans précaution efface leur travail.
6. **Les zones de contenu à vérifier** : les manuels contiennent aussi des mentions de « corrigé » (1 à 7 par fichier). Il faut voir si ce sont des corrigés cachés.

## 3. Ligne directive

1. **Privé par défaut.** Manuels, exercices et corrigés sont importés dans le stockage privé. Rien de ce contenu n'entre dans le dépôt.
2. **Séparer énoncé et corrigé.** Chaque exercice est découpé en deux documents : l'énoncé (apprenant) et le corrigé (formateur). Le corrigé n'est accessible qu'après remise, et seulement au formateur ou à l'apprenant selon la règle validée.
3. **Aucune suppression sans sauvegarde et accord écrit.** Avant tout retrait, export complet de la base et du stockage, puis validation par le responsable pédagogique.
4. **Ordre de travail imposé** :
   1. Inventaire et correspondance chapitres ↔ étapes ↔ pages.
   2. Pipeline de rendu des HTML en pages.
   3. Import en brouillon, sans publication.
   4. Relecture pédagogique par niveau (N1, puis N2, N3, N4 par spécialité).
   5. Publication niveau par niveau.
   6. Retrait des anciens cours, seulement après validation de chaque niveau.
5. **Un niveau est complet avant d'être publié** : manuel, exercice, corrigé privé, et toutes les spécialités concernées.
6. **Contrôles automatiques** avant publication : nombre de pages, références des exercices, présence des corrigés hors du fichier apprenant, et tests de cohérence existants.
7. **Parcours** : le parcours est revu après la correspondance des chapitres. Le nombre d'étapes par niveau sera fixé par cette correspondance, pas à l'avance.

## 4. Décisions à prendre

- **Suppression des anciens cours** : autorisée après sauvegarde complète ? (oui / non)
- **Structure du parcours** : recalculer les étapes à partir des chapitres des manuels (recommandé), ou conserver les étapes actuelles et y rattacher les nouveaux chapitres ?
- **Manuel N4 RH et exercices N4 juridique et éducation** : à rédiger, ou à retirer du parcours tant qu'ils n'existent pas ?
- **Mentions « corrigé » dans les manuels** : à retirer des versions publiables, ou à conserver dans le privé ?

## 5. Décisions validées (30 octobre 2026)

1. **Suppression des anciens cours : oui**, après sauvegarde complète et vérifiée. Aucune suppression avant la fin de la sauvegarde.
2. **Parcours : recalculé à partir des chapitres.** Les étapes ne sont plus celles de l'ancien parcours (41 étapes).
3. **Rédaction : uniquement les exercices manquants** (N4 juridique et éducation). Les manuels sont des produits vendus : ils ne sont pas à rédiger et ne sont pas publiés gratuitement sur le site. Le manuel N4 ressources humaines n'est donc pas à produire pour la plateforme.
4. **Corrigés : réservés aux formateurs.** Un apprenant ne voit jamais un corrigé. Le formateur y accède dans l'espace formateur, après la remise de l'apprenant.

## 6. Conséquences et points à confirmer

- **Sauvegarde avant suppression** : base complète (schéma et données) et stockage privé (fichiers). La sauvegarde contient des données personnelles d'apprenants : elle est conservée hors du dépôt, sur un support sécurisé.
- **Manuels vendus** : la plateforme doit-elle quand même donner accès aux chapitres aux apprenants qui ont acheté le manuel ? Hypothèse de travail : oui, le parcours se fait avec le manuel. À confirmer, car elle change la manière de publier les chapitres.
- **Ordre d'exécution** : sauvegarde vérifiée → correspondance chapitres ↔ nouvelles étapes → import en brouillon → relecture → publication niveau par niveau → retrait des anciens cours niveau par niveau.
