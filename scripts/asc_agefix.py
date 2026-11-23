"""Retter aldersgrænse-svaret 'Parental Controls' til Nej og sender Padelklubben ind til review igen (ASC API)."""
import os, time, json, jwt, requests
KID, ISS, P8 = os.environ['ASC_KEY_ID'], os.environ['ASC_ISSUER_ID'], os.environ['ASC_KEY_P8']
API = 'https://api.appstoreconnect.apple.com/v1'
def tok():
    n = int(time.time()); return jwt.encode({'iss': ISS, 'iat': n, 'exp': n + 1100, 'aud': 'appstoreconnect-v1'}, P8, algorithm='ES256', headers={'kid': KID})
def call(m, u, **kw):
    r = requests.request(m, u if u.startswith('http') else API + u, headers={'Authorization': 'Bearer ' + tok()}, **kw)
    print(m, u.split('?')[0], r.status_code)
    if r.status_code >= 300: raise SystemExit(r.text[:2000])
    return r.json() if r.text else {}
app = call('GET', '/apps?filter[bundleId]=dk.padelklubben.app')['data'][0]['id']
infos = call('GET', f'/apps/{app}/appInfos')['data']
for info in infos:
    ar = call('GET', f"/appInfos/{info['id']}/ageRatingDeclaration")['data']
    attrs = ar['attributes']
    print('alder:', json.dumps(attrs))
    keys = [k for k in attrs if 'parental' in k.lower()]
    if keys:
        call('PATCH', f"/ageRatingDeclarations/{ar['id']}", json={'data': {'type': 'ageRatingDeclarations', 'id': ar['id'], 'attributes': {k: False for k in keys}}})
        print('rettet:', keys)
vers = call('GET', f'/apps/{app}/appStoreVersions?filter[platform]=IOS')['data']
print('versioner:', [(v['attributes']['versionString'], v['attributes']['appStoreState']) for v in vers])
if os.environ.get('SUBMIT') == '1':
    ver = vers[0]['id']
    subs = call('GET', f'/reviewSubmissions?filter[app]={app}&filter[platform]=IOS')['data']
    print('submissions:', [(s['id'], s['attributes'].get('state')) for s in subs])
    open_sub = next((s for s in subs if s['attributes'].get('state') in ('READY_FOR_REVIEW', 'UNRESOLVED_ISSUES')), None)
    if open_sub and open_sub['attributes']['state'] == 'UNRESOLVED_ISSUES':
        # Den afviste indsendelse annulleres, og versionen sendes ind i en ny
        r = requests.patch(f"{API}/reviewSubmissions/{open_sub['id']}", headers={'Authorization': 'Bearer ' + tok()}, json={'data': {'type': 'reviewSubmissions', 'id': open_sub['id'], 'attributes': {'canceled': True}}})
        print('annuller gammel', r.status_code, r.text[:600])
        time.sleep(20)
        open_sub = None
    if True:
        sid = open_sub['id'] if open_sub else call('POST', '/reviewSubmissions', json={'data': {'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'}, 'relationships': {'app': {'data': {'type': 'apps', 'id': app}}}}})['data']['id']
        if not open_sub:
            call('POST', '/reviewSubmissionItems', json={'data': {'type': 'reviewSubmissionItems', 'relationships': {'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': sid}}, 'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': ver}}}}})
        call('PATCH', f'/reviewSubmissions/{sid}', json={'data': {'type': 'reviewSubmissions', 'id': sid, 'attributes': {'submitted': True}}})
        print('sendt ind')
