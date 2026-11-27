"""Telegram UI. Keeps the existing panel (environment, status, latest, logs,
rollback) and adds approved releases and the /uat_* commands.

Handlers know environment names only. Callback data is matched against a fixed
grammar; nothing from Telegram ever becomes part of a command line unchecked.
"""
from __future__ import annotations

import asyncio
import html
import logging
import os
import re
import sys
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import BufferedInputFile, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from .common import Refused, redact
from .config import Registry
from .control import Access, Audit, Busy, Confirmations, Orchestrator, Outcome, Pending
from .transport import Transport, TransportError

log = logging.getLogger("mamago-deploy")

# v1:<verb>[:<env>[:<argument>]]  — anything else, including the old bot's buttons, is ignored.
CALLBACK = re.compile(
    r"^v1:(?:(?P<menu>menu)|(?P<nonce_verb>ok|no):(?P<nonce>[A-Za-z0-9_-]{16})|"
    r"(?P<verb>env|status|latest|releases|rollback|logs):(?P<env>dev|prod)|"
    r"(?P<arg_verb>release|log):(?P<arg_env>dev|prod):(?P<arg>[a-z0-9][a-z0-9.-]{0,29}))$")


def button(text: str, data: str) -> InlineKeyboardButton:
    return InlineKeyboardButton(text=text, callback_data=data)


def keyboard(*rows) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[list(row) for row in rows])


def build_router(access_path: Path, orchestrator: Orchestrator, confirmations: Confirmations, latest_tag) -> Router:
    router = Router(name="deploy")

    def allowed(user, chat) -> bool:
        return Access.load(access_path).allows(getattr(user, "id", None), getattr(chat, "id", None), getattr(chat, "type", None))

    async def say(message: Message, title: str, lines: list | None = None, markup=None):
        body = redact("\n".join(lines or [])).strip()
        head = f"<b>{html.escape(title)}</b>"
        if len(body) > 3000:
            await message.answer_document(BufferedInputFile(body.encode(), filename="report.txt"), caption=head,
                                          parse_mode="HTML", reply_markup=markup)
        else:
            await message.answer(head + (f"\n<pre>{html.escape(body)}</pre>" if body else ""), parse_mode="HTML", reply_markup=markup)

    def main_menu():
        names = orchestrator.registry().environments
        return keyboard(*[[button(("🚀 " if n == "prod" else "🧪 ") + n.upper(), f"v1:env:{n}")] for n in sorted(names, reverse=True)])

    def env_menu(env: str):
        registry = orchestrator.registry()
        rows = [[button("📊 Статус", f"v1:status:{env}")]]
        if registry.allows(env, "deploy"):
            if "latest_tag_prefix" in registry.environment(env):
                rows.append([button("🔄 Обновить до последней", f"v1:latest:{env}")])
            rows.append([button("📦 Утверждённые релизы", f"v1:releases:{env}")])
        if registry.allows(env, "rollback"):
            rows.append([button("⏪ Откат на предыдущую", f"v1:rollback:{env}")])
        if registry.allows(env, "logs"):
            rows.append([button("📄 Логи", f"v1:logs:{env}")])
        rows.append([button("🔙 Меню", "v1:menu")])
        return keyboard(*rows)

    async def offer(message: Message, user_id: int, env: str, action: str, ref: str):
        """Preflight on the target host, then a confirmation bound to what was shown."""
        registry = orchestrator.registry()
        words = ["preflight", ref] if action == "deploy" else ["rollback-preflight"]
        await say(message, f"⏳ Проверки на {env.upper()}…")
        answer = await orchestrator.ask(env, action, words)
        if not answer.get("ok") or not answer.get("fingerprint"):
            orchestrator.audit.write(event="preflight_failed", user=user_id, action=action, env=env, ref=ref)
            await say(message, f"❌ {env.upper()}: проверки не пройдены, операция недоступна", answer.get("report"))
            return
        facts = answer.get("facts", {})
        strict = registry.environment(env)["strict"]
        summary = [
            f"Окружение:        {env.upper()}",
            f"Хост:             {facts.get('host')}",
            f"Операция:         {'ДЕПЛОЙ' if action == 'deploy' else 'ОТКАТ'}" + (f" ({facts.get('mode')})" if facts.get("mode") else ""),
            f"Сейчас:           {facts.get('current')}",
            f"Станет:           {facts.get('target')}",
            f"SHA:              {facts.get('sha')}",
            f"Digest:           {facts.get('digest')}",
            f"Откат на:         {facts.get('rollback')}",
            f"Миграции:         {facts.get('migrations')}",
            f"Откат после них:  {facts.get('rollback_compatible')}",
            f"Бэкап:            {facts.get('backup', '—')}",
        ]
        nonce = confirmations.issue(action=action, env=env, host_id=registry.environment(env)["host"], ref=ref,
                                    fingerprint=answer["fingerprint"], user_id=user_id, chat_id=message.chat.id,
                                    summary=f"{env.upper()} {facts.get('target')}", strict=strict)
        await say(message, f"{'🔴 PROD' if env == 'prod' else '🟡 ' + env.upper()}: проверьте и подтвердите",
                  summary + [""] + answer.get("report", []),
                  keyboard([button(f"✅ Подтвердить {env.upper()}", f"v1:ok:{nonce}"), button("✖️ Отмена", f"v1:no:{nonce}")]))

    async def perform(message: Message, pending: Pending):
        await say(message, f"⏳ Выполняется: {pending.summary}. Не повторяйте команду.")
        try:
            outcome: Outcome = await orchestrator.execute(pending)
        except Busy:
            await say(message, "⏳ Для этого окружения уже выполняется операция. Ничего не запущено.")
            return
        titles = {"succeeded": "✅ Успешно", "failed": "❌ Ошибка — проверьте отчёт", "refused": "⛔ Хост отказал, ничего не запущено",
                  "not_started": "⛔ Не запущено", "unknown": "⚠️ РЕЗУЛЬТАТ НЕИЗВЕСТЕН — это не успех"}
        await say(message, f"{titles.get(outcome.state, outcome.state)}: {pending.summary}", outcome.report + [f"operation {outcome.opid}"],
                  env_menu(pending.env))

    async def guarded(message: Message, work):
        try:
            await work()
        except Refused as refusal:
            await say(message, "⛔ Отказано", [str(refusal)])
        except TransportError as error:
            await say(message, "⚠️ Хост не отвечает", [str(error), "Состояние неизвестно; изменения не выполнялись этой командой."])

    @router.message(Command("start"))
    async def start(message: Message):
        if allowed(message.from_user, message.chat):
            confirmations.cancel(message.from_user.id)
            await message.answer("🛠 <b>Панель управления mamaGo OS</b>\nВыберите окружение:", reply_markup=main_menu(), parse_mode="HTML")

    @router.message(Command("uat_status", "uat_preflight", "uat_deploy", "uat_rollback"))
    async def uat(message: Message, command: CommandObject):
        if not allowed(message.from_user, message.chat):
            return
        if command.args:
            await say(message, "Команды /uat_* не принимают параметров.")
            return

        async def work():
            target = orchestrator.registry().uat
            if not target:
                raise Refused("UAT is not configured")
            env, ref = target["environment"], f"rel:{target['release']}"
            if command.command == "uat_status":
                await say(message, f"{env.upper()}: состояние", (await orchestrator.ask(env, "status", ["status"])).get("report"))
            elif command.command == "uat_preflight":
                answer = await orchestrator.ask(env, "status", ["preflight", ref])
                await say(message, f"{'✅' if answer.get('ok') else '❌'} UAT preflight (рабочие контейнеры и БД не меняются)", answer.get("report"))
            else:
                await offer(message, message.from_user.id, env, "deploy" if command.command == "uat_deploy" else "rollback",
                            ref if command.command == "uat_deploy" else "previous")
        await guarded(message, work)

    @router.message(Command("result"))
    async def result(message: Message):
        if not allowed(message.from_user, message.chat):
            return

        async def work():
            if not orchestrator.last_operation:
                await say(message, "В этой сессии бота операций не было.")
            for env, opid in orchestrator.last_operation.items():
                answer = await orchestrator.ask(env, "status", ["result", opid])
                await say(message, f"{env.upper()}: {answer.get('state')}", answer.get("report"))
        await guarded(message, work)

    @router.message(F.text)
    async def typed(message: Message):
        if not allowed(message.from_user, message.chat) or not confirmations.awaiting(message.from_user.id, message.chat.id):
            return
        pending = confirmations.typed(message.text, message.from_user.id, message.chat.id)
        if pending is None:
            await say(message, "✖️ Код не совпал или истёк. Операция отменена.")
            return
        await guarded(message, lambda: perform(message, pending))

    @router.callback_query()
    async def callbacks(query: CallbackQuery):
        message = query.message
        if message is None or not allowed(query.from_user, message.chat):
            await query.answer()
            return
        match = CALLBACK.fullmatch(query.data or "")
        if not match:
            await query.answer("Кнопка устарела или неизвестна. Откройте /start.", show_alert=True)
            return
        user_id, chat_id = query.from_user.id, message.chat.id
        if match["nonce_verb"]:
            pending = confirmations.press(match["nonce"], user_id, chat_id)
            if pending is None:
                await query.answer("Подтверждение недействительно или устарело.", show_alert=True)
                return
            await query.answer()
            await message.edit_reply_markup(reply_markup=None)
            if match["nonce_verb"] == "no":
                await say(message, "Отменено. Ничего не изменено.")
                return

            async def confirm():
                if orchestrator.registry().environment(pending.env)["strict"]:
                    code = confirmations.require_typed(pending)
                    await say(message, f"Второй шаг для {pending.env.upper()}: отправьте текстом «{code}» в течение 2 минут")
                else:
                    await perform(message, pending)
            await guarded(message, confirm)
            return
        await query.answer()
        if match["menu"]:
            confirmations.cancel(user_id)
            await message.answer("🛠 <b>Панель управления mamaGo OS</b>", reply_markup=main_menu(), parse_mode="HTML")
            return
        env = match["env"] or match["arg_env"]
        verb = match["verb"] or match["arg_verb"]

        async def work():
            orchestrator.registry().environment(env)
            if verb == "env":
                confirmations.cancel(user_id)
                await say(message, f"Окружение {env.upper()}: выберите действие", markup=env_menu(env))
            elif verb == "status":
                await say(message, f"📊 {env.upper()}", (await orchestrator.ask(env, "status", ["status"])).get("report"), env_menu(env))
            elif verb == "releases":
                answer = await orchestrator.ask(env, "deploy", ["releases"])
                rows = [[button(f"{r['id']} · {r['build_id']}", f"v1:release:{env}:{r['id']}")] for r in answer.get("releases", [])]
                await say(message, f"{env.upper()}: утверждённые релизы" if rows else f"{env.upper()}: утверждённых релизов нет",
                          markup=keyboard(*rows, [button("🔙 Назад", f"v1:env:{env}")]))
            elif verb == "release":
                await offer(message, user_id, env, "deploy", f"rel:{match['arg']}")
            elif verb == "latest":
                prefix = orchestrator.registry().environment(env).get("latest_tag_prefix")
                if not prefix:
                    raise Refused(f"{env} deploys only approved releases")
                tag = await latest_tag(prefix)
                if not tag:
                    raise Refused("cannot read the latest build from the registry")
                await offer(message, user_id, env, "deploy", f"tag:{tag}")
            elif verb == "rollback":
                await offer(message, user_id, env, "rollback", "previous")
            elif verb == "logs":
                answer = await orchestrator.ask(env, "logs", ["releases"])
                rows = [[button(f"📦 {s}", f"v1:log:{env}:{s}")] for s in answer.get("log_services", [])]
                await say(message, f"{env.upper()}: выберите сервис", markup=keyboard(*rows, [button("🔙 Назад", f"v1:env:{env}")]))
            elif verb == "log":
                answer = await orchestrator.ask(env, "logs", ["logs", match["arg"]])
                if not answer.get("ok"):
                    raise Refused(answer.get("error", "logs unavailable"))
                orchestrator.audit.write(event="logs", user=user_id, env=env, ref=match["arg"])
                await message.answer_document(
                    BufferedInputFile("\n".join(answer.get("report", [])).encode() or b"[no logs]", filename=f"{env}-{match['arg']}.log"),
                    caption=f"📄 {env.upper()} {match['arg']}: последние строки, персональные данные и секреты замаскированы (по возможности)")
        await guarded(message, work)

    return router


def read_credential(name: str) -> str:
    """systemd LoadCredential: the value is never in the unit, the code or the environment."""
    directory = os.environ.get("CREDENTIALS_DIRECTORY")
    if not directory:
        raise SystemExit("CREDENTIALS_DIRECTORY is not set; start through the systemd unit")
    value = (Path(directory) / name).read_text().strip()
    if not value:
        raise SystemExit(f"credential {name} is empty")
    return value


def ghcr_latest(package: str, token: str):
    async def latest(prefix: str) -> str | None:
        import aiohttp

        pattern = re.compile(rf"^{prefix}-([0-9]{{1,9}})$")
        url = f"https://api.github.com/user/packages/container/{package}/versions?per_page=100"
        headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}"}
        best = None
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
                for _ in range(10):
                    async with session.get(url, headers=headers) as response:
                        if response.status != 200:
                            return None
                        for version in await response.json():
                            for tag in version.get("metadata", {}).get("container", {}).get("tags", []):
                                match = pattern.fullmatch(tag)
                                if match and (best is None or int(match[1]) > best[0]):
                                    best = (int(match[1]), tag)
                        following = response.links.get("next")
                    if not following:
                        break
                    url = str(following["url"])
                    if not url.startswith("https://api.github.com/"):
                        return None
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError):
            return None
        return best[1] if best else None

    return latest


async def serve(config_dir: Path, state_dir: Path):
    registry_path = config_dir / "registry.json"
    Registry.load(registry_path)  # refuse to start on an invalid registry
    if not Access.load(config_dir / "access.json").owner_ids:
        raise SystemExit("access.json authorizes nobody")
    orchestrator = Orchestrator(lambda: Registry.load(registry_path), Transport(), Audit(state_dir / "audit.jsonl"))
    if not orchestrator.audit.verify():
        log.error("the audit log is damaged; keep a copy and investigate")
    bot = Bot(token=read_credential("bot_token"))
    dispatcher = Dispatcher()
    dispatcher.include_router(build_router(config_dir / "access.json", orchestrator, Confirmations(),
                                           ghcr_latest("mamago2", read_credential("ghcr_token"))))
    await bot.delete_webhook(drop_pending_updates=True)
    await dispatcher.start_polling(bot)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(serve(Path("/etc/mamago-deploy"), Path(os.environ.get("STATE_DIRECTORY", "/var/lib/mamago-deploy-bot"))))


if __name__ == "__main__":
    sys.exit(main())
