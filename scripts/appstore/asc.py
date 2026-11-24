#!/usr/bin/env python3
"""Cliente mínimo de la API de App Store Connect (JWT ES256). Copia del de sesolibre-sonidos. Lo usa asc-ficha.py y quien
quiera curiosear: `python3 scripts/appstore/asc.py GET '/v1/apps?filter[bundleId]=com.sesolibre.sesolibregames'`.
Credenciales: ASC_KEY_ID, ASC_ISSUER_ID y ASC_PRIVATE_KEY (contenido del .p8); nunca se imprimen.
Requiere: pip install pyjwt cryptography
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

import jwt

API = 'https://api.appstoreconnect.apple.com'


def token() -> str:
    ahora = int(time.time())
    return jwt.encode(
        {'iss': os.environ['ASC_ISSUER_ID'], 'iat': ahora, 'exp': ahora + 900, 'aud': 'appstoreconnect-v1'},
        os.environ['ASC_PRIVATE_KEY'], algorithm='ES256',
        headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'})


def llamar(metodo: str, ruta: str, cuerpo: dict | None = None) -> dict:
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(API + ruta if ruta.startswith('/') else ruta, data=datos, method=metodo,
                                 headers={'Authorization': f'Bearer {token()}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            texto = r.read()
            return json.loads(texto) if texto else {}
    except urllib.error.HTTPError as e:
        detalle = e.read().decode()
        sys.exit(f'✗ {metodo} {ruta} → {e.code}: {detalle[:800]}')


if __name__ == '__main__':
    print(json.dumps(llamar(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]) if len(sys.argv) > 3 else None), indent=1, ensure_ascii=False))
