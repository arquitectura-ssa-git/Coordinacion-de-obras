#!/usr/bin/env bash
# Usuarios que pueden entrar al panel en el VPS (la contraseña que pide el navegador al abrirlo).
# Uso, desde la terminal del VPS:
#   bash /opt/coordinacion-de-obras/scripts/usuarios.sh listar
#   bash /opt/coordinacion-de-obras/scripts/usuarios.sh agregar NOMBRE     (si ya existe, le cambia la contraseña)
#   bash /opt/coordinacion-de-obras/scripts/usuarios.sh borrar NOMBRE
# Los cambios valen al instante: no hace falta reiniciar nginx.
set -euo pipefail

CLAVES="${CLAVES:-/etc/nginx/coordinacion-obras.htpasswd}"
ACCION="${1:-}"
USUARIO="${2:-}"

if [ "$(id -u)" -ne 0 ]; then echo "Correlo como root (o con sudo)." >&2; exit 1; fi
touch "$CLAVES"
chown root:www-data "$CLAVES" 2>/dev/null || true
chmod 640 "$CLAVES"

existe() { cut -d: -f1 "$CLAVES" | grep -qxF "$1"; }
sacar() { local tmp; tmp="$(mktemp)"; awk -F: -v u="$1" '$1 != u' "$CLAVES" > "$tmp"; cat "$tmp" > "$CLAVES"; rm -f "$tmp"; }

case "$ACCION" in
  listar)
    if [ -s "$CLAVES" ]; then echo "Pueden entrar al panel:"; cut -d: -f1 "$CLAVES" | sed 's/^/  /'; else echo "No hay usuarios cargados."; fi
    ;;
  agregar)
    [ -n "$USUARIO" ] || { echo "Falta el nombre: bash $0 agregar NOMBRE" >&2; exit 1; }
    case "$USUARIO" in *:*|*" "*) echo "El usuario no puede tener espacios ni dos puntos (:)." >&2; exit 1;; esac
    while true; do
      read -r -s -p "Contraseña para $USUARIO (no se ve al escribir): " CLAVE < /dev/tty; echo
      read -r -s -p "Repetila: " CLAVE2 < /dev/tty; echo
      if [ -n "$CLAVE" ] && [ "$CLAVE" = "$CLAVE2" ]; then break; fi
      echo "No coinciden o está vacía. Probá de nuevo."
    done
    HASH="$(printf '%s' "$CLAVE" | openssl passwd -apr1 -stdin)"
    if existe "$USUARIO"; then sacar "$USUARIO"; ACCION_TXT="Contraseña cambiada"; else ACCION_TXT="Usuario agregado"; fi
    printf '%s:%s\n' "$USUARIO" "$HASH" >> "$CLAVES"
    echo "$ACCION_TXT: $USUARIO. Ya puede entrar al panel."
    ;;
  borrar)
    [ -n "$USUARIO" ] || { echo "Falta el nombre: bash $0 borrar NOMBRE" >&2; exit 1; }
    existe "$USUARIO" || { echo "No existe el usuario $USUARIO." >&2; exit 1; }
    if [ "$(grep -c . "$CLAVES")" -le 1 ]; then echo "Es el único usuario: agregá otro antes de borrarlo." >&2; exit 1; fi
    sacar "$USUARIO"
    echo "Usuario borrado: $USUARIO."
    ;;
  *)
    echo "Uso: bash $0 listar | agregar NOMBRE | borrar NOMBRE" >&2
    exit 1
    ;;
esac
