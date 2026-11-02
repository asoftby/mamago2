#!/usr/bin/env python3
"""Offline tests of the five-user historical archive parser; no SSH/DB."""
import importlib.util
import io
import tarfile
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("migration-wordpress-five-preview-ssh.py")
SPEC = importlib.util.spec_from_file_location("wp_five_preview", SCRIPT)
if not SPEC or not SPEC.loader:
    raise RuntimeError("Preview source parser is unavailable")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class FiveArchiveTests(unittest.TestCase):
    def archive(self, rows, *, path):
        with tarfile.open(path, "w:gz") as archive:
            data = ("ID\tuser_email\tdisplay_name\tuser_login\tuser_registered\n"
                    + "".join(rows)).encode("utf-8")
            info = tarfile.TarInfo("mamago-wp-audit-20260703/core/users.tsv")
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))

    @staticmethod
    def rows(count=579):
        return [
            str(i) + "\tuser" + str(i) + "@example.org\tUser " + str(i) + "\tlogin\t2026-07-03\n"
            for i in range(1, count + 1)
        ]

    def test_exact_five_source_records_and_no_disk_output(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "audit.tar.gz"
            self.archive(self.rows(), path=path)
            result = MODULE.source_from_archive(path)
            self.assertEqual([x["sourceRecordKey"] for x in result["sourceRecords"]],
                             ["wordpress-db:user:" + str(i) for i in MODULE.TARGET])
            self.assertTrue(all(x["email"].endswith("@example.org")
                                for x in result["sourceRecords"]))
            self.assertEqual(len(result["archiveSha256"]), 64)
            self.assertEqual([x.name for x in Path(folder).iterdir()], ["audit.tar.gz"])

    def test_rejects_incomplete_source_archive(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "audit.tar.gz"
            self.archive(self.rows(578), path=path)
            with self.assertRaisesRegex(RuntimeError, "historical archive coverage"):
                MODULE.source_from_archive(path)

    def test_rejects_duplicate_target_user(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "audit.tar.gz"
            self.archive(self.rows() + [self.rows()[6]], path=path)
            with self.assertRaisesRegex(RuntimeError, "Duplicate WordPress ID"):
                MODULE.source_from_archive(path)


if __name__ == "__main__":
    unittest.main()
