"""Téléverse l'exercice APPRENANT N1 dans le stockage (n1/exercice/exercice-apprenant.html).

Usage :
  python build-tools/upload_exercice_n1.py --verifier   contrôle local, sans réseau ni clé
  python build-tools/upload_exercice_n1.py              téléversement ; URL et clé demandées au terminal

Seul le fichier apprenant est envoyé. Le corrigé formateur n'est jamais téléversé.
La clé service_role est saisie masquée, jamais enregistrée.
"""
from pathlib import Path
import argparse, getpass, mimetypes, re, sys
import urllib.error, urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
from upload_n1 import verifier_cle  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'private-content' / 'n1' / 'exercice' / 'exercice-apprenant.html'
DESTINATION = 'n1/exercice/exercice-apprenant.html'


def controler_local():
    if not SOURCE.is_file() or SOURCE.stat().st_size == 0:
        raise SystemExit(f'Fichier introuvable : {SOURCE.relative_to(ROOT)}')
    texte = SOURCE.read_text(encoding='utf-8')
    titre = re.search(r'<title>(.*?)</title>', texte, re.S)
    if titre and 'corrig' in titre.group(1).lower():
        raise SystemExit('Ce fichier semble être le corrigé : envoi refusé.')
    if '<script' in texte.lower():
        raise SystemExit('Le fichier contient du JavaScript : envoi refusé.')
    return SOURCE.read_bytes()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verifier', action='store_true')
    args = parser.parse_args()
    contenu = controler_local()
    print(f'Contrôle local réussi : {SOURCE.name} ({len(contenu)} octets) sera envoyé vers {DESTINATION}.')
    if args.verifier:
        return
    url = input('URL du projet Supabase (https://….supabase.co) : ').strip().rstrip('/')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', url):
        raise SystemExit('URL Supabase invalide.')
    entetes = verifier_cle(getpass.getpass('Clé service_role (saisie masquée) : ').strip())
    demande = urllib.request.Request(
        f'{url}/storage/v1/object/academy-private/{DESTINATION}', data=contenu, method='POST',
        headers={**entetes, 'x-upsert': 'true', 'Content-Type': 'text/html; charset=utf-8'})
    try:
        with urllib.request.urlopen(demande, timeout=60) as reponse:
            if reponse.status not in (200, 201):
                raise SystemExit(f'Réponse inattendue : HTTP {reponse.status}')
    except urllib.error.HTTPError as erreur:
        raise SystemExit(f'Échec : HTTP {erreur.code}')
    print(f'Envoyé : {DESTINATION}. Le corrigé n\'a pas été envoyé.')


if __name__ == '__main__':
    main()
