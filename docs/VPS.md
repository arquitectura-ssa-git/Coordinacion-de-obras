# Poner el panel en el VPS

Guía para el VPS de Hostinger (**SSA VPS**, IP `143.95.174.234`) o cualquier VPS con **Ubuntu 22.04 o
24.04**. Hay dos partes independientes:

1. **Panel de seguimiento** (10 minutos): la página web con el tablero y la sección Coordinación.
2. **Bot de reporte diario** (opcional, 20 minutos): el bot de Telegram corriendo las 24 h.

## Entrar al VPS

- **Desde Hostinger, sin instalar nada:** en hPanel → VPS → **SSA VPS**, tocá el botón de
  **Acceso rápido** (el ícono de la terminal) o **Administrar → Terminal del navegador**. Se abre una
  terminal ya conectada como `root`.
- **Desde la PC:** `ssh root@143.95.174.234` (la contraseña de root está en hPanel → VPS → Administrar →
  Acceso SSH).

Opcional: un subdominio apuntando a la IP, por ejemplo `obras.saezsanchez.com.ar` (registro **A** en
el DNS del dominio con el valor `143.95.174.234`). Con subdominio, la página sale con HTTPS
automático. Sin subdominio funciona igual por `http://143.95.174.234`.

## Instalar el panel con un solo comando

Pegá esto en la terminal del VPS y apretá Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/arquitectura-ssa-git/coordinacion-de-obras/main/scripts/instalar_vps.sh | sudo bash
```

El script ([`scripts/instalar_vps.sh`](../scripts/instalar_vps.sh)) actualiza el servidor, abre los
puertos 22, 80 y 443, instala Caddy (servidor web con HTTPS automático), baja este repositorio en
`/opt/coordinacion-de-obras` y al final pregunta:

1. **Subdominio**: escribilo, o dejalo vacío para entrar por la IP.
2. **Usuario y contraseña** para entrar al panel, así no queda abierto a cualquiera que tenga el link.

Al terminar muestra la dirección. Abrila, entrá con el usuario y la contraseña, y aparece el tablero.
El mapa del sistema queda en la misma dirección con `/mapa.html` al final.

### Actualizar el panel

Cada vez que haya cambios en el repositorio:

```bash
cd /opt/coordinacion-de-obras && sudo git pull
```

No hace falta reiniciar nada. Para cambiar el usuario, la contraseña o el subdominio, volvé a correr
el comando de instalación.

### Si no carga

- `sudo journalctl -u caddy -n 50` muestra el error de Caddy.
- Hostinger tiene además su propio firewall: en hPanel → VPS → **Seguridad → Firewall**, si hay
  reglas activas, agregá las de los puertos **80** y **443** (TCP, entrada).
- Con subdominio: puede tardar hasta una hora en apuntar a la IP. Mientras tanto, volvé a correr el
  instalador dejando el subdominio vacío y entrá por la IP.

### El paso a paso, sin el script

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git ufw curl debian-keyring debian-archive-keyring apt-transport-https
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
sudo git clone https://github.com/arquitectura-ssa-git/coordinacion-de-obras.git /opt/coordinacion-de-obras
caddy hash-password
sudo nano /etc/caddy/Caddyfile
```

En el Caddyfile, reemplazá todo por esto (`:80` o tu subdominio, tu usuario y el texto que devolvió
`caddy hash-password`, que empieza con `$2a$`), guardá con Ctrl+O, Enter, Ctrl+X, y aplicá con
`sudo systemctl reload caddy`:

```
:80 {
	root * /opt/coordinacion-de-obras/panel
	file_server
	basic_auth {
		coordinacion HASH
	}
}
```

## Opcional: el bot de reporte diario las 24 h

El bot usa Telegram en modo *long polling*: no necesita dominio ni HTTPS. Hace falta el token del bot
(se crea en Telegram con @BotFather) y una API key de OpenAI con saldo. El detalle de cómo conseguir
cada uno está en el
[README del bot](https://github.com/Leoscd/bot-saez-sanchez/blob/main/docs/DEMO_TELEGRAM.md).

Instalar en un usuario propio, así el bot no corre como administrador:

```bash
sudo apt install -y python3-venv
sudo useradd --system --create-home --home-dir /opt/bot-obra obrabot
sudo -u obrabot git clone https://github.com/Leoscd/bot-saez-sanchez.git /opt/bot-obra/app
cd /opt/bot-obra/app
sudo -u obrabot python3 -m venv .venv
sudo -u obrabot .venv/bin/pip install -r requirements.txt
sudo -u obrabot cp .env.example .env
sudo -u obrabot nano .env
```

En el `.env` completá como mínimo `TELEGRAM_BOT_TOKEN` y `OPENAI_API_KEY`. Las claves quedan solo en el
servidor: nunca las subas al repositorio ni las pegues en un chat.

Cargar las obras demo:

```bash
sudo -u obrabot .venv/bin/python scripts/seed_demo.py
```

Dejarlo corriendo como servicio (arranca solo si el VPS se reinicia):

```bash
sudo nano /etc/systemd/system/bot-obra.service
```

```
[Unit]
Description=Bot de reporte diario de obra
After=network-online.target
Wants=network-online.target

[Service]
User=obrabot
WorkingDirectory=/opt/bot-obra/app
ExecStart=/opt/bot-obra/app/.venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bot-obra
sudo systemctl status bot-obra
```

Ver qué está haciendo: `sudo journalctl -u bot-obra -f`. Actualizarlo:
`cd /opt/bot-obra/app && sudo -u obrabot git pull && sudo systemctl restart bot-obra`.

Las fechas de las obras demo se calculan desde el día en que se corre el seed. Antes de mostrarlo,
volvé a correr `scripts/seed_demo.py` y reiniciá el servicio.

## Cuidados

- Lo que cada uno carga en el panel queda en su navegador, no en el servidor. Los datos de coordinación
  se importan desde el JSON en Coordinación → Obras, DT y datos.
- Este repositorio es **público**: el código y la carpeta `datos/` (con nombres y evaluaciones de los DT)
  los puede ver cualquiera. Para que dejen de verse, pasalo a privado en GitHub (Settings → General →
  Danger Zone → Change visibility). Con el repositorio privado, el `git pull` del VPS necesita una clave
  de solo lectura (Deploy key).
- Las contraseñas y claves van solo en el servidor (Caddyfile y `.env`), nunca en el repositorio.
