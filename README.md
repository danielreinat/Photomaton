# Photomaton

Aplicación en Python con interfaz web local para simular el flujo de un photomaton.

## Flujo de la aplicación

1. Pulsa **Realizar foto**.
2. Cuenta atrás de 5 segundos y captura de 3 fotos con 2 segundos de intervalo.
3. Solicitud del número de teléfono para enviar las fotos por WhatsApp.
4. Pregunta para mostrar las fotos en pantalla (simulación de envío a una pantalla).

## Requisitos

- Python 3.10 o superior.
- Python incluye la librería estándar necesaria para levantar el servidor local (no requiere Flask).

## Instalación

No es necesario instalar dependencias externas para esta demo.

## Ejecución

```bash
python app.py
```

Después abre el navegador en `http://localhost:5000`.

## Notas

- El envío por WhatsApp y la cámara están simulados para el flujo. Esta base se puede ampliar con integración real.
