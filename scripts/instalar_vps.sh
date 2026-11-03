#!/usr/bin/env bash
# Instala o actualiza el panel de seguimiento de obras en un VPS con Ubuntu (22.04 o 24.04).
# Uso, desde la terminal del VPS (como root o con sudo):
#   curl -fsSL https://raw.githubusercontent.com/arquitectura-ssa-git/coordinacion-de-obras/main/scripts/instalar_vps.sh | sudo bash
# Pregunta el subdominio (opcional), un usuario y una contraseña para entrar al panel.
# Se puede volver a correr: actualiza el código y vuelve a escribir la configuración.
set -euo pipefail

REPO="https://github.com/arquitectura-ssa-git/coordinacion-de-obras.git"
DESTINO="/opt/coordinacion-de-obras"

if [ "$(id -u)" -ne 0 ]; then
  echo "Correlo con sudo: ... | sudo bash" >&2
  exit 1
fi

if ! command -v apt-get >/dev/null; then
  echo "Este instalador es para Ubuntu o Debian. En hPanel → VPS → Sistema operativo se puede cambiar a Ubuntu 24.04." >&2
  exit 1
fi

preguntar() {  # las preguntas se leen de la terminal aunque el script llegue por curl | bash
  local texto="$1" var="$2" oculto="${3:-}"
  if [ -n "$oculto" ]; then read -r -s -p "$texto" "$var" < /dev/tty; echo; else read -r -p "$texto" "$var" < /dev/tty; fi
}

echo "== 1/5 Actualizando el servidor e instalando lo necesario"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git ufw curl debian-keyring debian-archive-keyring apt-transport-https gnupg

echo "== 2/5 Firewall: SSH, web (80) y web segura (443)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo "== 3/5 Instalando Caddy (servidor web con HTTPS automático)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

echo "== 4/5 Bajando el panel en $DESTINO"
if [ -d "$DESTINO/.git" ]; then
  git -C "$DESTINO" pull --ff-only
else
  git clone "$REPO" "$DESTINO"
fi

echo "== 5/5 Publicando"
preguntar "Subdominio (ej. obras.saezsanchez.com.ar). Dejalo vacío para usar solo la IP: " DOMINIO
preguntar "Usuario para entrar al panel [coordinacion]: " USUARIO
USUARIO="${USUARIO:-coordinacion}"
while true; do
  preguntar "Contraseña para entrar al panel (no se ve al escribir): " CLAVE oculto
  preguntar "Repetila: " CLAVE2 oculto
  if [ -n "$CLAVE" ] && [ "$CLAVE" = "$CLAVE2" ]; then break; fi
  echo "No coinciden o está vacía. Probá de nuevo."
done
HASH="$(caddy hash-password --plaintext "$CLAVE")"
SITIO="${DOMINIO:-:80}"

cat > /etc/caddy/Caddyfile <<EOF
# Panel de seguimiento de obras. Generado por scripts/instalar_vps.sh
$SITIO {
	root * $DESTINO/panel
	file_server
	encode gzip
	basic_auth {
		$USUARIO $HASH
	}
}
EOF
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl enable caddy >/dev/null 2>&1 || true
systemctl reload caddy || systemctl restart caddy

IP="$(curl -fsS -4 https://api.ipify.org || hostname -I | awk '{print $1}')"
echo
echo "Listo."
if [ -n "$DOMINIO" ]; then
  echo "  Panel:  https://$DOMINIO   (si el subdominio todavía no apunta a $IP, puede tardar hasta una hora)"
else
  echo "  Panel:  http://$IP"
fi
echo "  Mapa del sistema: agregá /mapa.html a la dirección"
echo "  Usuario: $USUARIO"
echo "Para actualizar después: cd $DESTINO && sudo git pull"
