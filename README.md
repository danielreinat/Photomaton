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

El enlace de descarga y el QR se generan **exclusivamente** con un túnel de
ngrok para asegurar que las fotos estén accesibles desde cualquier dispositivo.
Necesitas tener ngrok ejecutándose antes de pedir el QR.

1. Inicia el servidor local:

```bash
python app.py
```

2. En otra terminal, abre un túnel (ngrok):

```bash
ngrok http 5001
```

3. La app detecta la URL pública automáticamente y genera el QR con ese enlace.

Si quieres forzar la URL pública, define:

```bash
PUBLIC_TUNNEL_URL="https://tu-subdominio.ngrok-free.app" python app.py
```

También puedes definir `NGROK_API_URL` si ngrok expone su API en otro puerto:

```bash
NGROK_API_URL="http://127.0.0.1:4040/api/tunnels" python app.py
```

## Estructura del proyecto

- `app.py`: servidor HTTP y lógica de sesiones de descarga.
- `public/`: interfaz web, estilos y scripts.

## Notas

- La cámara se maneja desde el navegador, así que revisa permisos si no inicia.
- Sin Cloudinary, los archivos se guardan en `public/uploads` y las sesiones en `public/sessions`.
- El QR se genera mediante un servicio externo (api.qrserver.com) a través del servidor.
