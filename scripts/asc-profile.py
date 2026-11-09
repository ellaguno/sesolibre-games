#!/usr/bin/env python3
"""Descarga (o crea) el perfil de aprovisionamiento "App Store" por la API de
App Store Connect y lo instala donde lo busca Xcode.

Variables de entorno (secrets del repo):
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (contenido del .p8)
Argumentos:
  asc-profile.py <bundle-id> <nombre-del-perfil>

Si el perfil no existe o ya no está ACTIVE (p. ej. venció o se renovó el
certificado), crea uno nuevo con el certificado "Apple Distribution" vigente.
Imprime solo datos públicos (nombre, UUID, vencimiento); nunca la llave.
Requiere: pip install pyjwt cryptography
"""
from __future__ import annotations

import base64
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


def token() -> str:
    now = int(time.time())
    return jwt.encode(
        {'iss': os.environ['ASC_ISSUER_ID'], 'iat': now, 'exp': now + 600, 'aud': 'appstoreconnect-v1'},
        os.environ['ASC_PRIVATE_KEY'],
        algorithm='ES256',
        headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'},
    )


def call(method: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f'App Store Connect {method} {path} -> {e.code}: {e.read().decode(errors="replace")[:800]}')


def q(**params: str) -> str:
    return '?' + urllib.parse.urlencode(params)


def main() -> None:
    bundle_id, name = sys.argv[1], sys.argv[2]

    profiles = call('GET', '/v1/profiles' + q(**{'filter[name]': name, 'limit': '20'}))['data']
    active = [p for p in profiles if p['attributes']['profileState'] == 'ACTIVE'
              and p['attributes']['profileType'] == 'IOS_APP_STORE']
    if active:
        profile = active[0]
    else:
        bundles = call('GET', '/v1/bundleIds' + q(**{'filter[identifier]': bundle_id}))['data']
        bundles = [b for b in bundles if b['attributes']['identifier'] == bundle_id]
        if not bundles:
            sys.exit(f'No existe el Bundle ID {bundle_id} en el portal de Apple.')
        certs = call('GET', '/v1/certificates' + q(**{'filter[certificateType]': 'DISTRIBUTION', 'limit': '20'}))['data']
        if not certs:
            sys.exit('No hay certificado Apple Distribution vigente.')
        # Los perfiles inactivos con el mismo nombre estorban: se borran.
        for p in profiles:
            call('DELETE', f"/v1/profiles/{p['id']}")
        profile = call('POST', '/v1/profiles', {'data': {
            'type': 'profiles',
            'attributes': {'name': name, 'profileType': 'IOS_APP_STORE'},
            'relationships': {
                'bundleId': {'data': {'type': 'bundleIds', 'id': bundles[0]['id']}},
                'certificates': {'data': [{'type': 'certificates', 'id': c['id']} for c in certs]},
            },
        }})['data']
        print(f'Perfil creado de nuevo: {name}')

    attrs = profile['attributes']
    content = base64.b64decode(attrs['profileContent'])
    uuid = attrs['uuid']
    home = Path.home()
    # Xcode 16+ lee de UserData; versiones anteriores, de MobileDevice.
    for d in (home / 'Library/Developer/Xcode/UserData/Provisioning Profiles',
              home / 'Library/MobileDevice/Provisioning Profiles'):
        d.mkdir(parents=True, exist_ok=True)
        (d / f'{uuid}.mobileprovision').write_bytes(content)
    print(f"Perfil instalado: {attrs['name']} ({uuid}), vence {attrs['expirationDate']}")


if __name__ == '__main__':
    main()
