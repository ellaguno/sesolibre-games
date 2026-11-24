#!/usr/bin/env python3
"""Capturas para la ficha del App Store, generadas desde la propia app.

Sirve `dist/` (hay que correr antes `npm run build`) y fotografía cada pantalla
con Chrome headless en los tamaños que pide Apple:
  iPhone 6.9"  1320×2868  (440×956 @3x)  → APP_IPHONE_67
  iPad 13"     2048×2732  (1024×1366 @2x) → APP_IPAD_PRO_3GEN_129
en español e inglés, a assets/appstore/<es|en>/<iphone|ipad>-N-<pantalla>.png.

La app corre dentro de un iframe de una página auxiliar (dist/__capturas.html,
temporal) que fija idioma y tema, oculta la invitación a Mind (en iOS no se
muestra) y pulsa «Jugar» donde hace falta.

Uso: python3 scripts/appstore/capturas.py
"""
from __future__ import annotations

import http.server
import os
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist'
OUT = ROOT / 'assets/appstore'

# (nombre, ruta, botón a pulsar o None)
PANTALLAS = [
    ('inicio', '/', None),
    ('figures', '/game/figures', 'play'),
    ('solitario', '/game/solitaire', None),
    ('ajedrez', '/game/ajedrez', None),
    ('sudoku', '/game/sudoku', None),
    ('glotono', '/game/glotono', None),
]
DISPOSITIVOS = {'iphone': (440, 956, 3), 'ipad': (1024, 1366, 2)}
BOTON = {'play': {'es': 'Jugar', 'en': 'Play'}}

PAGINA = """<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#0f172a}iframe{border:0;width:100vw;height:100vh;display:block}</style>
<iframe id="f"></iframe>
<script>
const p = new URLSearchParams(location.search);
localStorage.setItem('settings', JSON.stringify({theme:'dark',sound:false,motion:true,lang:p.get('lang'),online:false,initials:''}));
localStorage.setItem('mindInviteHidden', 'true');
const f = document.getElementById('f');
f.src = 'index.html#' + p.get('route');
f.onload = () => setTimeout(() => {
  const label = p.get('click');
  if (!label) return;
  const b = [...f.contentDocument.querySelectorAll('button')].find(x => x.textContent.trim() === label);
  if (b) b.click();
}, 1200);
</script>"""


def chrome() -> str:
    for name in ('google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'):
        if shutil.which(name):
            return shutil.which(name)
    sys.exit('No se encontró Chrome/Chromium.')


def main() -> None:
    if not (DIST / 'index.html').exists():
        sys.exit('Falta dist/: corre antes «npm run build».')
    (DIST / '__capturas.html').write_text(PAGINA)
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
    handler.log_message = lambda *a: None  # type: ignore[assignment]
    with socketserver.TCPServer(('127.0.0.1', 0), handler) as srv:
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        env = {k: v for k, v in os.environ.items() if k != 'TMPDIR'}  # rutas largas rompen Chrome
        try:
            for lang in ('es', 'en'):
                (OUT / lang).mkdir(parents=True, exist_ok=True)
                for disp, (w, h, scale) in DISPOSITIVOS.items():
                    for n, (nombre, ruta, boton) in enumerate(PANTALLAS, 1):
                        out = OUT / lang / f'{disp}-{n}-{nombre}.png'
                        click = BOTON[boton][lang] if boton else ''
                        url = f'http://127.0.0.1:{port}/__capturas.html?lang={lang}&route={ruta}&click={click}'
                        with tempfile.TemporaryDirectory(dir='/tmp') as prof:
                            subprocess.run(
                                [chrome(), '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
                                 f'--user-data-dir={prof}', f'--force-device-scale-factor={scale}',
                                 f'--window-size={w},{h}', '--virtual-time-budget=6000',
                                 f'--screenshot={out}', url],
                                capture_output=True, timeout=120, env=env,
                            )
                        if not out.exists():
                            sys.exit(f'Chrome no generó {out}')
                        # Sin canal alfa (App Store Connect rechaza capturas con transparencia).
                        subprocess.run(['convert', str(out), '-background', '#0f172a', '-alpha', 'remove',
                                        '-alpha', 'off', str(out)], check=True)
                        print(f'  {out.relative_to(ROOT)}')
        finally:
            srv.shutdown()
            (DIST / '__capturas.html').unlink(missing_ok=True)


if __name__ == '__main__':
    main()
