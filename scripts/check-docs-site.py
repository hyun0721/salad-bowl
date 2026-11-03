#!/usr/bin/env python3
"""docs/site의 페이지가 nav·홈·CI 검사·내부 링크와 서로 맞는지 확인한다. 어긋나면 종료 코드 1."""
import re, sys
from html.parser import HTMLParser
from pathlib import Path

SITE = Path("docs/site")
WORKFLOW = Path(".github/workflows/docs-pages.yml")


class Page(HTMLParser):
	def __init__(self, html):
		super().__init__()
		self.ids, self.links, self.nav, self.body_links = set(), [], [], []
		self.current = []
		self._in_nav = False
		self.feed(html)

	def handle_starttag(self, tag, attrs):
		a = dict(attrs)
		if "id" in a:
			self.ids.add(a["id"])
		if tag == "nav" and "guide-nav" in (a.get("class") or ""):
			self._in_nav = True
		ref = a.get("href") if tag == "a" else a.get("src") if tag == "img" else None
		if ref and not ref.startswith(("http", "mailto:", "data:")):
			self.links.append(ref)
			(self.nav if self._in_nav else self.body_links).append(ref)
			if self._in_nav and a.get("aria-current") == "page":
				self.current.append(ref)

	def handle_endtag(self, tag):
		if tag == "nav":
			self._in_nav = False


pages = {p.name: Page(p.read_text(encoding="utf-8")) for p in sorted(SITE.glob("*.html"))}
workflow = WORKFLOW.read_text(encoding="utf-8")
errors = []

for name, page in pages.items():
	for other in pages:
		if other not in page.nav:
			errors.append(f"{name}: nav에 {other} 링크가 없다")
	if page.current != [name]:
		errors.append(f"{name}: nav의 현재 페이지 표시가 {page.current}이다 (기대: [{name!r}])")
	if f"test -s docs/site/{name}" not in workflow:
		errors.append(f"{WORKFLOW.name}: {name}의 'test -s' 검사가 없다")
	for ref in page.links:
		target, _, anchor = ref.partition("#")
		path = SITE / name if not target else (SITE / name).parent / target
		if not path.exists():
			errors.append(f"{name}: 링크 대상이 없다 → {ref}")
		elif anchor and path.suffix == ".html":
			ids = pages[path.name].ids if path.name in pages else Page(path.read_text(encoding="utf-8")).ids
			if anchor not in ids:
				errors.append(f"{name}: 앵커가 없다 → {ref}")

for other in pages:
	if other != "index.html" and other not in pages["index.html"].body_links:
		errors.append(f"index.html: 본문에 {other} 링크가 없다")

print("\n".join(errors) if errors else f"OK: 페이지 {len(pages)}개 확인")
sys.exit(1 if errors else 0)
