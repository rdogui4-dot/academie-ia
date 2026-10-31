"""Mise en ligne du cours N1 : brouillon-n1/ devient n1/ (à lancer APRÈS la bascule SQL).

Usage :
  python build-tools/publish_n1.py --verifier    liste ce qui serait copié et supprimé, sans réseau ni clé
  python build-tools/publish_n1.py               copie puis propose la suppression des anciens fichiers ; URL et clé demandées

Étapes :
  1. Copie course.json et pages/001 à 024 (.webp et .txt) de brouillon-n1/ vers n1/.
  2. Liste les fichiers de n1/ qui n'existent plus dans le nouveau cours (anciennes pages 025 à 042, etc.).
  3. Suppression seulement après saisie explicite de SUPPRIMER.
La clé service_role est saisie masquée, jamais enregistrée.
"""
from pathlib import Path
import argparse, base64, getpass, json, mimetypes, re, sys
import urllib.error, urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
from upload_n1 import controler_local, verifier_cle  # noqa: E402

BUCKET = 'academy-private'
SOURCE_PREFIXE = 'brouillon-n1'
CIBLE_PREFIXE = 'n1'


def requete(url, entetes, methode, chemin, corps=None, type_contenu='application/json'):
    donnees = None if corps is None else (corps if isinstance(corps, bytes) else json.dumps(corps).encode('utf-8'))
    entetes = dict(entetes)
    if donnees is not None:
        entetes['Content-Type'] = type_contenu
    demande = urllib.request.Request(f'{url}{chemin}', data=donnees, method=methode, headers=entetes)
    try:
        with urllib.request.urlopen(demande, timeout=60) as reponse:
            contenu = reponse.read()
            return json.loads(contenu) if contenu and contenu[:1] in b'[{' else contenu
    except urllib.error.HTTPError as erreur:
        detail = erreur.read(400).decode('utf-8', errors='replace')
        detail = re.sub(r'(sb_secret_|sb_publishable_)[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]+', '[CLE MASQUEE]', detail)
        raise SystemExit(f'Échec {methode} {chemin} : HTTP {erreur.code} {detail}')


def lister(url, entetes, dossier):
    """Renvoie les chemins complets des fichiers de `dossier`, sous-dossiers compris."""
    fichiers, decalage = [], 0
    while True:
        lot = requete(url, entetes, 'POST', '/storage/v1/object/list/' + BUCKET,
                      {'prefix': dossier, 'limit': 1000, 'offset': decalage, 'sortBy': {'column': 'name', 'order': 'asc'}})
        for entree in lot:
            chemin = f"{dossier}/{entree['name']}"
            fichiers += lister(url, entetes, chemin) if entree.get('id') is None else [chemin]
        if len(lot) < 1000:
            return fichiers
        decalage += 1000


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verifier', action='store_true')
    args = parser.parse_args()
    fichiers = controler_local()
    noms_attendus = {nom for nom, _ in fichiers}
    print(f'Contrôle local réussi : {len(fichiers)} fichiers seront copiés de {SOURCE_PREFIXE}/ vers {CIBLE_PREFIXE}/.')
    if args.verifier:
        return
    url = input('URL du projet Supabase (https://….supabase.co) : ').strip().rstrip('/')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', url):
        raise SystemExit('URL Supabase invalide.')
    entetes = verifier_cle(getpass.getpass('Clé service_role (saisie masquée) : ').strip())

    for nom, chemin in fichiers:
        contenu = requete(url, entetes, 'GET', f'/storage/v1/object/authenticated/{BUCKET}/{SOURCE_PREFIXE}/{nom}')
        if not isinstance(contenu, bytes) or not contenu:
            raise SystemExit(f'Lecture impossible dans {SOURCE_PREFIXE}/{nom}')
        envoyer_ecraser(url, entetes, f'{CIBLE_PREFIXE}/{nom}', contenu, nom)
        print('Copié :', f'{SOURCE_PREFIXE}/{nom}', '→', f'{CIBLE_PREFIXE}/{nom}')

    existants = lister(url, entetes, CIBLE_PREFIXE)
    obsoletes = [n for n in existants if n[len(CIBLE_PREFIXE) + 1:] not in noms_attendus]
    print(f'\n{len(obsoletes)} anciens fichiers de {CIBLE_PREFIXE}/ ne font plus partie du cours :')
    for n in obsoletes:
        print('  -', n)
    if not obsoletes:
        return
    if input('Tapez SUPPRIMER pour effacer ces fichiers (tout autre texte annule) : ').strip() != 'SUPPRIMER':
        print('Aucune suppression. Les fichiers obsolètes restent dans le stockage.')
        return
    requete(url, entetes, 'DELETE', '/storage/v1/object/' + BUCKET, {'prefixes': obsoletes})
    print(f'{len(obsoletes)} fichiers obsolètes supprimés.')


def envoyer_ecraser(url, entetes, chemin_distant, contenu, nom):
    demande = urllib.request.Request(
        f'{url}/storage/v1/object/{BUCKET}/{chemin_distant}', data=contenu, method='POST',
        headers={**entetes, 'x-upsert': 'true', 'Content-Type': mimetypes.guess_type(nom)[0] or 'application/octet-stream'})
    try:
        with urllib.request.urlopen(demande, timeout=60):
            pass
    except urllib.error.HTTPError as erreur:
        raise SystemExit(f'Échec pour {chemin_distant} : HTTP {erreur.code}')


if __name__ == '__main__':
    main()
