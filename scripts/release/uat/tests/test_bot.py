"""Router behaviour through real aiogram dispatching, with a recorded fake Telegram API."""
import datetime as dt
import json
import sys
import tempfile
import unittest
from pathlib import Path

UAT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(UAT))

from aiogram import Bot, Dispatcher, F  # noqa: E402
from aiogram.client.session.base import BaseSession  # noqa: E402
from aiogram.types import CallbackQuery, Chat, Message, Update, User  # noqa: E402

from uat_bot import build_router  # noqa: E402
from uat_core import Confirmations, Result  # noqa: E402

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


class FakeRunner:
    def __init__(self):
        self.calls = []
        self.busy = False
        self.ready = True

    async def run(self, subcommand, user_id, fingerprint=None):
        self.calls.append((subcommand, fingerprint))
        output = "PREFLIGHT_FINGERPRINT=0123456789abcdef\nRESULT READY" if self.ready else "FAIL dev-db-1 not healthy"
        return Result(0 if self.ready else 1, output)


class RouterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        access = Path(directory.name) / "access.json"
        access.write_text(json.dumps({"user_ids": [OWNER]}))
        self.runner, self.now = FakeRunner(), 0.0
        self.session = Session()
        self.bot = Bot(token="123456:" + "x" * 35, session=self.session)
        self.dp = Dispatcher()
        self.prod_calls = []

        # Stand-in for the existing PROD button handler: UAT callbacks must never reach it.
        @self.dp.callback_query(F.data.startswith("update_"))
        async def existing_update(callback):
            self.prod_calls.append(callback.data)

        self.dp.include_router(build_router(access, self.runner, Confirmations(clock=lambda: self.now)))
        self.counter = 0

    def message(self, user, text, chat_type="private", chat_id=None):
        self.counter += 1
        return Update(update_id=self.counter, message=Message(
            message_id=self.counter, date=dt.datetime.now(dt.timezone.utc), text=text,
            chat=Chat(id=chat_id or user, type=chat_type), from_user=User(id=user, is_bot=False, first_name="u")))

    def tap(self, user, data, chat_type="private", chat_id=None):
        self.counter += 1
        message = Message(message_id=99, date=dt.datetime.now(dt.timezone.utc), chat=Chat(id=chat_id or user, type=chat_type))
        return Update(update_id=self.counter, callback_query=CallbackQuery(
            id=str(self.counter), chat_instance="c", data=data, message=message, from_user=User(id=user, is_bot=False, first_name="u")))

    async def feed(self, update):
        await self.dp.feed_update(self.bot, update)

    def button(self):
        markup = next(m.reply_markup for m in reversed(self.session.sent) if getattr(m, "reply_markup", None))
        return markup.inline_keyboard[0][0].callback_data

    async def test_unauthorized_user_and_group_chat_get_nothing(self):
        for update in (self.message(STRANGER, "/uat_deploy"), self.message(OWNER, "/uat_status", "supergroup", -5),
                       self.tap(STRANGER, "uat:ok:whatever")):
            await self.feed(update)
        self.assertEqual(self.runner.calls, [])
        self.assertEqual([m for m in self.session.sent if m.__api_method__ == "sendMessage"], [])

    async def test_no_command_accepts_arguments_such_as_prod(self):
        for text in ("/uat_deploy prod", "/uat_rollback prod-1124", "/uat_status ; rm -rf /"):
            await self.feed(self.message(OWNER, text))
        self.assertEqual(self.runner.calls, [])

    async def test_deploy_needs_confirmation_and_runs_once(self):
        await self.feed(self.message(OWNER, "/uat_deploy"))
        self.assertEqual(self.runner.calls, [("preflight", None)])
        data = self.button()
        await self.feed(self.tap(OWNER, data))
        await self.feed(self.tap(OWNER, data))
        self.assertEqual(self.runner.calls, [("preflight", None), ("deploy", "0123456789abcdef")])
        self.assertEqual(self.prod_calls, [])

    async def test_expired_confirmation_does_nothing(self):
        await self.feed(self.message(OWNER, "/uat_deploy"))
        self.now = 301
        await self.feed(self.tap(OWNER, self.button()))
        self.assertEqual(self.runner.calls, [("preflight", None)])

    async def test_other_user_cannot_confirm_and_cancel_works(self):
        await self.feed(self.message(OWNER, "/uat_rollback"))
        data = self.button()
        await self.feed(self.tap(STRANGER, data))
        await self.feed(self.tap(OWNER, data.replace("uat:ok:", "uat:no:")))
        await self.feed(self.tap(OWNER, data))
        self.assertEqual(self.runner.calls, [("rollback-preflight", None)])

    async def test_failed_preflight_offers_no_button(self):
        self.runner.ready = False
        await self.feed(self.message(OWNER, "/uat_deploy"))
        self.assertFalse(any(getattr(m, "reply_markup", None) for m in self.session.sent))

    async def test_busy_runner_refuses_new_commands(self):
        self.runner.busy = True
        await self.feed(self.message(OWNER, "/uat_rollback"))
        self.assertEqual(self.runner.calls, [])


if __name__ == "__main__":
    unittest.main()
