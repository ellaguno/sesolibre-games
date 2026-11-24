#!/usr/bin/env python3
"""Llena la ficha del App Store desde docs/ficha-appstore.json por la API de App Store Connect:
categorías, clasificación por edad, nombre/subtítulo/privacidad, versión, textos por idioma,
capturas (assets/appstore/<idioma>/) y la compilación más reciente ya procesada.

Lo que la API no cubre se hace en la web: «Privacidad de la app» (no se recopilan datos),
precio y disponibilidad, y los datos de contacto para la revisión.

Uso: python3 scripts/appstore/asc-ficha.py docs/ficha-appstore.json assets/appstore
(Copia del de sesolibre-sonidos.)
Credenciales: las de asc.py (ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY).
"""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from asc import llamar  # noqa: E402


def localizaciones(ruta: str) -> dict[str, dict]:
    return {l['attributes']['locale']: l for l in llamar('GET', ruta)['data']}


def poner_localizacion(existentes: dict, tipo: str, relacion: str, padre: str, idioma: str, attrs: dict) -> str:
    if idioma in existentes:
        loc = existentes[idioma]
        llamar('PATCH', f'/v1/{tipo}/{loc["id"]}', {'data': {'type': tipo, 'id': loc['id'], 'attributes': attrs}})
        return loc['id']
    padre_tipo = {'appInfoLocalizations': 'appInfos', 'appStoreVersionLocalizations': 'appStoreVersions'}[tipo]
    return llamar('POST', f'/v1/{tipo}', {'data': {'type': tipo, 'attributes': {'locale': idioma, **attrs},
                  'relationships': {relacion: {'data': {'type': padre_tipo, 'id': padre}}}}})['data']['id']


def subir_capturas(version_loc: str, tipo: str, archivos: list[Path]) -> None:
    sets = llamar('GET', f'/v1/appStoreVersionLocalizations/{version_loc}/appScreenshotSets')['data']
    conjunto = next((s for s in sets if s['attributes']['screenshotDisplayType'] == tipo), None)
    if conjunto:  # Se reemplazan: primero se borran las que hubiera.
        for c in llamar('GET', f'/v1/appScreenshotSets/{conjunto["id"]}/appScreenshots')['data']:
            llamar('DELETE', f'/v1/appScreenshots/{c["id"]}')
    else:
        conjunto = llamar('POST', '/v1/appScreenshotSets', {'data': {'type': 'appScreenshotSets',
                          'attributes': {'screenshotDisplayType': tipo},
                          'relationships': {'appStoreVersionLocalization': {'data': {
                              'type': 'appStoreVersionLocalizations', 'id': version_loc}}}}})['data']
    for archivo in archivos:
        datos = archivo.read_bytes()
        c = llamar('POST', '/v1/appScreenshots', {'data': {'type': 'appScreenshots',
                   'attributes': {'fileName': archivo.name, 'fileSize': len(datos)},
                   'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': conjunto['id']}}}}})['data']
        for op in c['attributes']['uploadOperations']:
            trozo = datos[op['offset']:op['offset'] + op['length']]
            req = urllib.request.Request(op['url'], data=trozo, method=op['method'],
                                         headers={h['name']: h['value'] for h in op['requestHeaders']})
            urllib.request.urlopen(req).read()
        llamar('PATCH', f'/v1/appScreenshots/{c["id"]}', {'data': {'type': 'appScreenshots', 'id': c['id'],
               'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(datos).hexdigest()}}})
    print(f'  ✓ {tipo}: {len(archivos)}')


def main() -> None:
    f = json.loads(Path(sys.argv[1]).read_text())
    carpeta = Path(sys.argv[2])
    app = f['app']

    info = next(i for i in llamar('GET', f'/v1/apps/{app}/appInfos')['data']
                if i['attributes'].get('state') != 'READY_FOR_DISTRIBUTION')
    llamar('PATCH', f'/v1/appInfos/{info["id"]}', {'data': {'type': 'appInfos', 'id': info['id'], 'relationships': {
        k: {'data': {'type': 'appCategories', 'id': v}} for k, v in f['categorias'].items()}}})
    print('✓ Categorías:', ', '.join(f['categorias'].values()))

    edad = llamar('GET', f'/v1/appInfos/{info["id"]}/ageRatingDeclaration')['data']
    attrs = {**f['edad']['booleanos'], **{k: 'NONE' for k in f['edad']['ninguno']}, **f['edad'].get('otros', {})}
    llamar('PATCH', f'/v1/ageRatingDeclarations/{edad["id"]}', {'data': {
        'type': 'ageRatingDeclarations', 'id': edad['id'], 'attributes': attrs}})
    print('✓ Clasificación por edad')

    version = next(v for v in llamar('GET', f'/v1/apps/{app}/appStoreVersions')['data']
                   if v['attributes']['appStoreState'] in ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'))
    llamar('PATCH', f'/v1/appStoreVersions/{version["id"]}', {'data': {'type': 'appStoreVersions', 'id': version['id'],
           'attributes': {'versionString': f['version'], 'copyright': f['copyright']}}})
    print(f'✓ Versión {f["version"]}')

    infos = localizaciones(f'/v1/appInfos/{info["id"]}/appInfoLocalizations')
    for idioma, datos in f['idiomas'].items():
        poner_localizacion(infos, 'appInfoLocalizations', 'appInfo', info['id'], idioma, datos['info'])
        # Crear el idioma en appInfo crea también el de la versión: se vuelven a leer.
        versiones = localizaciones(f'/v1/appStoreVersions/{version["id"]}/appStoreVersionLocalizations')
        loc = poner_localizacion(versiones, 'appStoreVersionLocalizations', 'appStoreVersion', version['id'],
                                 idioma, datos['version'])
        print(f'✓ Textos {idioma}')
        for tipo, prefijo in f['capturas'].items():
            archivos = sorted((carpeta / datos['capturas']).glob(f'{prefijo}*.png'))
            if archivos:
                subir_capturas(loc, tipo, archivos)

    builds = [b for b in llamar('GET', f'/v1/builds?filter[app]={app}&sort=-uploadedDate&limit=5')['data']
              if b['attributes']['processingState'] == 'VALID']
    if builds:
        b = builds[0]
        llamar('PATCH', f'/v1/appStoreVersions/{version["id"]}/relationships/build',
               {'data': {'type': 'builds', 'id': b['id']}})
        print(f'✓ Compilación {b["attributes"]["version"]} asignada a la versión')


if __name__ == '__main__':
    main()
