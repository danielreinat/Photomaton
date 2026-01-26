diff --git a/README.md b/README.md
index a20e21f24e1b9a938ad602159476dbbf6f67a0f4..8c6a17c8043c03c39af3d2987ac686777861ca6c 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,31 @@
 # Photomaton
-Esto va a ser una aplicación que gestione un photomaton. La idea es que el usuario se realice una foto y dicha aplicación sea capaz de mandarsela al telefono via whatsapp
+
+Aplicación en Python con interfaz web local para simular el flujo de un photomaton.
+
+## Flujo de la aplicación
+
+1. Pulsa **Realizar foto**.
+2. Cuenta atrás de 5 segundos y captura de 3 fotos con 2 segundos de intervalo.
+3. Solicitud del número de teléfono para enviar las fotos por WhatsApp.
+4. Pregunta para mostrar las fotos en pantalla (simulación de envío a una pantalla).
+
+## Requisitos
+
+- Python 3.10 o superior.
+- Python incluye la librería estándar necesaria para levantar el servidor local (no requiere Flask).
+
+## Instalación
+
+No es necesario instalar dependencias externas para esta demo.
+
+## Ejecución
+
+```bash
+python app.py
+```
+
+Después abre el navegador en `http://localhost:5000`.
+
+## Notas
+
+- El envío por WhatsApp y la cámara están simulados para el flujo. Esta base se puede ampliar con integración real.

