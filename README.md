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

## Cómo hacer que el QR funcione en el móvil

El QR apunta a la URL donde estás abriendo la app. Si la abres en `localhost`,
tu móvil **no** podrá acceder porque `localhost` en el móvil es su propio
dispositivo. Para que funcione, tienes dos opciones:

### Opción A: usar la IP local

1. Averigua la IP local de tu ordenador (por ejemplo `192.168.1.50`).
2. Abre la app desde esa IP:

```text
http://192.168.1.50:5001
```

3. Genera el QR desde esa URL y el móvil podrá abrirlo si está en la misma red.

### Opción B: definir una URL pública

Si tienes la app publicada o accesible mediante un dominio, define
`PUBLIC_BASE_URL` antes de arrancar el servidor:

```bash
PUBLIC_BASE_URL="https://mi-dominio.com" python app.py
```

El QR usará esa URL pública para que el móvil abra el enlace de descarga.

## Estructura del proyecto

- `app.py`: servidor HTTP y lógica de sesiones de descarga.
- `public/`: interfaz web, estilos y scripts.

## Notas

- La cámara se maneja desde el navegador, así que revisa permisos si no inicia.
- Los archivos se guardan en `public/uploads` y las sesiones en `public/sessions`.
