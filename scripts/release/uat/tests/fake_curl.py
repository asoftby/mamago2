#!/usr/bin/env python3
import json
import os
import sys

state = json.load(open(os.environ["FAKE_STATE"]))
if state.get("public_health_fails"):
    sys.exit(22)
print(json.dumps(state["health"].get(state["containers"]["dev-app-1"]["Image"], {"status": "error"})), end="")
