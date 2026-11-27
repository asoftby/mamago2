# Runbook’и системы деплоя

Каждый шаг выполняется только после разрешения владельца. **СТОП** — условие, при котором дальше не идти.
Обозначения: `HOST` — SSH-алиас администратора (сейчас `mamago-prod`); команды запускаются из корня репозитория на проверенном коммите.

## 0. Немедленные меры для действующего бота (без новой системы)

```bash
ssh HOST 'cd /opt/mamago/scripts && chmod 600 deploy_bot.py deploy_bot.py*bak* deploy_bot.py.2* && rm -rf __pycache__'
```

`__pycache__` создаётся заново. Копии не удаляются. Контроль: бот отвечает на `/start`. **СТОП:** бот не отвечает → `chmod 640` и разбор.
До установки новой системы не пользоваться кнопками PROD без необходимости; включить в Telegram облачный пароль (2FA).

## 1. Первичная установка (текущий сервер)

Предусловия: PR влит, CI зелёный, не идёт деплой.

1. Пользователи (бот без docker и sudo; исполнитель в docker):

```bash
ssh -t HOST 'sudo useradd --system --home /var/lib/mamago-deploy-bot --shell /usr/sbin/nologin mamago-bot && sudo useradd --system --create-home --shell /bin/sh -G docker mamago-exec'
```

2. Каталоги и код:

```bash
scp -r scripts/release/deploybot HOST:/tmp/deploybot
```

```bash
ssh -t HOST 'cd /tmp/deploybot && sudo install -d -m 755 /opt/mamago-deploy /etc/mamago-deploy /etc/mamago-deploy/releases && sudo cp -r mamago_deploy /opt/mamago-deploy/ && sudo install -m 755 gate deploy-uat-dev.sh /opt/mamago-deploy/ && sudo install -m 644 releases/* /etc/mamago-deploy/releases/ && sudo install -m 644 examples/host.legacy.json /etc/mamago-deploy/host.json && sudo install -m 644 examples/registry.json /etc/mamago-deploy/registry.json && sudo install -d -o mamago-exec -m 750 /var/lib/mamago-deploy && sudo install -m 644 systemd/tmpfiles-mamago-deploy.conf /etc/tmpfiles.d/mamago-deploy.conf && sudo python3 -m venv /opt/mamago-deploy/venv && sudo /opt/mamago-deploy/venv/bin/pip install -r requirements.txt'
```

`deploy-uat-dev.sh` лежит рядом с пакетом, поэтому работает из `/opt/mamago-deploy`.

3. Доступ исполнителя к Compose и `.env` (ACL, владелец и режим не меняются):

```bash
ssh -t HOST 'for e in dev prod; do sudo setfacl -m u:mamago-exec:rx /opt/mamago/$e && sudo setfacl -m u:mamago-exec:r /opt/mamago/$e/docker-compose.yml && sudo setfacl -m u:mamago-exec:rw /opt/mamago/$e/.env; done'
```

Для DEV сервис app читает и `.env.dev-cron`: дать на него `r`. Доступ к GHCR: `sudo -u mamago-exec docker login ghcr.io` с отдельным токеном `read:packages`.
**СТОП:** `sudo -u mamago-exec docker compose --project-directory /opt/mamago/dev -f /opt/mamago/dev/docker-compose.yml config -q` завершается ошибкой.

4. Ключи по одному на окружение и закрепление host key:

```bash
ssh -t HOST 'sudo install -d -m 700 -o mamago-bot /etc/mamago-deploy/keys && for e in dev prod; do sudo -u mamago-bot ssh-keygen -q -t ed25519 -N "" -f /etc/mamago-deploy/keys/legacy-$e; done && echo "127.0.0.1 $(cut -d" " -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)" | sudo tee /etc/mamago-deploy/keys/known_hosts'
```

Публичные ключи добавить в `~mamago-exec/.ssh/authorized_keys` по образцу `systemd/authorized_keys.example`.
**СТОП:** `sudo -u mamago-bot ssh -i …/legacy-dev mamago-exec@127.0.0.1 id` выводит `uid=` — forced command не действует.

5. Ключ подписи бэкапов (на Mac) и `allowed_signers`:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/mamago_uat_backup -C uat-backup
```

```bash
echo "uat-backup $(cat ~/.ssh/mamago_uat_backup.pub)" | ssh -t HOST 'sudo tee /etc/mamago-deploy/allowed_signers >/dev/null'
```

6. `/etc/mamago-deploy/access.json`: `{"owner_ids": [ВАШ_ID]}`, `644`, владелец root.
7. Секреты — см. §2.
8. Проверка без бота (ничего не меняет):

```bash
ssh -t HOST 'cd /opt/mamago-deploy && sudo -u mamago-exec python3 -E -s -B -m mamago_deploy.executor identify dev && sudo -u mamago-exec python3 -E -s -B -m mamago_deploy.executor status dev'
```

**СТОП:** `host_id` не `legacy` или статус не совпадает с реальностью.
9. Переключение бота — см. §3.

## 2. Перенос секретов

Секреты вводятся владельцем с клавиатуры на сервере, не через чат, историю или аргументы:

```bash
ssh -t HOST 'sudo install -d -m 700 /etc/mamago-deploy/secrets && for n in bot_token ghcr_token; do read -rsp "$n: " v; echo; printf %s "$v" | sudo tee /etc/mamago-deploy/secrets/$n >/dev/null; sudo chmod 600 /etc/mamago-deploy/secrets/$n; done'
```

## 3. Переключение на новую версию бота

Предусловия: §1–2 выполнены. Панель недоступна несколько секунд; контейнеры не затрагиваются.

```bash
ssh -t HOST 'sudo cp /etc/systemd/system/mamago-bot.service /etc/systemd/system/mamago-bot.service.legacy && sudo install -m 644 /tmp/deploybot/systemd/mamago-bot.service /etc/systemd/system/mamago-bot.service && sudo systemctl daemon-reload && sudo systemctl restart mamago-bot.service && sleep 5 && systemctl is-active mamago-bot.service && sudo journalctl -u mamago-bot -n 20 --no-pager'
```

Контроль: `/start`, `/uat_status`, статус PROD. **СТОП:** сервис не `active` или в журнале `409 Conflict` → §4.

## 4. Откат бота

```bash
ssh -t HOST 'sudo cp /etc/systemd/system/mamago-bot.service.legacy /etc/systemd/system/mamago-bot.service && sudo systemctl daemon-reload && sudo systemctl restart mamago-bot.service && systemctl is-active mamago-bot.service'
```

Старые `deploy_bot.py` и `deploy.sh` не менялись. После ротации токена старому боту нужен новый токен в его исходнике — поэтому ротацию делать после подтверждения новой версии.

## 5. Ротация Telegram-токена

Только после того как новая версия проработала без замечаний. Перерыв — меньше минуты.
1. BotFather → `/revoke` → новый токен (старый перестаёт работать сразу).
2. §2 только для `bot_token`; `sudo systemctl restart mamago-bot`.
3. Контроль `/start`. **СТОП:** `401 Unauthorized` в журнале → токен введён с ошибкой, повторить.
4. Копии со старым токеном остаются до отдельного разрешения на удаление; после отзыва токен в них недействителен.

## 6. Ротация GitHub-токена

1. GitHub → Settings → Developer settings → Tokens: посмотреть scopes действующего токена (это и есть проверка прав).
2. Создать новый: боту достаточно `read:packages` (список версий). Исполнителю для `docker login` — отдельный `read:packages`. `write`, `repo`, `delete` не нужны.
3. §2 для `ghcr_token`, перезапуск бота, проверить «Обновить до последней» на DEV (до подтверждения не нажимать).
4. Отозвать старый токен. **СТОП перед отзывом:** убедиться, что его не использует `docker login` на сервере и CI.

## 7. Подтверждение бэкапов

Бэкап не старше 24 ч (PROD — 6 ч), восстановление проверено владельцем.

```bash
bash scripts/release/deploybot/make-backup-attestation.sh <db.sql.gz> <media.tar.gz> ~/.ssh/mamago_uat_backup <id контейнера БД> rc3-uat dev legacy --restore-check-passed
```

Передать `backup.manifest` и `.sig` в `/var/lib/mamago-deploy/dev/attestation/` (читаемы `mamago-exec`).
ID контейнера: `ssh HOST 'docker inspect --format "{{.Id}}" dev-db-1'`.

## 8. Preflight, DEV, UAT, PROD

| Задача | Действие | Контрольная точка | СТОП |
|---|---|---|---|
| Preflight | `/uat_preflight` | все `PASS` | любой `FAIL` |
| DEV «последняя» | DEV → Обновить до последней | в отчёте верные SHA, digest | миграции «unknown» и нет уверенности в них |
| UAT | `/uat_deploy` → кнопка | `✅ Успешно`, `/uat_status` показывает Build ID | `❌` или `⚠️` |
| PROD | манифест релиза на хосте → PROD → Утверждённые релизы → кнопка → ввести код | хост, SHA, digest, миграции, откат | что-либо не совпадает с решением о релизе |

Манифест PROD: копия `releases/rc3-uat.json` со своими `id`, `environments: ["prod"]`, `mode: "standard"`, тегом `prod-N`, digest и списком миграций; кладётся владельцем в `/etc/mamago-deploy/releases/`. RC3 на PROD не разрешён.

Пока на DEV стоит UAT, не запускать старый `deploy.sh dev` и «последнюю версию».
Новый образ на хосте имеет ID, равный digest манифеста (хранилище containerd).

## 9. Откат приложения

`/uat_rollback` или DEV/PROD → Откат. Меняются только app и worker на предыдущий локальный образ; миграции не откатываются.
**СТОП:** «release is not rollback compatible» → не обходить, переходить к §10. Не запускать `docker image prune`: откату нужен локальный образ.

## 10. Восстановление базы (отдельное решение владельца)

Автоматически не выполняется никогда. Теряются данные после дампа.
1. Остановить запись: остановить app и worker этого окружения.
2. Сохранить текущую базу ещё одним дампом.
3. Проверить выбранный дамп восстановлением в отдельный контейнер.
4. Восстановить, проверить число таблиц и миграции, запустить app совместимой версии, `/api/health`.
**СТОП:** шаг 2 или 3 не прошёл.

## 11. Потеря связи

| Ситуация | Что делать | Чего не делать |
|---|---|---|
| `⚠️ РЕЗУЛЬТАТ НЕИЗВЕСТЕН` | `/result`, `/uat_status`; на хосте `deploy-uat-dev.sh result <id>` | повторно деплоить, пока состояние не ясно |
| Нет SSH до хоста | консоль провайдера; проверить `sshd`, firewall, ключи | отключать проверку host key |
| `host key verification failed` | сверить отпечаток через консоль провайдера | принимать новый ключ вслепую |
| Нет VPN (hoster.by) | консоль провайдера; control plane на хосте продолжает работать | открывать публичные порты |
| Нет control plane | на хосте: `deploy-uat-dev.sh`, executor, в крайнем случае `deploy.sh` | запускать второй экземпляр бота, не остановив первый |
| Исполнитель прерван (`unknown`) | `executor.log`, `docker compose ps`, `prisma migrate status` | считать успехом |

## 12. Новый хост и переезд

1. ОС, пользователи, Docker, firewall без новых публичных портов (кроме согласованных 80/443).
2. Проверить с хоста доступ к `ghcr.io`, `api.telegram.org`, `api.github.com`.
3. §1 (шаги 2–5) со своим `host_id` в `host.json`; host key сверить через консоль провайдера.
4. В `registry.json` добавить хост, **не** переключая окружения; проверить `identify`.
5. DEV: свежий дамп и медиа → восстановление → тот же digest → `status` и `preflight` → изменить `registry.json` → DNS.
6. Перенос бота: на старом `systemctl disable --now mamago-bot`, затем на новом `enable --now`.
7. Откат переезда: вернуть `registry.json` и DNS; старые тома не удалять до подтверждения стабильности.
**СТОП на любом шаге:** не прошла проверка восстановления; `preflight` не зелёный; два активных бота.
