"""The Telegram router through real aiogram dispatching, against fake hosts."""
import asyncio
import datetime as dt
import json
import os
import re
import tempfile
import unittest
from pathlib import Path

from aiogram import Bot, Dispatcher
from aiogram.client.session.base import BaseSession
from aiogram.types import CallbackQuery, Chat, Message, Update, User

from hostfixture import OLD_ID, RELEASE
from network import Network, orchestrator
from mamago_deploy.bot import build_router, read_credential
from mamago_deploy.control import Confirmations

OWNER, STRANGER = 10, 11


class Session(BaseSession):
    def __init__(self):
        super().__init__()
        self.sent = []

    async def make_request(self, bot, method, timeout=None):
        self.sent.append(method)
        if method.__api_method__ in ("sendMessage", "sendDocument", "editMessageReplyMarkup"):
            return Message(message_id=len(self.sent), date=dt.datetime.now(dt.timezone.utc), chat=Chat(id=OWNER, type="private"))
        return True

    async def close(self):
        pass

    async def stream_content(self, *args, **kwargs):
        yield b""


class BotTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        self.network = Network(root)
        self.host = self.network.add("legacy", ("dev", "prod"))
        release = {**RELEASE, "id": "prod-7", "environments": ["prod"], "mode": "standard", "image_tag": "prod-7",
                   "forbidden_true_env": [], "required_nonempty_env": []}
        self.host.write_release(release)
        self.host.attest("prod", release=release)
        self.control, _ = orchestrator(root, self.network)
        access = root / "access.json"
        access.write_text(json.dumps({"owner_ids": [OWNER]}))
        self.now = 0.0

        async def latest(prefix):
            return "dev-9"

        self.session = Session()
        self.bot = Bot(token="123456:" + "x" * 35, session=self.session)
        self.dp = Dispatcher()
        self.dp.include_router(build_router(access, self.control, Confirmations(clock=lambda: self.now), latest))
        self.counter = 0

    async def send(self, text, user=OWNER, chat_type="private", chat_id=None):
        self.counter += 1
        await self.dp.feed_update(self.bot, Update(update_id=self.counter, message=Message(
            message_id=self.counter, date=dt.datetime.now(dt.timezone.utc), text=text,
            chat=Chat(id=chat_id or user, type=chat_type), from_user=User(id=user, is_bot=False, first_name="u"))))

    async def tap(self, data, user=OWNER, chat_type="private", chat_id=None):
        self.counter += 1
        message = Message(message_id=99, date=dt.datetime.now(dt.timezone.utc), chat=Chat(id=chat_id or user, type=chat_type))
        await self.dp.feed_update(self.bot, Update(update_id=self.counter, callback_query=CallbackQuery(
            id=str(self.counter), chat_instance="c", data=data, message=message,
            from_user=User(id=user, is_bot=False, first_name="u"))))

    def texts(self):
        return "\n".join(str(getattr(m, "text", "") or getattr(m, "caption", "") or "") for m in self.session.sent)

    def buttons(self):
        for method in reversed(self.session.sent):
            markup = getattr(method, "reply_markup", None)
            if markup:
                return [b.callback_data for row in markup.inline_keyboard for b in row]
        return []

    def confirm_button(self):
        return next(b for b in self.buttons() if b.startswith("v1:ok:"))

    def code(self):
        return re.findall(r"«((?:PROD|DEV) [0-9A-F]{6})»", self.texts())[-1]

    def submits(self):
        return self.network.count("submit-deploy") + self.network.count("submit-rollback")

    async def test_strangers_and_group_chats_reach_nothing(self):
        for call in (self.send("/start", user=STRANGER), self.send("/uat_deploy", user=STRANGER),
                     self.send("/uat_status", chat_type="supergroup", chat_id=-5), self.tap("v1:releases:prod", user=STRANGER),
                     self.tap("v1:rollback:dev", chat_type="group", chat_id=-5)):
            await call
        self.assertEqual(self.network.sent, [])
        self.assertEqual([m for m in self.session.sent if m.__api_method__ == "sendMessage"], [])

    async def test_forged_legacy_and_injected_callbacks_do_nothing(self):
        for data in ("update_prod", "rollback_confirm_prod_prod-1", "rollback_confirm_dev_$(id)", "logsvc_dev_app;id",
                     "env_prod", "v1:latest:prod;rm", "v1:release:prod:../x", "v1:ok:AAAAAAAAAAAAAAAA", "v1:status:staging",
                     "v1:log:dev:$(id)", "v1:deploy:prod", ""):
            await self.tap(data)
        self.assertEqual(self.network.sent, [])
        self.assertEqual(self.submits(), 0)

    async def test_dev_needs_one_confirmation_and_runs_once(self):
        await self.tap("v1:release:dev:rc3-uat")
        self.assertEqual(self.submits(), 0)
        self.assertIn("Хост:             legacy", self.texts())
        self.assertIn(RELEASE["image_digest"], self.texts())
        button = self.confirm_button()
        await self.tap(button)
        await self.tap(button)
        self.assertEqual(self.submits(), 1)
        self.host.reload()
        self.assertEqual(self.host.image("dev-app-1"), RELEASE["image_digest"])
        self.assertEqual(self.host.image("prod-app-1"), OLD_ID)

    async def test_prod_never_deploys_on_one_tap(self):
        await self.tap("v1:release:prod:prod-7")
        await self.tap(self.confirm_button())
        self.assertEqual(self.submits(), 0, "one tap must not deploy PROD")
        code = self.code()
        self.assertTrue(code.startswith("PROD "))
        await self.send(code)
        await self.send(code)
        self.assertEqual(self.submits(), 1)
        self.host.reload()
        self.assertEqual(self.host.image("prod-app-1"), RELEASE["image_digest"])
        self.assertEqual(self.host.image("dev-app-1"), OLD_ID)

    async def test_prod_wrong_code_cancels(self):
        await self.tap("v1:release:prod:prod-7")
        await self.tap(self.confirm_button())
        code = self.code()
        await self.send("PROD ZZZZZZ")
        await self.send(code)
        self.assertEqual(self.submits(), 0)

    async def test_expired_and_foreign_confirmations(self):
        await self.tap("v1:release:dev:rc3-uat")
        button = self.confirm_button()
        await self.tap(button, user=STRANGER)
        self.now = 301
        await self.tap(button)
        self.assertEqual(self.submits(), 0)

    async def test_switching_environment_voids_the_pending_button(self):
        await self.tap("v1:release:dev:rc3-uat")
        button = self.confirm_button()
        await self.tap("v1:env:prod")
        await self.tap(button)
        self.assertEqual(self.submits(), 0)

    async def test_prod_has_no_latest_and_no_tag_path(self):
        await self.tap("v1:latest:prod")
        self.assertEqual(self.network.sent, [])
        await self.tap("v1:env:prod")
        self.assertNotIn("v1:latest:prod", self.buttons())

    async def test_uat_commands(self):
        for text in ("/uat_deploy prod", "/uat_rollback prod-1", "/uat_status ; id"):
            await self.send(text)
        self.assertEqual(self.network.sent, [])
        await self.send("/uat_preflight")
        await self.send("/uat_status")
        self.assertEqual(self.submits(), 0)
        await self.send("/uat_deploy")
        await self.tap(self.confirm_button())
        self.assertEqual(self.submits(), 1)
        self.assertIn("✅ Успешно", self.texts())
        await self.send("/uat_rollback")
        await self.tap(self.confirm_button())
        self.host.reload()
        self.assertEqual(self.host.image("dev-app-1"), OLD_ID)

    async def test_failed_preflight_offers_no_button(self):
        self.host.state["containers"]["dev-db-1"]["Health"] = "unhealthy"
        self.host.save()
        await self.send("/uat_deploy")
        self.assertFalse([b for b in self.buttons() if b.startswith("v1:ok:")])

    async def test_logs_arrive_redacted_and_are_audited(self):
        await self.tap("v1:log:dev:app")
        document = next(m for m in self.session.sent if m.__api_method__ == "sendDocument")
        body = document.document.data.decode()
        for leak in ("topsecret", "a.person@example.by", "123-45-67"):
            self.assertNotIn(leak, body)
        self.assertIn('"logs"', (self.network.root / "audit.jsonl").read_text())

    async def test_unreachable_host_is_reported_not_hidden(self):
        self.network.down.add("legacy")
        await self.tap("v1:status:dev")
        self.assertIn("Хост не отвечает", self.texts())

    def test_credentials_come_only_from_systemd(self):
        previous = os.environ.pop("CREDENTIALS_DIRECTORY", None)
        try:
            with self.assertRaises(SystemExit):
                read_credential("bot_token")
        finally:
            if previous:
                os.environ["CREDENTIALS_DIRECTORY"] = previous


if __name__ == "__main__":
    unittest.main()
