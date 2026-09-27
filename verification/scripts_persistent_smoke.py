from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "data" / "step8_smoke.db"
if DB.exists():
    DB.unlink()
DB.parent.mkdir(exist_ok=True)

env = dict(os.environ)
env["SIH_STORAGE_BACKEND"] = "sqlite"
env["SIH_STORAGE_PATH"] = str(DB)


def run(script: str, extra_env: dict[str, str] | None = None) -> str:
    process_env = dict(env)
    if extra_env:
        process_env.update(extra_env)
    return subprocess.check_output([sys.executable, "-c", script], cwd=str(ROOT), env=process_env, text=True)

first = json.loads(run(r'''
import json
from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
consent=client.post("/consents", json={"student_id":"stu_001","purpose":"DOCUMENT_VERIFICATION"}).json()["data"]
doc=client.post("/documents", json={"student_id":"stu_001","application_id":"app_smoke8","document_type":"ST_CERTIFICATE","source":"USER_UPLOAD","status":"UPLOADED","storage_ref":"secure://doc/smoke8"}).json()["data"]
src=client.post("/source-records/query", json={"system":"DIGILOCKER","student_id":"stu_001","attributes":["full_name","date_of_birth","category"],"authorized":True,"purpose":"DOCUMENT_VERIFICATION","consent_id":consent["consent_id"],"application_id":"app_smoke8"}).json()["data"]
ver=client.post("/verifications/run", json={"application_id":"app_smoke8","student_id":"stu_001","submitted_attributes":{"full_name":"Asha Kumar","date_of_birth":"2005-08-14","category":"ST"},"source_records":[src],"document_ids":[doc["document_id"]]}).json()["data"]
case=client.get("/investigations/app_smoke8").json()["data"]
print(json.dumps({"consent_id":consent["consent_id"],"document_id":doc["document_id"],"verification_count":len(case["verifications"]),"exception_count":len(case["exceptions"]),"observation_count":len(client.get("/source-observations/"+src["source_reference"]).json()["data"]) }))
'''))

assert first["verification_count"] == 3
assert first["observation_count"] == 1
assert first["exception_count"] == 0

second = json.loads(run(r'''
import json, os
from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
doc=client.get("/documents/"+os.environ["SMOKE_DOC_ID"]).json()
case=client.get("/investigations/app_smoke8").json()
print(json.dumps({"document_found":doc["success"],"documents":len(case["data"]["documents"]),"verifications":len(case["data"]["verifications"]),"exceptions":len(case["data"]["exceptions"])}))
''', {"SMOKE_DOC_ID": first["document_id"]}))
assert second == {"document_found": True, "documents": 1, "verifications": 3, "exceptions": 0}
assert DB.exists()
print("persistent restart smoke: PASS")
