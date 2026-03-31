# VPN Service — Xray VLESS + Reality

Приватный VPN-сервис на базе Xray-core с протоколом VLESS + Reality (TLS 1.3).

## Архитектура

| Сервис | Технология | Порт |
|--------|-----------|------|
| **Xray** | teddysun/xray | 443 (VLESS+Reality) |
| **Backend** | Go + Fiber + gRPC | 3000 (internal) |
| **Frontend** | Next.js + Tailwind | 80 → 3000 |

## Быстрый старт (новый сервер)

### Требования
- Ubuntu 22.04+ / Debian 12+
- Docker + Docker Compose v2
- Минимум 1 vCPU, 512MB RAM, 10GB SSD

### Шаг 1: Клонировать репозиторий
```bash
git clone https://github.com/YOUR_USER/vpn-service.git ~/vpn_product
cd ~/vpn_product
```

### Шаг 2: Сгенерировать Reality-ключи
```bash
docker run --rm --entrypoint /usr/bin/xray teddysun/xray:latest x25519 > /tmp/xk.txt 2>&1 && PRIV=$(awk '/rivate/{print $NF}' /tmp/xk.txt) && PUB=$(awk '/ublic/{print $NF}' /tmp/xk.txt) && SHORT=$(openssl rand -hex 8) && IP=$(curl -s ifconfig.me) && echo "PRIV=$PRIV" && echo "PUB=$PUB" && echo "SHORT=$SHORT" && echo "IP=$IP"
```

### Шаг 3: Создать .env и конфиг Xray
```bash
# Подставьте значения из Шага 2:
echo "REALITY_PRIVATE_KEY=ВАШ_PRIV" > .env
echo "REALITY_PUBLIC_KEY=ВАШ_PUB" >> .env
echo "REALITY_SHORT_ID=ВАШ_SHORT" >> .env
echo "SERVER_IP=ВАШ_IP" >> .env

# Создать конфиг Xray (подставьте PRIV и SHORT):
mkdir -p xray
cp xray/config.json.template xray/config.json
sed -i "s/REPLACE_ME_PRIV/ВАШ_PRIV/" xray/config.json
sed -i "s/REPLACE_ME_SHORT/ВАШ_SHORT/" xray/config.json
```

Или вставьте значения вручную в `xray/config.json` (поля `privateKey` и `shortIds`).

### Шаг 4: Обновить docker-compose.yml
Замените в разделе `backend > environment` значения на свои:
```yaml
environment:
  - XRAY_API_ADDR=xray:10085
  - SERVER_IP=ВАШ_IP
  - REALITY_PUBLIC_KEY=ВАШ_PUB
  - REALITY_SHORT_ID=ВАШ_SHORT
```

### Шаг 5: Запуск
```bash
docker compose up -d --build
```

Дашборд будет доступен по адресу `http://ВАШ_IP/`.

## Восстановление из бэкапа

Если вы мигрируете с другого сервера и хотите сохранить существующих пользователей:

```bash
# 1. Скопировать бэкап на новый сервер
scp vpn-backup-ДАТА.tar.gz root@НОВЫЙ_IP:~/

# 2. Распаковать БД (НЕ перезаписывайте .env и config.json — они уже настроены!)
cd ~/vpn_product
tar -xzf ~/vpn-backup-ДАТА.tar.gz --strip-components=1 data/

# 3. Перезапустить backend — он автоматически синхронизирует пользователей
docker compose restart vpn_backend
docker logs vpn_backend | grep SYNC
```

Вы должны увидеть: `[SYNC] Synced N/N active users to Xray`

> **Важно:** При миграции на другой IP нужно сгенерировать новые Reality-ключи.
> Старые VPN-ключи пользователей продолжат работать, но им нужно будет обновить
> конфигурацию в Hiddify (новый IP, новый публичный ключ, новый Short ID).

## API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/keys` | Создать новый VPN-ключ |
| DELETE | `/api/keys/:uuid` | Деактивировать ключ |
| GET | `/api/users` | Список пользователей (последние 50) |
| GET | `/api/logs/download` | Скачать лог-файл сервера |
| GET | `/api/health` | Статус сервера и кол-во пользователей |

## Бэкапы

```bash
# Ручной бэкап
bash backup.sh

# Автоматический бэкап каждый день в 03:00
crontab -e
# Добавить строку:
0 3 * * * /root/vpn_product/backup.sh >> /root/vpn_product/backups/backup.log 2>&1
```

## Экспорт проекта

```bash
bash export_project.sh
# Архив будет создан: ~/vpn_product/vpn-project-export.zip
# Скачать на локальную машину:
scp root@IP:~/vpn_product/vpn-project-export.zip ./
```
