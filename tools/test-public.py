from pathlib import Path
from html.parser import HTMLParser
import json
import re
import subprocess
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
class Links(HTMLParser):
 def __init__(self,text):
  super().__init__();self.links=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='a':self.links.append(a)
def _ancien_format_complet():
  try:return all('course' in json.loads((ROOT/f'private-content/n{n}/course.json').read_text()) for n in range(1,5))
  except (OSError,ValueError):return False
class PublicTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):subprocess.run([sys.executable,str(ROOT/'build-tools/build_public.py'),'--preview'],check=True)
 def test_no_private_content_deployed(self):
  d=ROOT/'dist'
  for pattern in ('*.pdf','*.pptx','*.sqlite3','*corpus*','*course.json','*.gs','*.sql'):
   self.assertEqual(list(d.rglob(pattern)),[],pattern)
  for name in ('private-content','server-portail','server-tuteur','apps-script','supabase'):
   self.assertFalse((d/name).exists())
  self.assertFalse((d/'cours/slides-data.js').exists())
  self.assertFalse((d/'cours/slides.html').exists())
  self.assertFalse((d/'cours/programmes.js').exists())
 def test_every_enrollment_uses_google_form(self):
  count=0
  for p in (ROOT/'dist').rglob('*.html'):
   for a in Links(p.read_text()).links:
    if 'data-enroll' in a:
     count+=1;self.assertTrue(a['href'].startswith('https://docs.google.com/forms/') or a['href']=='inscription.html',a['href'])
    self.assertNotIn('api/register',a.get('href',''))
  self.assertGreaterEqual(count,15)
 def test_all_levels_have_enrollment_and_course(self):
  s=(ROOT/'dist/formations.html').read_text()
  for n in range(1,5):self.assertIn(f'id="niveau-{n}"',s);self.assertIn(f'connexion.html?niveau={n}',s)
  self.assertIn('data-enroll="1"',s)
  # Les prix FCFA sont volontairement publiés depuis les offres officielles : ne pas les tester ici.
  self.assertNotIn('ancien parcours',s)
 def test_old_modules_only_redirect(self):
  for p in (ROOT/'dist/modules').glob('*.html'):
   text=p.read_text();self.assertIn('http-equiv="refresh"',text);self.assertNotIn('localStorage',text);self.assertNotIn('QCM',text)
 @unittest.skipUnless(_ancien_format_complet(),'contenu privé de l’ancien parcours absent : contrôle réalisé hors dépôt')
 def test_objectives_and_activities_unique(self):
  exercises=[];total=0
  for n in range(1,5):
   d=json.loads((ROOT/f'private-content/n{n}/course.json').read_text())
   for lesson in d['course']['lessons']:
    total+=1;exercises.append(lesson['exercise']);self.assertTrue(lesson['deliverable']);self.assertTrue(lesson['objectives'])
  self.assertEqual(total,41);self.assertEqual(len(set(exercises)),41)
 def test_brand_and_metadata(self):
  for p in (ROOT/'dist').rglob('*.html'):
   text=p.read_text();self.assertIn('rel="icon"',text)
   if 'content="noindex' in text:continue
   self.assertIn('rel="canonical"',text);self.assertIn('name="description"',text)
  for css in (ROOT/'dist').rglob('*.css'):self.assertNotIn('fonts.googleapis.com',css.read_text(encoding='utf-8'),css.name)
 def test_content_security_policy_on_every_page(self):
  for p in (ROOT/'dist').rglob('*.html'):
   text=p.read_text(encoding='utf-8')
   self.assertIn('http-equiv="Content-Security-Policy"',text,p.name)
   self.assertNotIn("'unsafe-inline'",text,p.name)
   self.assertNotIn("'unsafe-eval'",text,p.name)
 def test_no_inline_script_or_handler_published(self):
  for p in (ROOT/'dist').rglob('*.html'):
   text=p.read_text(encoding='utf-8')
   self.assertIsNone(re.search(r'<script(?![^>]*\bsrc=)',text,re.I),p.name)
   self.assertIsNone(re.search(r'\son[a-z]+="',text,re.I),p.name)
 def test_no_third_party_script_loaded(self):
  for p in list((ROOT/'dist').rglob('*.html'))+list((ROOT/'dist').rglob('*.js')):
   text=p.read_text(encoding='utf-8')
   self.assertNotIn('esm.sh',text,p.name);self.assertNotIn('cdnjs.cloudflare.com',text,p.name)
 def test_vendored_libraries_present(self):
  self.assertTrue((ROOT/'dist/assets/vendor/supabase-js-2.117.2.esm.js').is_file())
  self.assertTrue((ROOT/'dist/assets/vendor/qrcodejs-1.0.0.min.js').is_file())
 def test_unconfigured_deployment_fails_closed(self):
  config=(ROOT/'assets/config.js').read_text()
  if "supabaseUrl: ''" in config:
   r=subprocess.run([sys.executable,str(ROOT/'build-tools/build_public.py')],capture_output=True)
   self.assertNotEqual(r.returncode,0)
if __name__=='__main__':unittest.main(verbosity=2)
