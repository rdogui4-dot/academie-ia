"""Vérifie les pages et liens locaux, sans dépendance Python externe."""
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


import sys
ROOT = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1] / 'dist'


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.links = []
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if "id" in attributes:
            self.ids.append(attributes["id"])
        for key in ("href", "src"):
            if attributes.get(key):
                self.links.append(attributes[key])


pages = {path: Page(path.read_text(encoding="utf-8")) for path in ROOT.rglob("*.html")}
if not ROOT.is_dir() or not pages:
    raise SystemExit("Aucune page à vérifier : générez dist et indiquez son chemin exact.")
errors = []
checked = 0


def verify_link(source, value):
    global checked
    url = urlsplit(value)
    if url.scheme or url.netloc:
        return
    target = (source.parent / unquote(url.path)).resolve() if url.path else source
    try:
        target.relative_to(ROOT)
    except ValueError:
        errors.append(f"{source.relative_to(ROOT)} : lien hors projet {value}")
        return
    if not target.is_file():
        errors.append(f"{source.relative_to(ROOT)} : fichier absent {value}")
        return
    if url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
        errors.append(f"{source.relative_to(ROOT)} : ancre absente {value}")
    checked += 1


for path, page in pages.items():
    if len(page.ids) != len(set(page.ids)):
        errors.append(f"{path.relative_to(ROOT)} : identifiant HTML dupliqué")
    for value in page.links:
        verify_link(path, value)

for path in ROOT.rglob("*.css"):
    for value in re.findall(r"url\(\s*['\"]?([^'\"\)]+)['\"]?\s*\)", path.read_text(encoding="utf-8")):
        verify_link(path, value.strip())

for pattern in ("*.html", "*.css", "*.js"):
    for path in ROOT.rglob(pattern):
        if re.search(r"^(?:<<<<<<< |=======\s*$|>>>>>>> )", path.read_text(encoding="utf-8"), re.M):
            errors.append(f"{path.relative_to(ROOT)} : marqueur de conflit Git")

print(f"{len(pages)} pages HTML et {checked} liens locaux vérifiés.")
if errors:
    raise SystemExit("\n".join(errors))
print("OK : aucun lien local cassé, aucun identifiant dupliqué ni conflit Git.")
