# Académie IA Générative — Google Forms + Supabase

Le catalogue public peut rester sur GitHub Pages. Les inscriptions passent toutes par le formulaire Google existant et restent liées à Google Sheets. Supabase protège les supports, synchronise les carnets et porte le registre des nouveaux certificats.

**Version préparée, non déployée.** Aucun compte Supabase, secret, formulaire ou déclencheur distant n'a été modifié ici.

Lire d'abord [le guide d'activation](docs/ACTIVER-SUPABASE-GOOGLE-FORMS.md), puis [l'état des corrections](docs/ETAT-CORRECTIONS.md).

- `assets/config.js` : URL Supabase, clé PUBLIQUE et quatre liens Google Forms préremplis.
- `apps-script/InscriptionSupabase.gs` : ajout au projet du formulaire existant, synchronisation signée, réessais.
- `supabase/` : schéma, RLS, évaluation côté serveur, webhook et tuteur.
- `cours/` : interface apprenant unique, slides, évaluation, certificat.
- `private-content/` : supports du paquet complet, ignorés par Git, à importer dans le bucket privé.
- `build-tools/` : construction du frontend, import privé et protection du registre historique.
- `dist/` : SEUL dossier à publier, généré ; jamais de PDF/PPTX ni de corrigés.
- `docs/archives/` : historique, ne pas utiliser comme instructions de déploiement actuelles.

## Prévisualiser

```sh
python build-tools/build_public.py --preview
python -m http.server 8090 --bind 127.0.0.1 --directory dist
```

Ouvrir http://127.0.0.1:8090. Les cours exigent la configuration Supabase ; l'aperçu sans configuration ne simule pas une inscription réussie.

## Vérifier

```sh
python tools/test-public.py
python tools/verify.py dist
cd tools
npm install --ignore-scripts
npm run test:db
npm run test:edge
```

Les tests PostgreSQL utilisent un moteur local avec les interfaces Auth/Storage représentées pour vérifier les permissions. Les handlers sont testés avec des appels simulés. Les essais de bout en bout dans Google et Supabase restent obligatoires.

## Publier

Configurer le backend, le formulaire et les supports privés avant le site. `python build-tools/build_public.py` bloque les valeurs publiques manquantes. Le workflow GitHub Pages est manuel et ne publie que dist. Le dépôt public et son historique contiennent déjà d'anciens supports ; leur confidentialité passée ne peut pas être rétablie rétroactivement.
