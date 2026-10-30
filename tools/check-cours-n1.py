"""Contrôle du fichier de cours N1 avant téléversement (aucun contenu n'est publié par ce script).

Usage : python tools/check-cours-n1.py
Lit private-content/n1/course.json et private-content/n1/plan.json.
"""
from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parents[1]
course = json.loads((ROOT / 'private-content/n1/course.json').read_text(encoding='utf-8'))
plan = json.loads((ROOT / 'private-content/n1/plan.json').read_text(encoding='utf-8'))
erreurs = []

for champ in ('title', 'duration', 'version', 'lessons', 'updates', 'page_overrides'):
    if champ not in course:
        erreurs.append(f"champ absent : {champ}")

etapes = plan['etapes']
if len(course['lessons']) != len(etapes):
    erreurs.append(f"{len(course['lessons'])} étapes dans le cours, {len(etapes)} dans le plan")

for i, (lesson, e) in enumerate(zip(course['lessons'], etapes), 1):
    if lesson.get('step') != i or lesson.get('title') != e['titre']:
        erreurs.append(f"étape {i} : numéro ou titre différent du plan")
    if not lesson.get('objectives') or len(lesson.get('review', [])) < 2 or not lesson.get('exercise'):
        erreurs.append(f"étape {i} : objectif, deux révisions ou consigne manquants")

texte = json.dumps(course, ensure_ascii=False)
if 'À RÉDIGER' in texte:
    erreurs.append(f"{texte.count('À RÉDIGER')} texte(s) « À RÉDIGER » à remplacer avant publication")

pages = [p for e in etapes for p in range(e['pages'][0], e['pages'][1] + 1)] + list(range(22, 25))
if sorted(pages) != list(range(4, 25)):
    erreurs.append('couverture des pages 4 à 24 incomplète ou en double')

if erreurs:
    print('ÉCHEC :'); [print(' -', e) for e in erreurs]
    sys.exit(1)
brouillons = [l['step'] for l in course['lessons'] if 'relire' in l.get('statut', '')]
print('OK : structure du cours N1 conforme.')
if brouillons:
    print(f"À faire relire avant publication : étapes {brouillons}")
