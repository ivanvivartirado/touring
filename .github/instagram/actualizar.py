"""
actualizar-instagram.py - Pone en la web las 6 ultimas publicaciones del Instagram de Touring.

Abre el perfil publico (instagram.com/touring.autoescola/embed/) con Chrome sin ventana, coge las fotos
de las ultimas publicaciones, las recorta a 640x640 y las guarda en assets/instagram/1.jpg ... 6.jpg con
un posts.json (texto alternativo y version). No hace falta cuenta ni contrasena de Instagram.
Si Instagram no devuelve al menos 3 fotos, no toca nada (se quedan las de la ultima vez).

Uso:  python tools/actualizar-instagram.py            (actualiza la web y la vista previa)
      python tools/actualizar-instagram.py --push     (ademas sube la vista previa a GitHub si ha cambiado)
      python actualizar.py --raiz .                   (GitHub Actions: solo esa carpeta; el commit lo hace el workflow)
"""
import hashlib
import os
import shutil
import html
import io
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
DESTINOS = [RAIZ, RAIZ / "vista-previa"]
if "--raiz" in sys.argv:   # en GitHub Actions: la carpeta de la web que se publica
    DESTINOS = [Path(sys.argv[sys.argv.index("--raiz") + 1]).resolve()]
PERFIL = "https://www.instagram.com/touring.autoescola/embed/"
CHROME = os.environ.get("CHROME_BIN") or next((c for c in [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
          shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chromium-browser")] if c and os.path.exists(c)), "chrome")
N, LADO = 6, 640


def leer_con_playwright():
    """En GitHub Actions: Chromium de Playwright, esperando a que salgan las fotos."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        pag = nav.new_page(locale="es-ES", user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                           "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
        pag.goto(PERFIL, timeout=60000)
        pag.wait_for_selector('img[src*="t51.82787-15"]', timeout=45000)
        posts = pag.eval_on_selector_all('img[src*="t51.82787-15"]', "els => els.map(e => ({src: e.src, alt: e.alt}))")
        nav.close()
    return posts[:N]


def leer_publicaciones():
    try:
        import playwright  # noqa: F401  (solo esta instalado en GitHub Actions)
        return leer_con_playwright()
    except ImportError:
        pass
    dom = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=15000",
                          "--window-size=1000,2000", "--dump-dom", PERFIL],
                         capture_output=True, timeout=120).stdout.decode("utf-8", "ignore")
    posts = []
    for tag in re.findall(r"<img[^>]*>", dom):
        src = re.search(r'src="([^"]+)"', tag)
        if not src or "t51.82787-15" not in src.group(1):   # -15 = publicaciones; -19 = foto de perfil
            continue
        alt = re.search(r'alt="([^"]*)"', tag)
        posts.append({"src": html.unescape(src.group(1)), "alt": html.unescape(alt.group(1)) if alt else ""})
    return posts[:N]


def recortar(datos):
    im = Image.open(io.BytesIO(datos)).convert("RGB")
    lado = min(im.size)
    x, y = (im.width - lado) // 2, (im.height - lado) // 2
    im = im.crop((x, y, x + lado, y + lado)).resize((LADO, LADO), Image.LANCZOS)
    out = io.BytesIO(); im.save(out, "JPEG", quality=82, optimize=True, progressive=True)
    return out.getvalue()


def texto_alt(t):
    t = re.sub(r"\s+", " ", t).strip()
    return (t[:110].rsplit(" ", 1)[0] + "…") if len(t) > 110 else (t or "Publicación de Instagram de Touring")


def main():
    posts = leer_publicaciones()
    if len(posts) < 3:
        print(f"Instagram solo ha devuelto {len(posts)} fotos: no se cambia nada.")
        return 1
    imagenes, meta = [], []
    for i, p in enumerate(posts, 1):
        req = urllib.request.Request(p["src"], headers={"User-Agent": "Mozilla/5.0"})
        datos = recortar(urllib.request.urlopen(req, timeout=30).read())
        v = hashlib.sha1(datos).hexdigest()[:8]
        imagenes.append(datos)
        meta.append({"img": f"assets/instagram/{i}.jpg", "v": v, "alt": texto_alt(p["alt"])})
    nuevo = json.dumps(meta, ensure_ascii=False, indent=1)
    cambiado = False
    for raiz in DESTINOS:
        if not raiz.exists():
            continue
        carpeta = raiz / "assets" / "instagram"; carpeta.mkdir(parents=True, exist_ok=True)
        js = carpeta / "posts.json"
        if js.exists() and js.read_text(encoding="utf-8") == nuevo:
            continue
        for i, datos in enumerate(imagenes, 1):
            (carpeta / f"{i}.jpg").write_bytes(datos)
        js.write_text(nuevo, encoding="utf-8")
        cambiado = True
    print("Instagram actualizado." if cambiado else "Sin publicaciones nuevas.")
    if cambiado and "--push" in sys.argv:
        vp = RAIZ / "vista-previa"
        subprocess.run(["git", "-C", str(vp), "add", "assets/instagram"], check=True)
        if subprocess.run(["git", "-C", str(vp), "diff", "--cached", "--quiet"]).returncode:
            subprocess.run(["git", "-C", str(vp), "commit", "-q", "-m", "Instagram: ultimas publicaciones"], check=True)
            subprocess.run(["git", "-C", str(vp), "push", "-q", "origin", "HEAD"], check=True)
            print("Vista previa subida a GitHub.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
