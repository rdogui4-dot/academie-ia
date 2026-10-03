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
for n,slide_count in [(1,32),(2,36),(3,36),(4,40)]:
 intro=list(range(1,5 if n==3 else 4));routes=[p for row in x['slide_routes'] if row['level']==n for p in row['positions']]
 assert sorted(intro+routes)==list(range(1,slide_count+1)),n
for s in x['slide_sources']:
 route=next(row for row in x['slide_routes'] if row['level']==s['level'] and s['position'] in row['positions']);l=lessons[s['level'],route['step']]
 assert l['first_page']<=s['first_page']<=s['last_page']<=l['last_page'],s
assert 'academy_acknowledge_page' not in (ROOT/'cours/sommaire.js').read_text()
assert 'academy_progress' not in (ROOT/'cours/sommaire.js').read_text()
assert 'deck.lessonStarts' not in (ROOT/'cours/slides.js').read_text()
print('OK : cohérence des 41 étapes, 98 remises, 182 pages requises et 144 slides ; sommaires distincts.')
