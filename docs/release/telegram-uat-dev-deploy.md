# DEV UAT-деплой через существующего Telegram-бота

Состояние: **подготовлено и протестировано в изоляции, на сервер не установлено.**
Код: `scripts/release/uat/`.

## 1. Как деплой устроен сейчас

Проверено на сервере только чтением 2026-11-27.

| Элемент | Факт |
|---|---|
| Бот | `/opt/mamago/scripts/deploy_bot.py` (aiogram 3.28.2, long polling), venv `bot_env`, Python 3.12. В репозитории отсутствует |
| Запуск | systemd `mamago-bot.service`, `User=user`, `Group=docker`, `Restart=always`; пользователь входит в `sudo` и `docker` |
| Авторизация | middleware по списку `ADMIN_IDS` из исходника; тип чата не проверяется |
| Команды | только `/start`; дальше кнопки: окружение PROD/DEV, «Обновить до последней», статус, логи. Кнопка отката скрыта, но её обработчики зарегистрированы |
| Обращение к серверу | локально, `subprocess.run(..., shell=True)` на том же хосте |
| Деплой | `bash /opt/mamago/scripts/deploy.sh <env> <tag>`; тег берётся из GHCR |
| `deploy.sh` | `flock /tmp/mamago-deploy.lock` (общий для DEV и PROD); только `<env>-N`; проверяет здоровье и неизменность БД; pull; `migrate`; **`db:seed:system` при каждом деплое**; `up --force-recreate app worker prisma-studio`; проверяет образы и health; пишет `APP_VERSION` |
| Подтверждение | нет: одно нажатие запускает деплой, в том числе PROD |
| Журнал | только journald и картинка в чате; кто и что запустил, не записывается |
| Откат | вручную: `deploy.sh` со старым тегом. Бэкап БД скрипт не делает |
| Образы | хранилище containerd: ID образа на хосте равен digest манифеста |

Контрольные суммы на момент проверки: `deploy.sh` `ce11f674…77d2`, `deploy_bot.py` `6bcc79ff…60dc`.

## 2. Риски существующего механизма (не исправлялись)

| Pri | Риск |
|---|---|
| P1 | Токен бота и токен GitHub записаны прямо в `deploy_bot.py`; файл читается всеми (`664`, каталог `755`), рядом несколько `.bak`-копий |
| P1 | Деплой PROD запускается одним нажатием без подтверждения |
| P1 | Значения из `callback_data` подставляются в shell-команды (`env`, тег отката, имя сервиса логов). Доступно только пользователям из `ADMIN_IDS`, но подделанный callback даст выполнение команд на хосте |
| P2 | `/opt/mamago/dev` имеет права `777` |
| P2 | Сид справочников выполняется при каждом деплое, включая PROD; бэкапа перед миграциями нет |
| P2 | В чат отправляются 1000 строк логов, возможны персональные данные |
| P2 | Бот работает от пользователя с `sudo` и `docker`; чат (личный или групповой) не проверяется |
| P2 | Нет журнала действий |
| — | DEV и PROD на одном хосте и в одном Docker |

## 3. Новая процедура

| Команда | Действие |
|---|---|
| `/uat_status` | текущие образы и health DEV, БД, диск, образ отката. Только чтение |
| `/uat_preflight` | все проверки. Только чтение |
| `/uat_deploy` | preflight → отчёт → кнопка подтверждения на 5 минут |
| `/uat_rollback` | проверки отката → отчёт → отдельная кнопка |

Защиты: отдельный allowlist `access.json`; только личный чат этого же пользователя; команды не принимают аргументов; подтверждение одноразовое, привязано к пользователю, чату и отпечатку состояния (образы, БД, конфигурация, `.env`, бэкап); любое изменение состояния отменяет его; одна операция одновременно и общий с `deploy.sh` замок; процесс запускается без shell с фиксированными аргументами и чистым окружением; вывод очищается от секретов.

Preflight проверяет: нет лишних Compose-файлов; `dev-db-1` healthy; app и worker на `dev-1329`; override меняет только образы `app`, `worker`, `migrate`; `APP_ENV=dev`, релизные флаги выключены, `TRUST_PROXY_HEADERS=true`, три тарифа Boost заданы; образ отката есть локально; свободно не меньше 10 ГБ; тег в GHCR указывает на разрешённый digest, а образ имеет нужные архитектуру, SHA, Build ID и содержимое; в БД нет неизвестных или упавших миграций, ожидается только `20261126144500_booking_request_reference_number`; подписанное подтверждение бэкапов.

Деплой: pull по digest → проверка образа → сохранение предыдущего состояния → `migrate` отдельно (ошибка = app и worker не трогаются) → проверка миграций → `up --no-deps app worker` → одинаковый образ, нет перезапусков, `[worker] started`, внутренний и публичный health с SHA и Build ID → `dev-db-1` и контейнеры PROD не изменились. **Seed не выполняется**, `prisma-studio` не пересоздаётся, `.env` не меняется, `down` и `prune` не используются.

Откат: только `app` и `worker` на локальный `dev-1329` из основного Compose-файла; без миграций и без восстановления БД. Схема остаётся новой: колонка `requestNumber` имеет `DEFAULT`, поэтому старое приложение продолжает создавать заявки (проверено по схеме, не запуском старого приложения). Восстановление дампа — отдельная операция с отдельным разрешением.

### Подтверждение бэкапов

Бэкапы лежат на Mac. Сервер принимает только манифест, подписанный SSH-ключом владельца (`ssh-keygen -Y`), с суммами и размерами БД и медиа, отметкой о проверке восстановления, ID контейнера `dev-db-1`, digest релиза и ID образа отката. Возраст считается от времени создания дампа, предел 24 часа. Это подтверждение владельца: сам сервер файлы бэкапов не видит. Данные, записанные после дампа, в него не входят.

### Пока UAT развёрнут

Не нажимать в боте «Обновить до последней» для DEV: `deploy.sh` заменит RC3 обычной сборкой. Шапка бота покажет для DEV digest и `⚠️ ENV=dev-1329` — это ожидаемо. Пока идёт операция UAT, обычный деплой (в том числе PROD) получит «другой deploy уже выполняется».

## 4. Установка без остановки PROD

Каждый шаг выполняет владелец после отдельного решения. Контейнеры PROD и DEV не перезапускаются; перезапускается только сервис бота (панель недоступна несколько секунд, `drop_pending_updates=True` отбрасывает неотвеченные нажатия). Не делать во время деплоя.

1. Один раз создать на Mac ключ подписи:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/mamago_uat_backup -C uat-backup
```

2. Скопировать файлы из проверенного коммита:

```bash
ssh mamago-prod 'install -d -m 700 /opt/mamago/uat /opt/mamago/uat/attestation'
```

```bash
scp scripts/release/uat/{deploy-uat-dev.sh,release.conf,migrations.txt,uat_core.py,uat_bot.py,install-uat-bot.py} mamago-prod:/opt/mamago/uat/
```

```bash
echo "uat-backup $(cat ~/.ssh/mamago_uat_backup.pub)" | ssh mamago-prod 'cat > /opt/mamago/uat/allowed_signers && chmod 600 /opt/mamago/uat/allowed_signers && chmod 700 /opt/mamago/uat/deploy-uat-dev.sh'
```

3. На сервере создать `/opt/mamago/uat/access.json` с одним своим Telegram ID, права `600`: `{"user_ids": [ВАШ_ID]}`.

4. Подписать бэкапы (ID контейнера — из `ssh mamago-prod 'docker inspect --format "{{.Id}}" dev-db-1'`) и передать подтверждение:

```bash
bash scripts/release/uat/make-backup-attestation.sh ~/mamago-backups/dev-rc3-20261127/dev-db-1-20261127-182703.sql.gz ~/mamago-backups/dev-rc3-20261127/dev-media-20261127.tar.gz ~/.ssh/mamago_uat_backup <DB_CONTAINER_ID> --restore-check-passed
```

```bash
scp ~/mamago-backups/dev-rc3-20261127/backup.manifest{,.sig} mamago-prod:/opt/mamago/uat/attestation/
```

5. Ручной preflight на сервере, без бота (только чтение):

```bash
ssh mamago-prod '/opt/mamago/uat/deploy-uat-dev.sh status; /opt/mamago/uat/deploy-uat-dev.sh preflight'
```

6. Подключить команды к боту (сначала проверка без изменений; `--apply` требует текущий sha256 и делает копию):

```bash
ssh mamago-prod 'python3 /opt/mamago/uat/install-uat-bot.py /opt/mamago/scripts/deploy_bot.py --check'
```

```bash
ssh mamago-prod 'python3 /opt/mamago/uat/install-uat-bot.py /opt/mamago/scripts/deploy_bot.py --apply --expected-sha256 <SHA256_ИЗ_CHECK>'
```

```bash
ssh -t mamago-prod 'sudo systemctl restart mamago-bot.service && systemctl is-active mamago-bot.service'
```

Если модуль UAT не загрузится, бот запустится без него и запишет ошибку в журнал. Отмена: `install-uat-bot.py … --revert` и перезапуск сервиса.

7. В личном чате с ботом: `/uat_status`, затем `/uat_preflight`.

## 5. Новый релиз

`release.conf` и `migrations.txt` — единственный allowlist. Меняются только через PR; на сервер копируются вручную.
