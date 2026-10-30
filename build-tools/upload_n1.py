"""Téléversement du cours N1 vers le STOCKAGE DE BROUILLON (invisible des apprenants).

Usage :
  python build-tools/upload_n1.py --verifier      contrôle local, sans réseau ni clé
  python build-tools/upload_n1.py                 téléversement ; URL et clé demandées au terminal

Envoie vers brouillon-n1/ dans le bucket academy-private :
  course.json, pages/001 à 024 (.webp et .txt).
Ne remplace rien dans n1/ : la mise en ligne est une étape séparée.
La clé service_role est saisie masquée, jamais enregistrée.
"""
from pathlib import Path
import argparse, base64, getpass, json, mimetypes, re, subprocess, sys
import urllib.error, urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'private-content' / 'n1'
PREFIXE = 'brouillon-n1'
PAGES = range(1, 25)


def controler_local():
    """Vérifie le cours et les pages avant tout envoi."""
    resultat = subprocess.run([sys.executable, str(ROOT / 'tools' / 'check-cours-n1.py')], capture_output=True, text=True)
    if resultat.returncode != 0:
        raise SystemExit('Cours refusé par le contrôle :\n' + resultat.stdout + resultat.stderr)
    fichiers = [(f'course.json', SOURCE / 'course.json')]
    for n in PAGES:
        for ext in ('webp', 'txt'):
            fichiers.append((f'pages/{n:03d}.{ext}', SOURCE / 'pages' / f'{n:03d}.{ext}'))
    for nom, chemin in fichiers:
        if not chemin.is_file() or chemin.stat().st_size == 0:
            raise SystemExit(f'Fichier manquant ou vide : {chemin.relative_to(ROOT)}')
    for nom, chemin in fichiers:
        if nom.endswith('.webp'):
            entete = chemin.read_bytes()[:12]
            if entete[:4] != b'RIFF' or entete[8:12] != b'WEBP':
                raise SystemExit(f'Image illisible : {nom}')
    return fichiers


def verifier_cle(cle):
    if cle.startswith('sb_secret_'):
        return {'apikey': cle}
    try:
        payload = cle.split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
    except Exception:
        raise SystemExit('Clé non reconnue. Copiez la clé « service_role » complète depuis Project Settings › API Keys.')
    if claims.get('role') != 'service_role':
        raise SystemExit('Cette clé n\'a pas le rôle service_role.')
    return {'apikey': cle, 'Authorization': 'Bearer ' + cle}


def envoyer(url, entetes, nom, chemin):
    requete = urllib.request.Request(
        f'{url}/storage/v1/object/academy-private/{PREFIXE}/{nom}',
        data=chemin.read_bytes(), method='POST',
        headers={**entetes, 'x-upsert': 'true',
                 'Content-Type': mimetypes.guess_type(nom)[0] or 'application/octet-stream'})
    try:
        with urllib.request.urlopen(requete, timeout=60) as reponse:
            if reponse.status not in (200, 201):
                raise SystemExit(f'Réponse inattendue pour {nom} : HTTP {reponse.status}')
    except urllib.error.HTTPError as erreur:
        corps = erreur.read(400).decode('utf-8', errors='replace')
        corps = re.sub(r'(sb_secret_|sb_publishable_)[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]+', '[CLE MASQUEE]', corps)
        raise SystemExit(f'Échec pour {nom} : HTTP {erreur.code} {corps}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verifier', action='store_true')
    args = parser.parse_args()
    fichiers = controler_local()
    print(f'Contrôle local réussi : {len(fichiers)} fichiers prêts (course.json et 24 pages).')
    if args.verifier:
        return
    url = input('URL du projet Supabase (https://….supabase.co) : ').strip().rstrip('/')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', url):
        raise SystemExit('URL Supabase invalide.')
    entetes = verifier_cle(getpass.getpass('Clé service_role (saisie masquée) : ').strip())
    for nom, chemin in fichiers:
        envoyer(url, entetes, nom, chemin)
        print('Envoyé :', f'{PREFIXE}/{nom}')
    print(f'Terminé : {len(fichiers)} fichiers dans {PREFIXE}/. Rien n\'a été remplacé dans n1/.')


if __name__ == '__main__':
    main()
