#!/usr/bin/env bash
# Publica el panel como un sitio más en un nginx que ya está funcionando (por ejemplo, el del VPS de
# Sáez Sánchez, que también publica otros subdominios). No toca los sitios que ya existen: solo agrega
# un archivo para el subdominio del panel, con usuario y contraseña, y le saca el certificado HTTPS.
# Uso, desde la terminal del VPS:
#   cd /opt/coordinacion-de-obras && git pull && bash scripts/publicar_nginx.sh
set -euo pipefail

DESTINO="/opt/coordinacion-de-obras"
CLAVES="/etc/nginx/coordinacion-obras.htpasswd"

if [ "$(id -u)" -ne 0 ]; then echo "Correlo como root (o con sudo)." >&2; exit 1; fi
if ! systemctl is-active --quiet nginx; then echo "nginx no está activo en este servidor: usá scripts/instalar_vps.sh." >&2; exit 1; fi
if [ ! -f "$DESTINO/panel/index.html" ]; then echo "No encuentro el panel en $DESTINO. Bajalo primero con git clone." >&2; exit 1; fi

preguntar() {
  local texto="$1" var="$2" oculto="${3:-}"
  if [ -n "$oculto" ]; then read -r -s -p "$texto" "$var" < /dev/tty; echo; else read -r -p "$texto" "$var" < /dev/tty; fi
}

echo "== 1/4 Apagando Caddy (lo había instalado el instalador anterior y choca con nginx)"
if systemctl list-unit-files caddy.service >/dev/null 2>&1; then
  systemctl disable --now caddy >/dev/null 2>&1 || true
  echo "   Caddy apagado y desactivado. nginx sigue atendiendo todos los sitios."
fi

echo "== 2/4 Datos del sitio"
preguntar "Subdominio [obras.saezsanchez.com.ar]: " DOMINIO
DOMINIO="${DOMINIO:-obras.saezsanchez.com.ar}"
preguntar "Usuario para entrar al panel [coordinacion]: " USUARIO
USUARIO="${USUARIO:-coordinacion}"
case "$USUARIO" in *:*) echo "El usuario no puede tener dos puntos (:)." >&2; exit 1;; esac
while true; do
  preguntar "Contraseña (no se ve al escribir): " CLAVE oculto
  preguntar "Repetila: " CLAVE2 oculto
  if [ -n "$CLAVE" ] && [ "$CLAVE" = "$CLAVE2" ]; then break; fi
  echo "No coinciden o está vacía. Probá de nuevo."
done
# Agrega el usuario (o le cambia la contraseña) sin borrar a los demás. Para más usuarios: scripts/usuarios.sh
touch "$CLAVES"
awk -F: -v u="$USUARIO" '$1 != u' "$CLAVES" > "$CLAVES.tmp" && cat "$CLAVES.tmp" > "$CLAVES" && rm -f "$CLAVES.tmp"
printf '%s:%s\n' "$USUARIO" "$(printf '%s' "$CLAVE" | openssl passwd -apr1 -stdin)" >> "$CLAVES"
chown root:www-data "$CLAVES"
chmod 640 "$CLAVES"

echo "== 3/4 Agregando el sitio $DOMINIO a nginx (los demás sitios no se tocan)"
if [ -d /etc/nginx/sites-available ] && [ -d /etc/nginx/sites-enabled ]; then
  SITIO="/etc/nginx/sites-available/$DOMINIO"
  ENLACE="/etc/nginx/sites-enabled/$DOMINIO"
else
  SITIO="/etc/nginx/conf.d/$DOMINIO.conf"
  ENLACE=""
fi
if [ -f "$SITIO" ] && ! grep -q "Generado por scripts/publicar_nginx.sh" "$SITIO"; then
  echo "Ya existe $SITIO y no lo creó este script: no lo piso. Revisalo a mano." >&2
  exit 1
fi
cat > "$SITIO" <<EOF
# Panel de coordinación de obras. Generado por scripts/publicar_nginx.sh
server {
    listen 80;
    server_name $DOMINIO;

    root $DESTINO/panel;
    index index.html;

    auth_basic "Coordinacion de obras";
    auth_basic_user_file $CLAVES;

    location / {
        try_files \$uri \$uri/ =404;
    }
    location ~ /\. {
        deny all;
    }
}
EOF
[ -n "$ENLACE" ] && ln -sf "$SITIO" "$ENLACE"
if ! nginx -t 2>/tmp/nginx-prueba.txt; then
  cat /tmp/nginx-prueba.txt >&2
  rm -f "$SITIO" ${ENLACE:+"$ENLACE"}
  echo "nginx no aceptó la configuración: la saqué y quedó todo como estaba." >&2
  exit 1
fi
systemctl reload nginx
echo "   Sitio agregado: http://$DOMINIO"

echo "== 4/4 Certificado HTTPS"
if ! command -v certbot >/dev/null || ! certbot plugins 2>/dev/null | grep -q nginx; then
  apt-get install -y -q certbot python3-certbot-nginx >/dev/null
fi
EMAIL_ARGS=(--register-unsafely-without-email)
[ -d /etc/letsencrypt/accounts ] && [ -n "$(ls -A /etc/letsencrypt/accounts 2>/dev/null)" ] && EMAIL_ARGS=()
if certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos --redirect "${EMAIL_ARGS[@]}"; then
  echo
  echo "Listo: https://$DOMINIO"
else
  echo
  echo "El sitio quedó andando por http://$DOMINIO pero no se pudo sacar el certificado."
  echo "Suele pasar si el subdominio todavía no apunta a este servidor. Probá de nuevo en un rato con:"
  echo "  certbot --nginx -d $DOMINIO --redirect"
fi
echo "  Usuario: $USUARIO"
echo "  Mapa del sistema: https://$DOMINIO/mapa.html"
echo "Para agregar otra persona: bash $DESTINO/scripts/usuarios.sh agregar NOMBRE"
echo "Para actualizar el panel: cd $DESTINO && git pull"
