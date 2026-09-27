from __future__ import annotations
import json, sys, urllib.request, urllib.error

VER = "http://127.0.0.1:8000"
OPS = "http://127.0.0.1:3001/api/v1"
STUDENT = "STU-2026-JH-88391"
APP = "APP-2026-ST-84091"

def get(url):
    with urllib.request.urlopen(url, timeout=8) as r:
        return r.status, json.loads(r.read().decode())

def post(url, payload):
    data=json.dumps(payload).encode()
    req=urllib.request.Request(url,data=data,headers={"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(req, timeout=12) as r:
        return r.status, json.loads(r.read().decode())

checks=[]
for name,url in [
    ("verification health", VER+"/health"),
    ("verification documents", VER+f"/students/{STUDENT}/documents"),
    ("operations scholarships", OPS+"/scholarships"),
    ("operations applications", OPS+f"/applications/{APP}"),
]:
    try:
        status, body=get(url); checks.append((name, status < 400, status, body))
    except Exception as e:
        checks.append((name, False, 0, str(e)))

try:
    status, body=post(VER+"/source-records/query", {"system":"STATE_EDISTRICT","student_id":STUDENT,"attributes":["income_annual"],"state":"Jharkhand","authorized":True,"purpose":"SCHOLARSHIP_VERIFICATION"})
    checks.append(("state source query", status < 400 and body.get("success",True), status, body))
except Exception as e: checks.append(("state source query",False,0,str(e)))

for name,ok,status,detail in checks:
    print(f"[{ 'PASS' if ok else 'FAIL'}] {name} ({status})")
    if not ok: print(detail)

raise SystemExit(0 if all(x[1] for x in checks) else 1)
