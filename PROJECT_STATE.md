# [PROJECT_STATE] MEMORY SNAPSHOT / CONTEXT DUMP

## 1. [PROJECT OVERVIEW & ARCHITECTURE]
Мы построили портативную, отказоустойчивую инфраструктуру для приватного VPN-сервиса.
- **Core:** Xray-core (VLESS + Reality). Протокол выбран за его максимальную неотличимость от обычного TLS-трафика.
- **Backend:** Go (Fiber + gRPC). Управляет пользователями в SQLite и синхронизирует их с Xray через API.
- **Frontend:** Next.js (Tailwind + Lucide). Минималистичная панель для генерации ключей и скачивания логов.
- **Infrastructure:** Docker Compose. Все зависимости (Xray, Backend, Frontend) изолированы и связаны внутренней сетью.
- **Persistence:** База данных `vpn.db` и конфиги монтируются из `/app/data/` на хост.

---

## 2. [CURRENT PROBLEM: DPI BLOCKING]
### Симптомы (В России):
- **TCP Handshake проходит**, но соединение виснет на этапе "Подключение...".
- В Hiddify (Android) возникает **тайм-аут**. 
- В логах Xray на сервере для IP из РФ: `failed to read client hello`.
- **ВАЖНО:** Из Аргентины и других стран всё работает идеально.
- **94.253.44.171** — это российский ТСПУ Active Probing сканер (Flex Ltd). Атакует каждые 10-30 секунд.

### Проведённые исправления (2026-03-31):
1. **SNI/dest конфликт**: config.json говорил `www.asus.com`, а клиентский URL — `www.microsoft.com`. Оба исправлены на `addons.mozilla.org`.
2. **Flow мismatch**: `xray_manager.go` имел `Flow: ""`, а URL содержал `flow=xtls-rprx-vision`. Сервер теперь тоже использует `xtls-rprx-vision`.
3. **API порт**: `10085` переведён с `0.0.0.0` на `127.0.0.1` — недоступен снаружи.
4. **routeOnly**: `sniffing.routeOnly` переключён на `true` — не перехватывает payload.
5. **loglevel**: снижен с `info` до `warning` — меньше шума, быстрее реакция.

### Гипотезы и проведенные исследования:
1. **IPv6 Leaks:** Исправлено. Xray принудительно шлет трафик через IPv4 (`UseIPv4`), IPv6 заблокирован в роутинге.
2. **SNI-IP Mismatch:** ТСПУ проверяет, соответствует ли домен (SNI) владельцу IP-адреса. **ИСПРАВЛЕНО**: `addons.mozilla.org` — Mozilla CDN, не в блэклисте РФ, поддерживает TLS 1.3.
3. **DPI Fingerprinting:** ТСПУ детектирует специфические TLS-отпечатки. `fp=chrome` (оставлен как наиболее нейтральный для Reality).
4. **Active Probing (TSPU Scanner):** IP `94.253.44.171` активно сканирует каждые 10 сек. Добавлен в `deploy_fix.sh` для блокировки через iptables.

---

## 3. [INFRASTRUCTURE & ACCESS MAP]
- **Рабочая директория:** `~/vpn_product`
- **Порты:**
  - `443` (TCP/UDP) — Вход в VPN (VLESS+Reality).
  - `80` — Веб-панель (прокси на backend:3000).
  - `10085` — Xray API (gRPC, доступен только внутри Docker-сети).
- **Файловая структура на сервере:**
  - `xray/config.json` — Настройки протоколов и SNI (Asus).
  - `backend/app.log` — Логи приложения.
  - `data/vpn.db` — SQLite база пользователей.

---

## 4. [CRITICAL CODEBASE DUMP]

### [docker-compose.yml]
```yaml
version: '3.8'

services:
  xray:
    image: teddysun/xray:latest
    container_name: xray
    restart: always
    volumes:
      - ./xray/config.json:/etc/xray/config.json
    ports:
      - "443:443"
      - "443:443/udp"
    networks:
      - vpn_network

  vpn_backend:
    build: ./backend
    container_name: vpn_backend
    restart: always
    environment:
      - XRAY_API_ADDR=xray:10085
      - SERVER_IP=${SERVER_IP}
      - REALITY_PUBLIC_KEY=${REALITY_PUBLIC_KEY}
      - REALITY_SHORT_ID=${REALITY_SHORT_ID}
    volumes:
      - ./data:/app/data
    depends_on:
      - xray
    networks:
      - vpn_network

  vpn_frontend:
    build: ./frontend
    container_name: vpn_frontend
    restart: always
    ports:
      - "80:3000"
    depends_on:
      - vpn_backend
    networks:
      - vpn_network

networks:
  vpn_network:
    driver: bridge
```

### [xray/config.json]
```json
{
  "log": {"loglevel": "info"},
  "api": {"tag": "api", "services": ["HandlerService", "StatsService", "RoutingService"]},
  "inbounds": [
    {
      "tag": "vless-in", "listen": "0.0.0.0", "port": 443, "protocol": "vless",
      "settings": {"clients": [], "decryption": "none"},
      "streamSettings": {
        "network": "tcp", "security": "reality",
        "realitySettings": {
          "show": false, "dest": "www.asus.com:443", "xver": 0,
          "serverNames": ["www.asus.com"],
          "privateKey": "SERVER_PRIVATE_KEY", "shortIds": ["SERVER_SHORT_ID"]
        }
      },
      "sniffing": {
        "enabled": true,
        "destOverride": ["http", "tls", "quic"],
        "routeOnly": false
      }
    },
    {"tag": "api-in", "listen": "0.0.0.0", "port": 10085, "protocol": "dokodemo-door", "settings": {"address": "127.0.0.1"}}
  ],
  "outbounds": [
    {"protocol": "freedom", "tag": "direct", "settings": {"domainStrategy": "UseIPv4"}},
    {"protocol": "blackhole", "tag": "block"}
  ],
  "routing": {
    "domainStrategy": "UseIPv4",
    "rules": [
      {"inboundTag": ["api-in"], "outboundTag": "api", "type": "field"},
      {"type": "field", "ip": ["::/0"], "outboundTag": "block"}
    ]
  }
}
```

### [backend/xray_manager.go]
```go
package main

import (
	"context"
	"time"

	"github.com/xtls/xray-core/app/proxyman/command"
	"github.com/xtls/xray-core/common/protocol"
	"github.com/xtls/xray-core/common/serial"
	"github.com/xtls/xray-core/proxy/vless"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type XrayManager struct {
	client command.HandlerServiceClient
	conn   *grpc.ClientConn
}

func NewXrayManager(target string) (*XrayManager, error) {
	conn, err := grpc.Dial(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &XrayManager{client: command.NewHandlerServiceClient(conn), conn: conn}, nil
}

func (m *XrayManager) Close() error { return m.conn.Close() }

func (m *XrayManager) AddUser(uuid string, email string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	user := &protocol.User{
		Level: 0,
		Email: email,
		Account: serial.ToTypedMessage(&vless.Account{
			Id:   uuid,
			Flow: "", // Vision flow disabled to allow fragmentation
		}),
	}

	_, err := m.client.AlterInbound(ctx, &command.AlterInboundRequest{
		Tag:       "vless-in",
		Operation: serial.ToTypedMessage(&command.AddUserOperation{User: user}),
	})
	return err
}

func (m *XrayManager) RemoveUser(email string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := m.client.AlterInbound(ctx, &command.AlterInboundRequest{
		Tag:       "vless-in",
		Operation: serial.ToTypedMessage(&command.RemoveUserOperation{Email: email}),
	})
	return err
}
```

---

## 5. [IMPORTANT NOTES FOR CLAUDE]
1. **DPI War:** Мы сейчас находимся в фазе борьбы с ТСПУ. Протоколы Reality+Fragmentation до сих пор могут быть уязвимы на конкретных провайдерах (Flex Ltd).
2. **Current Settings:** SNI: `www.asus.com`, Fingerprint: `android`, MSS: `1300`.
3. **Next Step Idea:** Если Reality не пробьет, стоит рассмотреть переход на **Shadowsocks-2022** или использование **CDN (Cloudflare)** с маскировкой под WebSocket/gRPC.
