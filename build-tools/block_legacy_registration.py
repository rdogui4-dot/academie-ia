"""Ajoute un refus des nouveaux certificats dans un Code.js existant, après sauvegarde."""
from pathlib import Path
from datetime import datetime
import argparse
parser=argparse.ArgumentParser();parser.add_argument('file',type=Path);args=parser.parse_args()
s=args.file.read_text(encoding='utf-8-sig');marker='ACADEMY_LEGACY_REGISTER_DISABLED'
if marker in s:raise SystemExit('Protection déjà présente.')
needle='function doPost(e) {'
if s.count(needle)!=1:raise SystemExit('doPost(e) non reconnu : aucun changement effectué.')
backup=args.file.with_name(args.file.name+'.avant-supabase-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'.bak');backup.write_text(s)
block='''
  // ACADEMY_LEGACY_REGISTER_DISABLED : registre historique en lecture seule.
  return ContentService.createTextOutput(JSON.stringify({success:false,message:"La délivrance des nouveaux certificats est gérée par le parcours Supabase."})).setMimeType(ContentService.MimeType.JSON);
'''
args.file.write_text(s.replace(needle,needle+block,1))
print('Ancien POST désactivé dans le fichier local ; sauvegarde :',backup.name)
print('Le déploiement Apps Script doit être mis à jour séparément pour activer cette protection.')
