"""Publie la banque de quiz N1 (8 étapes × 7 questions) avec un compte administrateur.

Usage :
  python build-tools/publish_quiz_n1.py --verifier   contrôle local du fichier, sans réseau
  python build-tools/publish_quiz_n1.py              publication ; URL, clé publique et compte demandés

Fichier : private-content/n1/quiz-banque.json (non versionné).
Le compte doit être administrateur : academy_publish_quiz le vérifie côté serveur.
Le mot de passe est saisi masqué, jamais enregistré.
"""
from pathlib import Path
import argparse, getpass, json, re, sys
import urllib.error, urllib.request

ROOT = Path(__file__).resolve().parents[1]
BANQUE = ROOT / 'private-content' / 'n1' / 'quiz-banque.json'


def controler(banque):
    erreurs = []
    if banque.get('niveau') != 1:
        erreurs.append('niveau attendu : 1')
    etapes = banque.get('etapes', [])
    if [e.get('step') for e in etapes] != list(range(1, 9)):
        erreurs.append('8 étapes numérotées de 1 à 8 attendues')
    for e in etapes:
        qs = e.get('questions', [])
        if len(qs) != 7 or sum(q.get('type') == 'qcm' for q in qs) != 5 or sum(q.get('type') == 'short' for q in qs) != 2:
            erreurs.append(f"étape {e.get('step')} : 5 QCM et 2 réponses courtes requis")
        for q in qs:
            if not 10 <= len(q.get('prompt', '').strip()) <= 2000:
                erreurs.append(f"énoncé invalide à l'étape {e.get('step')}")
            if not 3 <= len(q.get('source', '').strip()) <= 500:
                erreurs.append(f"référence au support manquante à l'étape {e.get('step')}")
            if q.get('type') == 'qcm':
                if len(q.get('options', [])) != 4 or len(q.get('correct', [])) != 1 or not 0 <= q['correct'][0] <= 3:
                    erreurs.append(f"QCM invalide à l'étape {e.get('step')} : {q.get('prompt', '')[:40]}")
            elif not 1 <= len(q.get('variants', [])) <= 30:
                erreurs.append(f"réponse courte invalide à l'étape {e.get('step')}")
    return erreurs


def connexion(url, cle, courriel, mot_de_passe):
    demande = urllib.request.Request(
        f'{url}/auth/v1/token?grant_type=password', method='POST',
        data=json.dumps({'email': courriel, 'password': mot_de_passe}).encode('utf-8'),
        headers={'apikey': cle, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(demande, timeout=60) as reponse:
            return json.loads(reponse.read())['access_token']
    except urllib.error.HTTPError as erreur:
        raise SystemExit(f'Connexion refusée : HTTP {erreur.code}')


def publier(url, cle, jeton, etape, questions):
    demande = urllib.request.Request(
        f'{url}/rest/v1/rpc/academy_publish_quiz', method='POST',
        data=json.dumps({'p_level': 1, 'p_step': etape, 'p_questions': questions}).encode('utf-8'),
        headers={'apikey': cle, 'Authorization': 'Bearer ' + jeton, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(demande, timeout=60) as reponse:
            return json.loads(reponse.read())
    except urllib.error.HTTPError as erreur:
        detail = erreur.read(300).decode('utf-8', errors='replace')
        detail = re.sub(r'eyJ[A-Za-z0-9_.-]+|sb_[a-z]+_[A-Za-z0-9_-]+', '[CLE MASQUEE]', detail)
        raise SystemExit(f'Étape {etape} refusée : HTTP {erreur.code} {detail}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verifier', action='store_true')
    args = parser.parse_args()
    banque = json.loads(BANQUE.read_text(encoding='utf-8'))
    erreurs = controler(banque)
    if erreurs:
        raise SystemExit('Banque refusée :\n- ' + '\n- '.join(erreurs))
    print('Contrôle local réussi : 8 étapes, 40 QCM, 16 réponses courtes.')
    if args.verifier:
        return
    url = input('URL du projet Supabase (https://….supabase.co) : ').strip().rstrip('/')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', url):
        raise SystemExit('URL Supabase invalide.')
    cle = getpass.getpass('Clé publique (publishable, anon) : ').strip()
    courriel = input('Courriel du compte administrateur : ').strip()
    jeton = connexion(url, cle, courriel, getpass.getpass('Mot de passe (saisie masquée) : '))
    for e in banque['etapes']:
        resultat = publier(url, cle, jeton, e['step'], e['questions'])
        print(f"Étape {e['step']} publiée (version {resultat})")
    print('Terminé. Les quiz restent à activer par apprenant depuis l’espace administrateur.')


if __name__ == '__main__':
    main()
