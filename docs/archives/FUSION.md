# Fusion des deux dépôts

## Sources au 2 octobre 2026

| Dépôt | Commit utilisé | Apport |
| --- | --- | --- |
| `rdogui4-dot/academie-ia` | `0b68d8293f380dd056a1db076e944b3c082968b3` | Modules, quiz, progression, certificats, logos et Apps Script |
| `rdogui4-dot/academie-ia-generative` | `8c7752062b9a92dc16be1a3cf40224ca29c7a58e` | Accueil vitrine et catalogue des quatre parcours |

La branche `fusion/academie-ia-generative` contient un commit de fusion dont les
deux parents sont ces commits. Les historiques originaux et leurs auteurs sont
conservés.

## Choix d’intégration

1. Le dépôt de destination est `academie-ia`, afin de conserver l’adresse des
   cours et les liens de vérification déjà générés.
2. L’accueil vitrine occupe `index.html` et le catalogue `formations.html`.
   L’ancien point d’entrée du LMS devient `espace-apprenant.html`, avec une
   interface de reprise du parcours N1.
3. Le CSS vitrine est renommé `vitrine.css`. Le fichier `style.css` du LMS est
   conservé ; les pages de cours reçoivent une feuille complémentaire
   pour leur navigation, notamment sur mobile.
4. Les tarifs N1, N2 et N3 proviennent de l’ancien accueil LMS : 50 000,
   120 000 et 250 000 FCFA. Le titre N1 correspond désormais au cours réel,
   « Fondamentaux de l’IA générative ».
5. Le parcours N4 conserve la durée recommandée de 25 heures du catalogue
   source. Aucun tarif N4 n’est ajouté : les fichiers de la vitrine
   source n’en indiquaient pas.
6. Le contact WhatsApp est aligné sur celui déjà utilisé dans Apps Script :
   `+225 05 44 16 54 18`. Le formulaire d’inscription existant est conservé.
7. Les URL des modules et des certificats, les clés de progression, les scripts
   de quiz et certificat et le backend Apps Script sont conservés.
8. L’ancre `index.html#formations` reste disponible. Des liens entre accueil,
   catalogue, espace apprenant et cours sont ajoutés.

## Appliquer l’archive de livraison

L’archive `academie-ia-unifie.zip` comprend :

- `projet/` : tous les fichiers du projet assemblé ;
- `fusion-historiques.bundle` : branche de fusion et les deux historiques Git ;
- `APPLIQUER-FUSION.ps1` : application et envoi au dépôt `academie-ia` ;
- `LIRE-DABORD.md` : instructions détaillées ;
- `VERIFICATION.txt` : résultats et limites des vérifications effectuées.

Extraire complètement l’archive, ouvrir PowerShell dans le dossier extrait et
exécuter :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\APPLIQUER-FUSION.ps1
```

Le script utilise par défaut `$env:USERPROFILE\academie-ia`, soit
`C:\Users\HP\academie-ia` pour le compte Windows HP. Pour un autre emplacement :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\APPLIQUER-FUSION.ps1 -DossierDepot "D:\Projets\academie-ia"
```

Le script vérifie le dépôt de destination et l’état du travail local, crée une
sauvegarde Git, importe la branche de fusion, intègre les éventuels commits
distants et envoie `main` à GitHub. Des changements locaux non commités doivent
d’abord être enregistrés. En cas de conflit de fusion, le script annule cette
fusion et affiche une erreur. La sauvegarde Git reste disponible dans `.git`.

Si l’envoi est refusé, la fusion reste dans le dépôt local. Une fois
l’authentification GitHub rétablie, relancer `git push origin main` depuis ce
dépôt.

## Après publication

Vérifier l’accueil, l’espace apprenant et un parcours N1 complet à l’adresse
GitHub Pages habituelle. Tester ensuite la vérification d’un certificat déjà
enregistré dans le registre Google existant.

Après validation, le dépôt `academie-ia-generative` peut être archivé depuis
ses paramètres GitHub. Ses fichiers et son historique sont désormais dans
`academie-ia`. Une redirection de son ancienne adresse publique pourra être
ajoutée si cette adresse est utilisée ; elle dépendra de son hébergement.
