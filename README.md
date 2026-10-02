# Académie IA Générative

Site vitrine, catalogue et espace apprenant réunis dans le dépôt
[`rdogui4-dot/academie-ia`](https://github.com/rdogui4-dot/academie-ia).

## Accès

| Page | Fonction |
| --- | --- |
| `index.html` | Présentation de l’Académie, expertises et contact |
| `formations.html` | Catalogue, inscription, progression et reprise N1 |
| `espace-apprenant.html` | Redirection vers la page Formations unifiée |
| `formations/n1.html` | Redirection vers le parcours N1 dans Formations |
| `modules/n1-module-1.html` à `n1-module-5.html` | Les cinq modules N1 |
| `modules/quiz-n1.html` | Quiz final du parcours N1 |
| `formations/n1-terminee.html` | Résultat de la formation |
| `formations/certificat-n1.html` | Certificat, impression et QR code |
| `formations/verification-certificat.html` | Vérification d’un certificat |

Les liens du catalogue conduisent au formulaire d’inscription existant. Le
parcours N1 possède les cours en ligne ; les autres parcours disposent de leur
programme et de leur inscription dans le catalogue.

## Structure

- `vitrine.css` : styles de l’accueil et du catalogue.
- `style.css` : mise en page des cours, du quiz et des certificats.
- `assets/brand.css` : charte commune à toutes les pages, chargée en dernier.
- `script.js` : progression commune, reprise, accès et brouillons des modules N1.
- `assets/` : logos et identité visuelle.
- `apps-script/` : backend Google Apps Script existant.
- `tools/` : vérification des liens et des parcours de navigation.
- `docs/FUSION.md` : origine des fichiers et procédure de fusion.
- `docs/AUDIT-REFONTE.md` : diagnostic, changements et limites de la refonte.

Les polices de texte DejaVu Sans sont hébergées dans `assets/fonts/` avec leur
licence. Poppins est chargée via Google Fonts, avec une police locale de repli.
Les logos officiels ont été extraits sans recomposition de la charte fournie.

La progression N1 utilise les clés `localStorage` déjà présentes. Elle se
retrouve dans le même navigateur sur la même origine ; publier sous une autre
adresse change l’origine du stockage. Le chemin du dépôt GitHub Pages
`/academie-ia/` et les chemins des cours et certificats sont conservés.

## Vérifier localement

Depuis la racine du dépôt :

```powershell
python tools/verify.py
node tools/verify-navigation.cjs
python -m http.server 8000
```

Ouvrir ensuite <http://localhost:8000>. Les tests utilisent Python 3 et Node.js,
sans paquet supplémentaire. Les fonctions Google Apps Script nécessitent leur
déploiement existant pour les inscriptions et la vérification des certificats.

## Publier

Le site statique peut rester publié avec GitHub Pages depuis la branche `main`,
dossier `/ (root)`, dans ce dépôt. Aucun processus de compilation n’est requis.
Le code Google Apps Script se déploie séparément dans le projet Google existant.
