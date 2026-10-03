"""Produit exclusivement le frontend public. Les supports restent hors du site."""
from pathlib import Path
import argparse
import base64
from urllib.parse import urlsplit, parse_qs
import json
import re
import shutil
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--preview',action='store_true');args=parser.parse_args()
config=(ROOT/'assets/config.js').read_text()
if not args.preview:
    def value(name,source=config):
        match=re.search(r"\b"+name+r"\s*:\s*(['\"])(.*?)\1",source)
        return match.group(2) if match else ''
    project=value('supabaseUrl');key=value('supabasePublishableKey')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co',project):
        raise SystemExit('Publication bloquée : URL du projet Supabase absente ou invalide.')
    public_key=key.startswith('sb_publishable_')
    if not public_key:
        try:
            payload=key.split('.')[1];claims=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))
            public_key=claims.get('role')=='anon'
        except Exception:pass
    if not public_key:
        raise SystemExit('Publication bloquée : seule une clé publishable ou anon est autorisée. Jamais service_role.')
    block=re.search(r'formLinks\s*:\s*\{([^}]+)\}',config)
    for n in range(1,5):
        link=value(str(n),block.group(1) if block else '')
        parsed=urlsplit(link)
        selected=[v for values in parse_qs(parsed.query).values() for v in values if v.startswith(f'N{n} ')]
        if parsed.scheme!='https' or parsed.netloc!='docs.google.com' or not parsed.path.startswith('/forms/') or not selected:
            raise SystemExit(f'Publication bloquée : lien prérempli Google Forms N{n} absent ou incohérent.')
out=ROOT/'dist'
if out.exists():shutil.rmtree(out)
out.mkdir()
for p in ROOT.glob('*.html'):shutil.copy2(p,out/p.name)
for name in ('style.css','vitrine.css'):
    shutil.copy2(ROOT/name,out/name)
shutil.copytree(ROOT/'assets',out/'assets')
for folder in ('cours','modules','formations'):
    (out/folder).mkdir()
    for p in (ROOT/folder).iterdir():
        if p.suffix in ('.html','.css','.js'):
            if p.name in ('programmes.js','slides-data.js','integration.js'):continue
            shutil.copy2(p,out/folder/p.name)
(out/'.nojekyll').write_text('')
public_pages=['index.html','formations.html','inscription.html','informations.html','verification.html']
base='https://rdogui4-dot.github.io/academie-ia/'
(out/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>{base}{p}</loc></url>' for p in public_pages)+'</urlset>')
assert not list(out.rglob('*.pdf')) and not list(out.rglob('*.pptx')) and not (out/'private-content').exists()
print('Frontend public généré dans dist : aucun manuel, corrigé ou support privé inclus.')
