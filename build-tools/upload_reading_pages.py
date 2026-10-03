"""Import administrateur local. Ne conserve jamais la clé sur disque."""
from pathlib import Path
import base64
import getpass
import json
import mimetypes
import re
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
url = input('URL du projet Supabase : ').strip().rstrip('/')
if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', url):
    raise SystemExit('URL Supabase invalide.')
key = getpass.getpass('Clé serveur service_role ou sb_secret_ (saisie masquée) : ').strip()
headers = {'apikey': key}
if key.startswith('sb_secret_'):
    pass
else:
    try:
        payload = key.split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
    except Exception:
        raise SystemExit('Clé serveur non reconnue. Copiez sa valeur complète dans Settings > API Keys.')
    if claims.get('role') != 'service_role':
        raise SystemExit('Cette clé ne possède pas le rôle service_role. La clé publique ne permet pas cet import.')
    headers['Authorization'] = 'Bearer ' + key

files = [(n, f'pages/{page:03d}.{ext}', ROOT / 'private-content' / f'n{n}' / 'pages' / f'{page:03d}.{ext}')
         for n, count in ((1,42),(2,59),(3,40),(4,60))
         for page in range(1,count+1) for ext in ('webp','txt')]
for n, name, path in files:
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f'Support manquant : n{n}/{name}. Utilisez le paquet complet.')

for n, name, path in files:
    if path.suffix == '.webp':
        signature = path.read_bytes()[:12]
        if signature[:4] != b'RIFF' or signature[8:12] != b'WEBP':
            raise SystemExit(f'Image illisible : n{n}/{name}. Extrayez de nouveau le paquet complet.')

for n, name, path in files:
    request = urllib.request.Request(
        f'{url}/storage/v1/object/academy-private/n{n}/{name}',
        data=path.read_bytes(), method='POST',
        headers={**headers, 'x-upsert': 'true',
                 'Content-Type': mimetypes.guess_type(name)[0] or 'application/octet-stream'})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            if response.status not in (200, 201):
                raise SystemExit(f'Réponse inattendue : HTTP {response.status}')
    except urllib.error.HTTPError as error:
        raw = error.read(8192).decode('utf-8', errors='replace')
        try:
            details = json.loads(raw)
            raw = json.dumps({k: details[k] for k in ('statusCode', 'code', 'error', 'message') if k in details}, ensure_ascii=False)
        except (ValueError, TypeError):
            raw = 'Réponse non JSON du serveur.'
        raw = raw.replace(key, '[CLE MASQUEE]')
        raw = re.sub(r'(?:sb_secret_|sb_publishable_)[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]+', '[CLE MASQUEE]', raw)
        raise SystemExit(f'Échec n{n}/{name} | HTTP {error.code} | {raw[:700]}')
    except urllib.error.URLError as error:
        reason = str(error.reason).replace(key, '[CLE MASQUEE]')
        raise SystemExit(f'Échec réseau/TLS n{n}/{name} : {reason[:300]}')
    except TimeoutError:
        raise SystemExit(f'Délai réseau dépassé pour n{n}/{name}.')
    print(f'Envoyé : n{n}/{name}')
print('402 fichiers de lecture privés envoyés. Le stockage academy-private doit rester PRIVÉ.')
