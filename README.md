# Académie IA Générative

Le catalogue public est publié sur [GitHub Pages](https://rdogui4-dot.github.io/academie-ia/). Le backend Supabase du compte **rdogui4-dot**, projet **Academie** (`feryogknkzewcaazeoax`), est actif. La mise en service pédagogique reste partielle : les banques de quiz/examen et la recette Google Forms → Supabase ne sont pas terminées.

## État vérifié

Consulter [l’état de production du 17 octobre 2026](docs/ETAT-PRODUCTION-2026-10-17.md) avant toute opération. Il distingue ce qui est observé dans le projet réel des travaux encore nécessaires.

- `assets/config.js` contient l’URL Supabase, la clé publique et les liens d’inscription ; aucune clé serveur ne doit se trouver dans le frontend.
- `apps-script/InscriptionSupabase.gs` prépare la synchronisation du formulaire existant ; son installation et le parcours complet restent à vérifier dans Google.
- `supabase/` contient le schéma, les migrations versionnées et le code source des fonctions Edge suivies dans le dépôt.
- `cours/` contient l’interface apprenant ; les fichiers de cours du stockage restent privés.
- `private-content/` est ignoré par Git. Ne jamais publier les supports ou corrigés confidentiels.
- `dist/` est le seul répertoire généré pour GitHub Pages ; vérifier son contenu avant publication.
- `docs/ETAT-CORRECTIONS.md` et les audits datés sont des rapports historiques, pas une description à jour du service.

## Développement local

```sh
python build-tools/build_public.py --preview
python -m http.server 8090 --bind 127.0.0.1 --directory dist
```

Vérifications du frontend et des fonctions :

```sh
python tools/test-public.py
python tools/verify.py dist
cd tools
npm install --ignore-scripts
npm run test:db
npm run test:edge
```

Les tests locaux ne remplacent pas la recette authentifiée en production. Ne rejouez pas une migration ancienne sur le projet actif ; consultez d’abord le rapport d’état et réconciliez l’historique avec le schéma réel.
