#!/usr/bin/env python3
"""Minimal docker stand-in for scenario tests; state in $FAKE_STATE, calls in $FAKE_STATE.log."""
import fcntl
import json
import os
import sys
import time

path = os.environ["FAKE_STATE"]
guard = open(path + ".guard", "a")
fcntl.flock(guard, fcntl.LOCK_EX)
state = json.load(open(path))
argv = sys.argv[1:]
with open(path + ".log", "a") as log:
    log.write(json.dumps(argv) + "\n")


def save():
    with open(path + ".tmp", "w") as stream:
        json.dump(state, stream)
    os.replace(path + ".tmp", path)


def option(name):
    return argv[argv.index(name) + 1] if name in argv else None


def container(name):
    found = state["containers"].get(name) or next((c for c in state["containers"].values() if c["Id"] == name), None)
    if found is None:
        sys.exit(1)
    return found


def switch(project, image_id, image_ref):
    for service in ("app", "worker"):
        state["containers"][f"{project}-{service}-1"].update(
            {"Image": image_id, "ImageRef": image_ref, "Status": "running", "RestartCount": 0})
    other = "prod" if project == "dev" else "dev"
    if state.get("worker_stays_old"):
        state["containers"][f"{project}-worker-1"]["Image"] = state["rollback_id"]
    if state.get("db_recreated_on_up"):
        state["containers"][f"{project}-db-1"]["Id"] = "e" * 64
    if state.get("other_env_changed_on_up"):
        state["containers"][f"{other}-app-1"]["StartedAt"] = "later"
    save()


if argv[0] == "inspect":
    c = container(argv[-1])
    values = {
        "{{.Id}} {{.State.StartedAt}}": f"{c['Id']} {c['StartedAt']}",
        "{{.Id}}": c["Id"],
        "{{.Image}}": c.get("Image", ""),
        "{{if .State.Health}}{{.State.Health.Status}}{{end}}": c.get("Health", ""),
        '{{index .Config.Labels "com.docker.compose.project"}}': c["Project"],
        "{{.State.Status}}": c.get("Status", "running"),
        "{{.RestartCount}}": str(c.get("RestartCount", 0)),
        "{{.Config.Image}}": c.get("ImageRef", ""),
        "{{.Config.Image}} {{.State.Status}}": f"{c.get('ImageRef', '')} {c.get('Status', 'running')}",
        "{{.State.Health.Status}} since {{.State.StartedAt}}": f"{c.get('Health')} since {c['StartedAt']}",
    }
    print(values[option("--format")])
elif argv[:2] == ["image", "inspect"]:
    ref, fmt = argv[-1], option("--format")
    images = state["images"]
    if ref not in images and ref not in images.values():
        sys.exit(1)
    if fmt == "{{.Id}}":
        print(images.get(ref, ref))
    else:
        print(f"linux/amd64 {state['pulled_revision']} PATH=/bin\nBUILD_ID={state['pulled_build_id']}\n")
elif argv[0] == "ps":
    filters = [argv[i + 1] for i, a in enumerate(argv) if a == "--filter"]
    project = filters[0].split("=")[-1]
    if any("compose.oneoff=True" in f for f in filters):
        print("\n".join(state.get("oneoff", {}).get(project, [])))
    else:
        print("\n".join(c["Id"] for c in state["containers"].values() if c["Project"] == project))
elif argv[0] == "info":
    print("/")
elif argv[0] == "buildx":
    if state.get("registry_down"):
        sys.exit(1)
    ref = argv[-1] if "--raw" in argv else argv[3]
    if "--raw" in argv:
        print(json.dumps({"config": {"digest": state["registry_config"]}}))
    elif option("--format") == "{{json .Manifest.Digest}}":
        tag = ref.rsplit(":", 1)[-1]
        print(json.dumps(state.get("tags", {}).get(tag, state["registry_digest"])))
    else:
        print(json.dumps({"os": "linux", "architecture": "amd64", "config": {
            "Labels": {"org.opencontainers.image.revision": state["registry_revision"]},
            "Env": [f"GIT_COMMIT_SHA={state['registry_revision']}", f"BUILD_ID={state['registry_build_id']}"]}}))
elif argv[0] == "pull":
    state["images"][argv[1]] = state["pulled_id"]
    save()
elif argv[0] == "logs":
    print(state.get("worker_log", "[worker] started"))
elif argv[0] == "exec":
    if "node" in argv:
        project = argv[1].split("-")[0]
        image = state["containers"][f"{project}-app-1"]["Image"]
        print(json.dumps(state["health"].get(image, {"status": "error"})), end="")
    elif "pg_dump" in argv[-1]:
        if state.get("dump_hangs"):
            fcntl.flock(guard, fcntl.LOCK_UN)
            print("-- partial data", flush=True)
            time.sleep(state["dump_hangs"])
            sys.exit(0)
        print("partial" if state.get("dump_fails") else "-- data\n-- PostgreSQL database dump complete\n--")
    else:
        if state.get("db_query_fails"):
            sys.exit(1)
        print(state.get("broken_migrations", 0) if "count(*)" in argv[-1] else "\n".join(state["applied"]))
elif argv[0] == "compose":
    project = option("--project-name")
    assert project in ("dev", "prod")
    files = [argv[i + 1] for i, a in enumerate(argv) if a == "-f"]
    pinned = open(files[1]).read().split('image: "')[1].split('"')[0] if len(files) > 1 else None
    if "config" in argv:
        services = json.loads(json.dumps(state["compose"]))
        if pinned:
            for name in ("app", "worker", "migrate"):
                services[name]["image"] = pinned
            if state.get("override_touches_db"):
                services["db"]["image"] = "postgres:17"
        print(json.dumps({"name": project, "services": services, "volumes": {}, "networks": {}}))
    elif "logs" in argv:
        print("user a.person@example.by phone +375 29 123-45-67 DATABASE_URL=postgresql://u:topsecret@db/x ok")
    elif "run" in argv:
        assert "--no-deps" in argv
        if argv[-1] == "migrate":
            if state.get("migration_slow"):
                fcntl.flock(guard, fcntl.LOCK_UN)
                time.sleep(state["migration_slow"])
                sys.exit(0)
            if state.get("migration_fails"):
                sys.exit(1)
            state["applied"] = sorted(set(state["applied"]) | set(state["release_migrations"]))
            save()
        else:
            assert argv[-3:] == ["app", "pnpm", "db:seed:system"]
    elif "up" in argv:
        assert "--no-deps" in argv and argv[-2:] == ["app", "worker"]
        if state.get("up_fails"):
            sys.exit(1)
        ids = state["images"]
        switch(project, ids.get(pinned, pinned if pinned in ids.values() else state["pulled_id"]), pinned)
    else:
        sys.exit(2)
else:
    sys.exit(2)
