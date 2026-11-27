#!/usr/bin/env python3
"""Minimal docker stand-in for scenario tests; state in $FAKE_STATE, calls in $FAKE_STATE.log."""
import json
import os
import sys

path = os.environ["FAKE_STATE"]
state = json.load(open(path))
argv = sys.argv[1:]
with open(path + ".log", "a") as log:
    log.write(json.dumps(argv) + "\n")


def save():
    json.dump(state, open(path, "w"))


def option(name):
    return argv[argv.index(name) + 1] if name in argv else None


def container(name):
    found = state["containers"].get(name) or next((c for c in state["containers"].values() if c["Id"] == name), None)
    if found is None:
        sys.exit(1)
    return found


def switch(image_id, image_ref):
    for name in ("dev-app-1", "dev-worker-1"):
        state["containers"][name].update({"Image": image_id, "ImageRef": image_ref, "Status": state.get("status_after_up", "running"), "RestartCount": 0})
    if state.get("worker_stays_old"):
        state["containers"]["dev-worker-1"]["Image"] = state["rollback_id"]
    if state.get("db_recreated_on_up"):
        state["containers"]["dev-db-1"]["Id"] = "e" * 64
    if state.get("prod_changed_on_up"):
        state["containers"]["prod-app-1"]["StartedAt"] = "later"
    save()


if argv[0] == "inspect":
    c = container(argv[-1])
    fmt = option("--format")
    values = {
        "{{.Id}} {{.State.StartedAt}}": f"{c['Id']} {c['StartedAt']}",
        "{{.Id}}": c["Id"],
        "{{.Image}}": c.get("Image", ""),
        "{{if .State.Health}}{{.State.Health.Status}}{{end}}": c.get("Health", ""),
        "{{index .Config.Labels \"com.docker.compose.project\"}}": c["Project"],
        "{{.State.Status}}": c.get("Status", "running"),
        "{{.RestartCount}}": str(c.get("RestartCount", 0)),
        "{{.Name}} {{.Id}} {{.State.StartedAt}}": f"/{argv[-1][:12]} {c['Id']} {c['StartedAt']}",
        "{{.Config.Image}} {{.State.Status}}": f"{c.get('ImageRef', '')} {c.get('Status', 'running')}",
        "{{.State.Health.Status}} since {{.State.StartedAt}}": f"{c.get('Health')} since {c['StartedAt']}",
    }
    print(values[fmt])
elif argv[:2] == ["image", "inspect"]:
    ref, fmt = argv[-1], option("--format")
    if ref not in state["images"]:
        sys.exit(1)
    if fmt == "{{.Id}}":
        print(state["images"][ref])
    else:
        print(f"linux/amd64 {state['pulled_revision']} PATH=/bin\nBUILD_ID={state['pulled_build_id']}\n")
elif argv[0] == "ps":
    print("\n".join(c["Id"] for n, c in state["containers"].items() if c["Project"] == "prod"))
elif argv[0] == "info":
    print("/")
elif argv[0] == "buildx":
    ref = argv[-1] if "--raw" in argv else argv[3]
    if "--raw" in argv:
        print(json.dumps({"config": {"digest": state["registry_config"]}}))
    elif option("--format") == "{{json .Manifest.Digest}}":
        print(json.dumps(state["registry_digest"]))
    else:
        print(json.dumps({"os": "linux", "architecture": state.get("arch", "amd64"), "config": {
            "Labels": {"org.opencontainers.image.revision": state["registry_revision"]},
            "Env": [f"GIT_COMMIT_SHA={state['registry_revision']}", f"BUILD_ID={state['registry_build_id']}"]}}))
elif argv[0] == "pull":
    state["images"][argv[1]] = state["pulled_id"]
    save()
elif argv[0] == "logs":
    print(state.get("worker_log", "[worker] started"))
elif argv[0] == "exec":
    if "node" in argv:
        image = state["containers"]["dev-app-1"]["Image"]
        print(json.dumps(state["health"].get(image, {"status": "error"})), end="")
    else:
        if state.get("db_query_fails"):
            sys.exit(1)
        sql = argv[-1]
        print(state.get("broken_migrations", 0) if "count(*)" in sql else "\n".join(state["applied"]))
elif argv[0] == "compose":
    files = [argv[i + 1] for i, a in enumerate(argv) if a == "-f"]
    assert option("--project-name") == "dev", "compose call outside project dev"
    override = next((f for f in files if f.endswith(("compose.uat.yml", "override.yml")) and f != files[0]), None)
    pinned = None
    if override:
        pinned = open(override).read().split('image: "')[1].split('"')[0]
    if "config" in argv:
        services = json.loads(json.dumps(state["compose"]))
        if pinned:
            for name in ("app", "worker", "migrate"):
                services[name]["image"] = pinned
            if state.get("override_touches_db"):
                services["db"]["image"] = "postgres:17"
        print(json.dumps({"name": "dev", "services": services, "volumes": {}, "networks": {}}))
    elif "run" in argv:
        assert "--no-deps" in argv and argv[-1] == "migrate"
        if state.get("migration_fails"):
            sys.exit(1)
        state["applied"] = sorted(set(state["applied"]) | set(state["release_migrations"]))
        save()
    elif "up" in argv:
        assert "--no-deps" in argv and argv[-2:] == ["app", "worker"]
        if state.get("up_fails"):
            sys.exit(1)
        if pinned:
            switch(state["pulled_id"], pinned)
        else:
            tag = os.environ["APP_VERSION"]
            switch(state["images"][f"ghcr.io/asoftby/mamago2:{tag}"], f"ghcr.io/asoftby/mamago2:{tag}")
    else:
        sys.exit(2)
else:
    sys.exit(2)
