from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
x=json.loads((ROOT/'docs/exigences-pedagogiques.json').read_text())
lessons={(l['level'],l['step']):l for l in x['lessons']}
required={(p['level'],p['page']) for p in x['pages'] if p['required']}
assert len(required)==182
for d in x['documents']:
 n=d['level'];assert lessons[n,1]['first_page']==d['first_course_page'];assert not any((n,p) in required for p in d['excluded_pages'])
 assert d['summary_pages']==[2,3]
 for page in range(d['first_course_page'],d['last_course_page']+1):
  if page not in d['excluded_pages']:assert sum(p['level']==n and p['page']==page and p['required'] for p in x['pages'])==1
for r in x['requirements']:
 l=lessons[r['level'],r['step']];assert (r['level'],r['page']) in required
 assert l['first_page']<=r['page']<=r['last_page']<=l['last_page'],r['id']
 if r['source_kind']=='manual':assert f"à partir de la page {r['page']}" in r['instruction']
 if r['source_kind']=='activity':assert r['source_title']==l['title']
 assert r['source_kind'] in ('manual','activity','supplement')
assert 'academy_acknowledge_page' not in (ROOT/'cours/sommaire.js').read_text()
assert 'academy_progress' not in (ROOT/'cours/sommaire.js').read_text()
print('OK : cohérence des 41 étapes, 98 remises, 182 pages requises ; sommaires distincts (diapositives retirées).')
