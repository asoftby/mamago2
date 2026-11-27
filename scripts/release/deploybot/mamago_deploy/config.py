"""Strict loading of the registry (control plane), host and release files (execution plane).

Unknown keys, wrong types and group- or world-writable files are refused: these
files decide what can be deployed where.
"""
from __future__ import annotations

import json
import os
import re
import stat
from dataclasses import dataclass
from pathlib import Path

from .common import BUILD_TAG, COMMIT, DIGEST, ENV_ID, RELEASE_ID, SERVICE, Refused

OPERATIONS = ("status", "logs", "deploy", "rollback")


def require_protected(path: Path):
    info = os.stat(path)
    if info.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
        raise Refused(f"{path.name}: writable by group or others")
    if info.st_uid not in (0, os.geteuid()):
        raise Refused(f"{path.name}: unexpected owner")


def read_protected_json(path: Path) -> dict:
    try:
        require_protected(path)
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise Refused(f"{path.name}: cannot be read as configuration ({type(error).__name__})") from None
    if not isinstance(data, dict):
        raise Refused(f"{path.name}: not an object")
    return data


def _fields(data, spec: dict, where: str) -> dict:
    """spec: key -> (type, validator or None, required)."""
    if not isinstance(data, dict):
        raise Refused(f"{where}: not an object")
    unknown = set(data) - set(spec)
    if unknown:
        raise Refused(f"{where}: unknown keys {sorted(unknown)}")
    result = {}
    for key, (kind, check, required) in spec.items():
        if key not in data:
            if required:
                raise Refused(f"{where}: missing {key}")
            continue
        value = data[key]
        if type(value) is not kind or (check and not check(value)):
            raise Refused(f"{where}: invalid {key}")
        result[key] = value
    return result


def _re(pattern: str):
    compiled = re.compile(pattern)
    return lambda value: bool(compiled.fullmatch(value))


def _names(pattern):
    return lambda values: all(isinstance(v, str) and pattern.fullmatch(v) for v in values)


ABSOLUTE = _re(r"/[A-Za-z0-9_./-]+")
ENV_NAMES = _names(re.compile(r"[A-Z][A-Z0-9_]{0,60}"))


@dataclass(frozen=True)
class HostConfig:
    path: Path
    data: dict

    @classmethod
    def load(cls, path: Path) -> "HostConfig":
        data = _fields(read_protected_json(path), {
            "host_id": (str, _re(r"[a-z0-9][a-z0-9-]{0,30}"), True),
            "state_dir": (str, ABSOLUTE, True),
            "releases_dir": (str, ABSOLUTE, True),
            "lock_file": (str, ABSOLUTE, True),
            "environments": (dict, None, True),
            "health_attempts": (int, lambda v: 0 < v <= 600, False),
            "health_delay": (int, lambda v: 0 <= v <= 10, False),
            "settle_seconds": (int, lambda v: 0 <= v <= 120, False),
            "dump_timeout": (int, lambda v: 0 < v <= 7200, False),
        }, "host config")
        environments = {}
        projects: set[str] = set()
        for name, raw in data["environments"].items():
            if not ENV_ID.fullmatch(name):
                raise Refused("host config: unknown environment id")
            env = _fields(raw, {
                "compose_dir": (str, ABSOLUTE, True),
                "project": (str, _re(r"[a-z0-9][a-z0-9_-]{0,30}"), True),
                "db_container": (str, _re(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,60}"), True),
                "image_repo": (str, _re(r"[a-z0-9][a-z0-9./:_-]+"), True),
                "tag_deploy": (bool, None, True),
                "log_services": (list, _names(SERVICE), True),
                "public_health_url": (str, _re(r"https://[A-Za-z0-9.-]+/api/health"), True),
                "resolve_public_to": (str, _re(r"[0-9a-f.:]+"), False),
                "required_env": (dict, lambda v: all(ENV_NAMES([k]) and isinstance(x, str) for k, x in v.items()), True),
                "min_free_gb": (int, lambda v: v > 0, True),
                "require_attestation": (bool, None, True),
                "local_dump": (bool, None, True),
                "backup_max_age_hours": (int, lambda v: v > 0, True),
                "attestation_dir": (str, ABSOLUTE, False),
                "allowed_signers": (str, ABSOLUTE, False),
            }, f"environment {name}")
            if env["project"] in projects:
                raise Refused("host config: environments share a Compose project")
            projects.add(env["project"])
            environments[name] = env
        data["environments"] = environments
        return cls(path, data)

    @property
    def host_id(self) -> str:
        return self.data["host_id"]

    def environment(self, name: str) -> dict:
        try:
            return self.data["environments"][name]
        except KeyError:
            raise Refused(f"environment {name} is not hosted on {self.host_id}") from None


def load_release(releases_dir: Path, release_id: str) -> dict:
    if not RELEASE_ID.fullmatch(release_id):
        raise Refused("invalid release id")
    path = releases_dir / f"{release_id}.json"
    release = _fields(read_protected_json(path), {
        "id": (str, lambda v: v == release_id, True),
        "environments": (list, _names(ENV_ID), True),
        "mode": (str, lambda v: v in ("standard", "uat"), True),
        "image_tag": (str, _re(r"[A-Za-z0-9][A-Za-z0-9._-]{0,120}"), True),
        "image_digest": (str, _re(DIGEST.pattern[1:-1]), True),
        "config_digest": (str, _re(DIGEST.pattern[1:-1]), False),
        "source_sha": (str, _re(COMMIT.pattern[1:-1]), True),
        "build_id": (str, _re(r"[A-Za-z0-9][A-Za-z0-9._-]{0,120}"), True),
        "migrations_file": (str, _re(r"[a-z0-9][a-z0-9.-]{0,60}\.migrations"), True),
        "expected_pending": (list, _names(re.compile(r"[0-9]{14}_[a-z0-9_]+")), True),
        "seed": (bool, None, True),
        "rollback_compatible": (bool, None, True),
        "require_attestation": (bool, None, False),
        "forbidden_true_env": (list, ENV_NAMES, False),
        "required_nonempty_env": (list, ENV_NAMES, False),
    }, f"release {release_id}")
    if release["image_tag"] in ("latest", "dev", "prod"):
        raise Refused("release: a floating tag cannot identify a release")
    migrations = releases_dir / release["migrations_file"]
    try:
        require_protected(migrations)
        release["migrations"] = sorted(migrations.read_text(encoding="utf-8").split())
    except OSError:
        raise Refused("release: migration list missing") from None
    release["raw"] = path.read_bytes()
    return release


@dataclass(frozen=True)
class Registry:
    """Which host serves which environment. Telegram handlers only know names from here."""

    hosts: dict
    environments: dict
    uat: dict

    @classmethod
    def load(cls, path: Path) -> "Registry":
        data = _fields(read_protected_json(path), {
            "hosts": (dict, None, True),
            "environments": (dict, None, True),
            "uat": (dict, None, False),
        }, "registry")
        hosts = {}
        for host_id, raw in data["hosts"].items():
            kind = raw.get("type") if isinstance(raw, dict) else None
            if kind == "local":
                hosts[host_id] = _fields(raw, {
                    "type": (str, None, True),
                    "gate": (str, ABSOLUTE, True),
                    "sudo_user": (str, _re(r"[a-z_][a-z0-9_-]{0,30}"), False),
                }, f"host {host_id}")
            elif kind == "ssh":
                hosts[host_id] = _fields(raw, {
                    "type": (str, None, True),
                    "address": (str, _re(r"[A-Za-z0-9][A-Za-z0-9.-]{0,120}"), True),
                    "port": (int, lambda v: 0 < v < 65536, True),
                    "user": (str, _re(r"[a-z_][a-z0-9_-]{0,30}"), True),
                    "identity_files": (dict, lambda v: all(ENV_ID.fullmatch(k) and ABSOLUTE(x) for k, x in v.items()), True),
                    "known_hosts": (str, ABSOLUTE, True),
                }, f"host {host_id}")
            else:
                raise Refused(f"host {host_id}: unknown transport")
        environments = {}
        for name, raw in data["environments"].items():
            if not ENV_ID.fullmatch(name):
                raise Refused("registry: unknown environment id")
            env = _fields(raw, {
                "host": (str, lambda v: v in hosts, True),
                "operations": (list, lambda v: set(v) <= set(OPERATIONS), True),
                "strict": (bool, None, True),
                "latest_tag_prefix": (str, lambda v: v in ("dev",), False),
            }, f"registry environment {name}")
            if name == "prod" and (not env["strict"] or "latest_tag_prefix" in env):
                raise Refused("registry: prod must be strict and cannot follow the latest tag")
            if hosts[env["host"]]["type"] == "ssh" and name not in hosts[env["host"]]["identity_files"]:
                raise Refused(f"registry: no identity for {name} on {env['host']}")
            environments[name] = env
        uat = _fields(data.get("uat", {}), {
            "environment": (str, lambda v: v == "dev", False),
            "release": (str, lambda v: bool(RELEASE_ID.fullmatch(v)), False),
        }, "registry uat")
        return cls(hosts, environments, uat)

    def environment(self, name: str) -> dict:
        try:
            return self.environments[name]
        except KeyError:
            raise Refused("unknown environment") from None

    def allows(self, name: str, operation: str) -> bool:
        return operation in self.environments.get(name, {}).get("operations", ())


__all__ = ["HostConfig", "Registry", "load_release", "read_protected_json", "BUILD_TAG", "OPERATIONS"]
