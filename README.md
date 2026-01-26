# Photomaton

Aplicación en Python con interfaz web local para simular el flujo de un photomaton.

## Flujo de la aplicación

1. Pulsa **Realizar foto**.
2. Cuenta atrás de 5 segundos y captura de 3 fotos con 2 segundos de intervalo.
3. Generación automática de un código QR para descargar las fotos.
4. El usuario escanea el QR y abre una página con los enlaces de descarga.

## Requisitos

- Python 3.10 o superior.
- Python incluye la librería estándar necesaria para levantar el servidor local (no requiere Flask).

## Instalación

No es necesario instalar dependencias externas para esta demo.

## Ejecución

```bash
python app.py
```

Después abre el navegador en `http://localhost:5001`.

## Notas

- La cámara está simulada con el navegador. Esta base se puede ampliar con integración real de almacenamiento o entrega.
