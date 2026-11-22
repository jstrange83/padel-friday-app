"""Lægger App Store-siden for Padelklubben op i App Store Connect (dansk):
tekster (native/ios/store/listing.json), kategori, kontakt til Apples testere, skærmbilleder (iPhone + iPad)
og vælger det nyeste færdige byg. Sender IKKE til godkendelse. Bruger ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8."""
import os, time, hashlib, glob, json, jwt, requests

KID, ISS, P8 = os.environ['ASC_KEY_ID'], os.environ['ASC_ISSUER_ID'], os.environ['ASC_KEY_P8']
API = 'https://api.appstoreconnect.apple.com/v1'
BUNDLE = 'dk.padelklubben.app'
L = json.load(open('native/ios/store/listing.json', encoding='utf-8'))

def tok():
    now = int(time.time())
    return jwt.encode({'iss': ISS, 'iat': now, 'exp': now + 1100, 'aud': 'appstoreconnect-v1'}, P8, algorithm='ES256', headers={'kid': KID})
def call(method, url, ok404=False, **kw):
    r = requests.request(method, url if url.startswith('http') else API + url, headers={'Authorization': 'Bearer ' + tok()}, **kw)
    if r.status_code >= 300:
        msg = f'{method} {url} -> {r.status_code}: {r.text[:1500]}'
        if ok404: print('ADVARSEL', msg); return {}
        raise SystemExit(msg)
    return r.json() if r.text else {}
def patch(kind, id, attrs=None, rels=None):
    d = {'type': kind, 'id': id}
    if attrs: d['attributes'] = attrs
    if rels: d['relationships'] = rels
    return call('PATCH', f'/{kind}/{id}', json={'data': d})

app = call('GET', f'/apps?filter[bundleId]={BUNDLE}')['data'][0]['id']
vers = call('GET', f'/apps/{app}/appStoreVersions?filter[platform]=IOS')['data']
ver = [v for v in vers if v['attributes']['appStoreState'] in ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED')][0]['id']
print('app', app, 'version', ver)

# Version: copyright
patch('appStoreVersions', ver, {'copyright': L['copyright']})

# Versionens tekster (dansk)
locs = call('GET', f'/appStoreVersions/{ver}/appStoreVersionLocalizations')['data']
vl = next((l for l in locs if l['attributes']['locale'].startswith('da')), locs[0])
patch('appStoreVersionLocalizations', vl['id'], {k: L[k] for k in ('description', 'keywords', 'promotionalText', 'supportUrl', 'marketingUrl')})
print('tekster lagt op', vl['attributes']['locale'])

# App-info: undertitel, privatlivslink, kategori
info = [i for i in call('GET', f'/apps/{app}/appInfos')['data'] if i['attributes'].get('appStoreState') != 'READY_FOR_SALE'][0]
ilocs = call('GET', f"/appInfos/{info['id']}/appInfoLocalizations")['data']
il = next((l for l in ilocs if l['attributes']['locale'].startswith('da')), ilocs[0])
patch('appInfoLocalizations', il['id'], {'name': L['name'], 'subtitle': L['subtitle'], 'privacyPolicyUrl': L['privacyPolicyUrl']})
patch('appInfos', info['id'], rels={'primaryCategory': {'data': {'type': 'appCategories', 'id': 'SPORTS'}},
                                    'secondaryCategory': {'data': {'type': 'appCategories', 'id': 'LIFESTYLE'}}})
print('app-info og kategori sat')

# Kontakt og noter til Apples testere
rv = dict(L['review'])
cur = call('GET', f'/appStoreVersions/{ver}/appStoreReviewDetail', ok404=True).get('data')
if cur: patch('appStoreReviewDetails', cur['id'], rv)
else: call('POST', '/appStoreReviewDetails', json={'data': {'type': 'appStoreReviewDetails', 'attributes': rv,
          'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': ver}}}}})
print('kontakt til Apple sat')

# Skærmbilleder
def shots(pattern, kind):
    sets = call('GET', f"/appStoreVersionLocalizations/{vl['id']}/appScreenshotSets")['data']
    s = next((x for x in sets if x['attributes']['screenshotDisplayType'] == kind), None)
    if s:
        for old in call('GET', f"/appScreenshotSets/{s['id']}/appScreenshots")['data']: call('DELETE', f"/appScreenshots/{old['id']}")
        sid = s['id']
    else:
        sid = call('POST', '/appScreenshotSets', json={'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': kind},
            'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': vl['id']}}}}})['data']['id']
    for path in sorted(glob.glob(pattern)):
        data = open(path, 'rb').read(); name = os.path.basename(path)
        shot = call('POST', '/appScreenshots', json={'data': {'type': 'appScreenshots', 'attributes': {'fileName': name, 'fileSize': len(data)},
            'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': sid}}}}})['data']
        for op in shot['attributes']['uploadOperations']:
            r = requests.request(op['method'], op['url'], data=data[op['offset']:op['offset'] + op['length']], headers={h['name']: h['value'] for h in op['requestHeaders']})
            if r.status_code >= 300: raise SystemExit(f'upload {name}: {r.status_code} {r.text[:300]}')
        patch('appScreenshots', shot['id'], {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()})
        print('lagt op', name)
shots('native/ios/store/iphone-*.png', 'APP_IPHONE_67')
shots('native/ios/store/ipad-*.png', 'APP_IPAD_PRO_3GEN_129')
shots('native/ios/store/watch-*.png', 'APP_WATCH_ULTRA')

# Nyeste færdige byg
builds = call('GET', f'/builds?filter[app]={app}&filter[processingState]=VALID&sort=-uploadedDate&limit=1')['data']
if builds:
    b = builds[0]
    pre = call('GET', f"/builds/{b['id']}/preReleaseVersion")['data']['attributes']['version']
    patch('appStoreVersions', ver, {'versionString': pre})  # versionen i App Store skal passe med bygget (fx 1.0.7)
    print('version sat til', pre)
    if b['attributes'].get('usesNonExemptEncryption') is None:
        patch('builds', b['id'], {'usesNonExemptEncryption': False})
    call('PATCH', f'/appStoreVersions/{ver}/relationships/build', json={'data': {'type': 'builds', 'id': b['id']}})
    print('byg valgt', b['attributes']['version'])
print('færdig')
