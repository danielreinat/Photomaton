# Photomaton

Aplicación en Python con interfaz web que simula el flujo de un photomaton:
captura fotos con la cámara del navegador, genera un QR y permite descargar
las imágenes desde el móvil.

## Qué hace

1. Pulsa **Realizar foto** para iniciar la sesión.
2. Cuenta atrás de 5 segundos y captura 3 fotos con 2 segundos de intervalo.
3. Genera un enlace de descarga y un QR.
4. Escanea el QR desde el móvil y descarga las fotos.

## Requisitos

- Python 3.10 o superior.
- Navegador moderno con soporte para `getUserMedia`.

No necesitas instalar dependencias externas.

## Instalación

Clona el repositorio y entra en la carpeta:

```bash
git clone <tu-repo>
cd Photomaton
```

## Ejecución

```bash
python app.py
```

Por defecto el servidor queda en `http://localhost:5001`.

## Configurar Cloudinary (Render u otro hosting)

Si defines las variables de entorno de Cloudinary, las fotos se suben allí.
Cuando no están definidas, las imágenes se guardan en local dentro de `public/`.

Variables necesarias:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER` (opcional, base del folder; por defecto `photomaton`)

Con esa configuración, la app guarda:

- Todas las fotos en `<CLOUDINARY_FOLDER>/todas`
- Las fotos marcadas para publicar también se duplican en
  `<CLOUDINARY_FOLDER>/publicar`

En Render debes añadirlas en **Environment**. Ejemplo:

```text
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
CLOUDINARY_FOLDER=photomaton
```

## Cómo hacer que el QR funcione en el móvil (app de escritorio)

El QR apunta a la URL donde estás abriendo la app. Si la abres en `localhost`
o en `127.0.0.1`, tu móvil **no** podrá acceder porque esas direcciones en el
móvil son su propio dispositivo. Para que funcione, tienes dos opciones:

### Si estás desplegado en Render (o similar)

Cuando la app está detrás de un hosting como Render, el servidor toma el host
de la petición (cabeceras `X-Forwarded-*`/`Host`) para construir el enlace del QR,
así el móvil puede abrirlo desde cualquier red. Si necesitas forzar la URL
pública, define:

```bash
PUBLIC_BASE_URL="https://tu-app.onrender.com" python app.py
```

### Opción A: usar un túnel público (recomendado)

Si quieres que el QR funcione desde cualquier dispositivo sin configurar IPs,
abre un túnel que exponga tu servidor local. La app detecta automáticamente
la URL pública de ngrok si está en ejecución.

1. Inicia el servidor local:

```bash
python app.py
```

2. En otra terminal, abre un túnel (ngrok):

```bash
ngrok http 5001
```

3. La app intentará usar la URL pública automáticamente para el QR.

Si quieres forzar la URL pública, define:

```bash
PUBLIC_TUNNEL_URL="https://tu-subdominio.ngrok-free.app" python app.py
```

También puedes definir `NGROK_API_URL` si ngrok expone su API en otro puerto:

```bash
NGROK_API_URL="http://127.0.0.1:4040/api/tunnels" python app.py
```

### Opción B: usar la IP local

1. Averigua la IP local de tu ordenador (por ejemplo `192.168.1.50`).
2. Abre la app desde esa IP:

```text
http://192.168.1.50:5001
```

3. Genera el QR desde esa URL y el móvil podrá abrirlo si está en la misma red.
4. Si usas la app como escritorio, puedes dejar configurado:

```bash
PUBLIC_BASE_URL="http://192.168.1.50:5001" python app.py
```

5. Asegúrate de que el firewall permite conexiones al puerto 5001.
6. Si ves un aviso de que el QR apunta a localhost, repite los pasos anteriores.

### Opción C: definir una URL pública

Si tienes la app publicada o accesible mediante un dominio, define
`PUBLIC_BASE_URL` antes de arrancar el servidor:

```bash
PUBLIC_BASE_URL="https://mi-dominio.com" python app.py
```

El QR usará esa URL pública para que el móvil abra el enlace de descarga.

### Comprobar que el QR es accesible

- Asegúrate de que el QR apunta a una URL con IP local o dominio público,
  no a `localhost`.
- El móvil y el ordenador deben estar en la misma red Wi‑Fi si usas IP local.

## Estructura del proyecto

- `app.py`: servidor HTTP y lógica de sesiones de descarga.
- `public/`: interfaz web, estilos y scripts.

## Notas

- La cámara se maneja desde el navegador, así que revisa permisos si no inicia.
- Sin Cloudinary, los archivos se guardan en `public/uploads` y las sesiones en `public/sessions`.
- El QR se genera mediante un servicio externo (api.qrserver.com) a través del servidor.
