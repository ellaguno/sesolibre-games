#!/usr/bin/env python3
"""Lleva un build recién subido a la prueba EXTERNA de TestFlight (enlace público).

Espera a que Apple procese el build, le pone el texto de «qué probar» (la línea
`es:` de docs/release-notes.txt), lo agrega al grupo externo y lo envía a la
revisión beta (Beta App Review). Cuando Apple la aprueba, cualquiera con el
enlace público del grupo puede instalar la versión.

Variables de entorno (secrets del repo):
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (contenido del .p8)
Argumentos:
  asc-testflight.py <bundle-id> <versión> <build> [grupo]
    versión  CFBundleShortVersionString (package.json)
    build    CFBundleVersion (github.run_number)
    grupo    nombre del grupo externo (por defecto «Familia y amigos»)

Si Apple no acepta el envío (p. ej. el error 422 «Please try again later»),
reintenta un rato y termina con un aviso, sin fallar: el build ya está subido y
el envío puede hacerse después desde App Store Connect → TestFlight.
Requiere: pip install pyjwt cryptography
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import jwt

API = 'https://api.appstoreconnect.apple.com'
ROOT = Path(__file__).resolve().parent.parent


def token() -> str:
    now = int(time.time())
    return jwt.encode(
        {'iss': os.environ['ASC_ISSUER_ID'], 'iat': now, 'exp': now + 600, 'aud': 'appstoreconnect-v1'},
        os.environ['ASC_PRIVATE_KEY'],
        algorithm='ES256',
        headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'},
    )


def call(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, {'errors': [{'detail': raw.decode(errors='replace')[:300]}]}


def detail(r: dict) -> str:
    errs = r.get('errors') or [{}]
    return errs[0].get('detail') or errs[0].get('title') or str(r)[:300]


def must(status: int, r: dict, what: str) -> dict:
    if status >= 300:
        sys.exit(f'::error::{what}: {status} {detail(r)}')
    return r


def q(**params: str) -> str:
    return '?' + urllib.parse.urlencode(params)


def warn(msg: str) -> None:
    print(f'::warning::{msg}')


def whats_new() -> str:
    """Línea «es:» de docs/release-notes.txt (máx. 4000 caracteres)."""
    notes = ROOT / 'docs/release-notes.txt'
    if notes.exists():
        for line in notes.read_text().splitlines():
            if line.startswith('es:'):
                return line[3:].strip()[:4000]
    return 'Nueva versión. Gracias por probarla.'


def main() -> None:
    bundle_id, version, build = sys.argv[1], sys.argv[2], sys.argv[3]
    group_name = sys.argv[4] if len(sys.argv) > 4 else 'Familia y amigos'

    _, r = call('GET', '/v1/apps' + q(**{'filter[bundleId]': bundle_id}))
    apps = [a for a in r.get('data', []) if a['attributes']['bundleId'] == bundle_id]
    if not apps:
        sys.exit(f'::error::No existe la app {bundle_id} en App Store Connect')
    app_id = apps[0]['id']

    # 1. Esperar a que Apple procese el build (suele tardar 5–20 min).
    build_id = None
    for _ in range(60):
        _, r = call('GET', '/v1/builds' + q(**{
            'filter[app]': app_id, 'filter[version]': build,
            'filter[preReleaseVersion.version]': version, 'limit': '1',
        }))
        data = r.get('data') or []
        state = data[0]['attributes']['processingState'] if data else 'aún no aparece'
        print(f'{time.strftime("%H:%M")} build {version} ({build}): {state}', flush=True)
        if data and state == 'VALID':
            build_id = data[0]['id']
            break
        if state in ('INVALID', 'FAILED'):
            sys.exit(f'::error::Apple marcó el build como {state}')
        time.sleep(60)
    if not build_id:
        warn('El build no terminó de procesarse en 60 min; envíalo a revisión beta a mano.')
        return

    # 2. «Qué probar» en es-MX (idioma principal de la app).
    text = whats_new()
    s, r = call('POST', '/v1/betaBuildLocalizations', {'data': {
        'type': 'betaBuildLocalizations',
        'attributes': {'locale': 'es-MX', 'whatsNew': text},
        'relationships': {'build': {'data': {'type': 'builds', 'id': build_id}}},
    }})
    if s == 409:  # ya existe: actualizarla
        _, r = call('GET', f'/v1/builds/{build_id}/betaBuildLocalizations')
        loc = [d for d in r.get('data', []) if d['attributes']['locale'] == 'es-MX'][0]
        s, r = call('PATCH', f"/v1/betaBuildLocalizations/{loc['id']}", {'data': {
            'type': 'betaBuildLocalizations', 'id': loc['id'], 'attributes': {'whatsNew': text},
        }})
    must(s, r, 'No se pudo guardar «qué probar»')
    print('✓ «Qué probar» guardado')

    # 3. Agregar al grupo externo (el del enlace público).
    _, r = call('GET', '/v1/betaGroups' + q(**{'filter[app]': app_id, 'filter[name]': group_name}))
    groups = [g for g in r.get('data', []) if not g['attributes']['isInternalGroup']]
    if not groups:
        sys.exit(f'::error::No existe el grupo externo «{group_name}»')
    group = groups[0]
    s, r = call('POST', f"/v1/betaGroups/{group['id']}/relationships/builds",
                {'data': [{'type': 'builds', 'id': build_id}]})
    must(s, r, f'No se pudo agregar el build a «{group_name}»')
    print(f'✓ Agregado a «{group_name}»')

    # 4. Enviar a la revisión beta (reintenta si Apple responde «try again later»).
    for intento in range(1, 7):
        s, r = call('POST', '/v1/betaAppReviewSubmissions', {'data': {
            'type': 'betaAppReviewSubmissions',
            'relationships': {'build': {'data': {'type': 'builds', 'id': build_id}}},
        }})
        if s == 201:
            print(f"✓ Enviado a revisión beta: {r['data']['attributes']['betaReviewState']}")
            break
        if s == 409:  # ya enviado (o no requiere revisión)
            print(f'✓ Ya estaba enviado o no requiere revisión: {detail(r)}')
            break
        print(f'  intento {intento}: {s} {detail(r)}', flush=True)
        time.sleep(120)
    else:
        warn('Apple no aceptó el envío a revisión beta; reintenta desde App Store Connect → '
             f'TestFlight → «{group_name}».')
        return

    link = group['attributes'].get('publicLink')
    if link:
        print(f'Enlace público (funciona al aprobarse): {link}')


if __name__ == '__main__':
    main()
