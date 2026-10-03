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
  self.assertFalse((d/'cours/programmes.js').exists())
 def test_every_enrollment_uses_google_form(self):
  count=0
  for p in (ROOT/'dist').rglob('*.html'):
   for a in Links(p.read_text()).links:
    if 'data-enroll' in a:
     count+=1;self.assertEqual(a['href'],'https://docs.google.com/forms/d/e/1FAIpQLSd3wZY241Mu27VVJp8P6v5FfnV8U1hSl3PwY0ojaPLGNAHLLA/viewform')
    self.assertNotIn('api/register',a.get('href',''))
  self.assertGreaterEqual(count,20)
 def test_all_levels_have_enrollment_and_course(self):
  s=(ROOT/'dist/formations.html').read_text()
  for n in range(1,5):self.assertIn(f'data-enroll="{n}"',s);self.assertIn(f'connexion.html?niveau={n}',s)
  self.assertNotIn('FCFA',s);self.assertNotIn('ancien parcours',s)
 def test_old_modules_only_redirect(self):
  for p in (ROOT/'dist/modules').glob('*.html'):
   text=p.read_text();self.assertIn('http-equiv="refresh"',text);self.assertNotIn('localStorage',text);self.assertNotIn('QCM',text)
 def test_objectives_and_activities_unique(self):
  exercises=[];total=0;slides=0
  for n in range(1,5):
   d=json.loads((ROOT/f'private-content/n{n}/course.json').read_text());slides+=len(d['deck']['slides'])
   for lesson in d['course']['lessons']:
    total+=1;exercises.append(lesson['exercise']);self.assertTrue(lesson['deliverable']);self.assertTrue(lesson['objectives'])
  self.assertEqual(total,41);self.assertEqual(slides,144);self.assertEqual(len(set(exercises)),41)
 def test_brand_and_metadata(self):
  for p in (ROOT/'dist').rglob('*.html'):
   text=p.read_text();self.assertIn('rel="icon"',text);self.assertIn('rel="canonical"',text);self.assertIn('name="description"',text)
  self.assertNotIn('fonts.googleapis.com',(ROOT/'dist/assets/brand.css').read_text())
 def test_unconfigured_deployment_fails_closed(self):
  config=(ROOT/'assets/config.js').read_text()
  if "supabaseUrl: ''" in config:
   r=subprocess.run([sys.executable,str(ROOT/'build-tools/build_public.py')],capture_output=True)
   self.assertNotEqual(r.returncode,0)
if __name__=='__main__':unittest.main(verbosity=2)
