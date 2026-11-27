"""aiogram router adding /uat_status, /uat_preflight, /uat_deploy, /uat_rollback.

Included into the existing mamaGo deploy bot; its PROD and DEV commands are not
changed. DEV only: no command takes an environment, version or any argument.
"""
from __future__ import annotations

import html
from pathlib import Path

from aiogram import F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import BufferedInputFile, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from uat_core import ACTIONS, Access, Busy, Confirmations, Result, Runner

HOME = Path("/opt/mamago/uat")
LABELS = {"deploy": "деплой RC3 на DEV", "rollback": "откат DEV на предыдущий образ"}


def build_router(access_path: Path, runner: Runner, confirmations: Confirmations) -> Router:
    router = Router(name="uat")

    def allowed(user, chat) -> bool:
        # Re-read on every request so removing an id takes effect immediately.
        return Access.load(access_path).allows(getattr(user, "id", None), getattr(chat, "id", None), getattr(chat, "type", None))

    async def report(message: Message, title: str, result: Result, markup=None) -> None:
        body = result.output.strip() or "(no output)"
        head = f"{'✅' if result.code == 0 else '❌'} <b>{html.escape(title)}</b>"
        if len(body) <= 3000:
            await message.answer(f"{head}\n<pre>{html.escape(body)}</pre>", parse_mode="HTML", reply_markup=markup)
        else:
            await message.answer_document(BufferedInputFile(body.encode(), filename="uat-report.txt"),
                                          caption=head, parse_mode="HTML", reply_markup=markup)

    async def guarded(message: Message, command: CommandObject) -> bool:
        if not allowed(message.from_user, message.chat):
            return False
        if command.args:
            await message.answer("Команды /uat_* не принимают параметров.")
            return False
        if runner.busy:
            await message.answer("⏳ Уже выполняется операция UAT. Дождитесь завершения.")
            return False
        return True

    async def read_only(message: Message, command: CommandObject, subcommand: str, title: str) -> None:
        if not await guarded(message, command):
            return
        try:
            result = await runner.run(subcommand, message.from_user.id)
        except Busy:
            await message.answer("⏳ Уже выполняется операция UAT.")
            return
        await report(message, title, result)

    async def request_confirmation(message: Message, command: CommandObject, action: str) -> None:
        if not await guarded(message, command):
            return
        try:
            result = await runner.run(ACTIONS[action], message.from_user.id)
        except Busy:
            await message.answer("⏳ Уже выполняется операция UAT.")
            return
        fingerprint = result.fingerprint
        if not fingerprint:
            await report(message, f"Проверки не пройдены: {LABELS[action]} недоступен", result)
            return
        nonce = confirmations.issue(action, message.from_user.id, message.chat.id, fingerprint)
        keyboard = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text=f"✅ Подтвердить {'деплой' if action == 'deploy' else 'откат'} DEV", callback_data=f"uat:ok:{nonce}"),
            InlineKeyboardButton(text="✖️ Отмена", callback_data=f"uat:no:{nonce}"),
        ]])
        await report(message, f"{LABELS[action]}: проверьте отчёт и подтвердите в течение 5 минут", result, keyboard)

    @router.message(Command("uat_status"))
    async def status(message: Message, command: CommandObject):
        await read_only(message, command, "status", "DEV UAT: состояние")

    @router.message(Command("uat_preflight"))
    async def preflight(message: Message, command: CommandObject):
        await read_only(message, command, "preflight", "DEV UAT: preflight (только чтение)")

    @router.message(Command("uat_deploy"))
    async def deploy(message: Message, command: CommandObject):
        await request_confirmation(message, command, "deploy")

    @router.message(Command("uat_rollback"))
    async def rollback(message: Message, command: CommandObject):
        await request_confirmation(message, command, "rollback")

    @router.callback_query(F.data.startswith("uat:"))
    async def decide(callback: CallbackQuery):
        message = callback.message
        if message is None or not allowed(callback.from_user, message.chat):
            await callback.answer()
            return
        parts = (callback.data or "").split(":")
        pending = confirmations.consume(parts[2], callback.from_user.id, message.chat.id) if len(parts) == 3 else None
        if pending is None:
            await callback.answer("Подтверждение недействительно или устарело.", show_alert=True)
            return
        await callback.answer()
        await message.edit_reply_markup(reply_markup=None)
        if parts[1] != "ok":
            await message.answer("Отменено. Ничего не изменено.")
            return
        await message.answer(f"⏳ Выполняется: {LABELS[pending.action]}…")
        try:
            result = await runner.run(pending.action, callback.from_user.id, pending.fingerprint)
        except Busy:
            await message.answer("⏳ Уже выполняется операция UAT. Ничего не запущено.")
            return
        await report(message, f"DEV UAT: {LABELS[pending.action]}", result)

    return router


def default_router() -> Router:
    return build_router(HOME / "access.json", Runner(HOME / "deploy-uat-dev.sh"), Confirmations())
