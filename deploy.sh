#!/bin/bash
# =============================================================================
# Comparity — Deploy Script
# Запускать на сервере: bash deploy.sh
# =============================================================================

set -e

echo "=== Comparity Deploy ==="

# --------------------------------------------------------------------------
# НАСТРОЙКИ — ЗАПОЛНИ ЭТИ ЗНАЧЕНИЯ
# --------------------------------------------------------------------------
BOT_TOKEN="ТВОЙ_BOT_TOKEN_СЮДА"
BOT_WEBHOOK_URL="https://89.58.41.214"   # или твой домен, напр. https://comparity.com
MINI_APP_URL="https://89.58.41.214"      # URL фронтенда (тот же хост)
JWT_SECRET="$(openssl rand -hex 32)"     # генерируется автоматически
# --------------------------------------------------------------------------

REPO_URL="https://github.com/mixbez/comparity"
APP_DIR="/opt/comparity"

# 1. Установка зависимостей
echo "[1/6] Установка Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin || apt-get install -y docker-compose
fi

echo "[2/6] Установка git, nginx, certbot..."
apt-get update -qq
apt-get install -y git nginx certbot python3-certbot-nginx openssl

# 2. Клонирование репозитория
echo "[3/6] Клонирование репозитория..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout claude/telegram-game-mvp-W3VmP
  git pull origin claude/telegram-game-mvp-W3VmP
else
  git clone -b claude/telegram-game-mvp-W3VmP "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# 3. Создание .env файла
echo "[4/6] Создание .env..."
cat > "$APP_DIR/.env" <<EOF
BOT_TOKEN=${BOT_TOKEN}
BOT_WEBHOOK_URL=${BOT_WEBHOOK_URL}
MINI_APP_URL=${MINI_APP_URL}
JWT_SECRET=${JWT_SECRET}
EOF

echo "JWT_SECRET сохранён: ${JWT_SECRET}"

# 4. Настройка nginx как reverse proxy с SSL termination
echo "[5/6] Настройка nginx..."
cat > /etc/nginx/sites-available/comparity <<'NGINX'
server {
    listen 80;
    server_name _;

    # Webhook и API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE поддержка
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    location /webhook {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Фронтенд
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
NGINX

ln -sf /etc/nginx/sites-available/comparity /etc/nginx/sites-enabled/comparity
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 5. Запуск через Docker Compose
echo "[6/6] Запуск контейнеров..."
cd "$APP_DIR"

# Остановить старые контейнеры если есть
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true

# Билд и запуск
docker compose up -d --build 2>/dev/null || docker-compose up -d --build

echo ""
echo "=== Деплой завершён! ==="
echo ""
echo "Статус контейнеров:"
docker compose ps 2>/dev/null || docker-compose ps

echo ""
echo "Логи бэкенда (последние 30 строк):"
sleep 5
docker compose logs --tail=30 backend 2>/dev/null || docker-compose logs --tail=30 backend

echo ""
echo "Приложение доступно:"
echo "  Фронтенд: ${MINI_APP_URL}"
echo "  API:      ${BOT_WEBHOOK_URL}/api"
echo "  Webhook:  ${BOT_WEBHOOK_URL}/webhook"
