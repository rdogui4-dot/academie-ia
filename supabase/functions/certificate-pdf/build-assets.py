"""Génère assets.ts (polices et logo embarqués) à partir des fichiers du dépôt.

Usage : python supabase/functions/certificate-pdf/build-assets.py
assets.ts est volumineux (≈1 Mo) : il n'est pas versionné, il se régénère.
"""
from pathlib import Path
import base64

ROOT = Path(__file__).resolve().parents[3]
FONT = ROOT / 'assets/fonts/DejaVuSans.ttf'
LOGO = ROOT / 'assets/logo-officiel-blanc.png'
OUT = Path(__file__).resolve().parent / 'assets.ts'

def b64(path):
    return base64.b64encode(path.read_bytes()).decode('ascii')

OUT.write_text(
    '// Embedded licensed assets: see LICENCE-DejaVu.txt. Generated from repository assets.\n'
    f"export const fontBase64='{b64(FONT)}';\n"
    f"export const logoBase64='{b64(LOGO)}';\n",
    encoding='utf-8')
print('assets.ts écrit :', OUT)
