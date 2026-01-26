from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from pathlib import Path
import base64
import json
import os
import re
import uuid
import urllib.parse
import urllib.request


def _send_json(handler: SimpleHTTPRequestHandler, payload: dict, status: int = 200) -> None:
    response = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(response)))
    handler.end_headers()
    handler.wfile.write(response)


def _save_data_url(data_url: str, root: Path) -> str:
    match = re.match(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", data_url)
    if not match:
        raise ValueError("Formato de imagen inválido.")
    mime_type, encoded = match.groups()
    extension = mime_type.split("/")[-1]
    image_bytes = base64.b64decode(encoded)
    uploads_dir = root / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"photomaton-{uuid.uuid4().hex}.{extension}"
    file_path = uploads_dir / filename
    file_path.write_bytes(image_bytes)
    return f"/uploads/{filename}"


def _public_base_url(headers) -> str | None:
    configured = os.getenv("PUBLIC_BASE_URL")
    if configured:
        return configured.rstrip("/")
    host = headers.get("Host")
    if not host:
        return None
    scheme = headers.get("X-Forwarded-Proto", "http").split(",")[0].strip()
    return f"{scheme}://{host}"


def _send_twilio_sms(phone: str, media_url: str) -> tuple[bool, str]:
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")
    if not account_sid or not auth_token or not from_number:
        return False, "Faltan credenciales de Twilio en variables de entorno."

    message_body = os.getenv(
        "TWILIO_MESSAGE_BODY",
        "¡Hola! Aquí tienes tu foto del photomaton.",
    )
    payload = urllib.parse.urlencode(
        {
            "To": phone,
            "From": from_number,
            "Body": message_body,
            "MediaUrl": media_url,
        }
    ).encode("utf-8")
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    auth = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode(
        "utf-8"
    )
    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={"Authorization": f"Basic {auth}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status in {200, 201}, ""
    except urllib.error.HTTPError as error:
        try:
            error_payload = error.read().decode("utf-8")
        except Exception:
            error_payload = "Error desconocido al enviar el SMS."
        return False, error_payload
    except urllib.error.URLError:
        return False, "No se pudo conectar con Twilio."


class PhotomatonHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path in {"", "/"}:
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/send-sms":
            self.send_error(404)
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0:
            _send_json(self, {"error": "Solicitud sin datos."}, status=400)
            return

        raw_payload = self.rfile.read(content_length)
        try:
            payload = json.loads(raw_payload.decode("utf-8"))
        except json.JSONDecodeError:
            _send_json(self, {"error": "JSON inválido."}, status=400)
            return

        phone = str(payload.get("phone", "")).strip()
        image_data_url = payload.get("imageDataUrl")
        if not phone or not image_data_url:
            _send_json(
                self,
                {"error": "Faltan el número de teléfono o la imagen."},
                status=400,
            )
            return

        base_url = _public_base_url(self.headers)
        if not base_url:
            _send_json(
                self,
                {"error": "No se pudo determinar la URL pública del servidor."},
                status=500,
            )
            return

        try:
            image_path = _save_data_url(image_data_url, Path(self.directory))
        except ValueError as error:
            _send_json(self, {"error": str(error)}, status=400)
            return

        media_url = f"{base_url}{image_path}"
        success, error_message = _send_twilio_sms(phone, media_url)
        if not success:
            _send_json(self, {"error": error_message}, status=502)
            return

        _send_json(self, {"status": "ok"})


def main() -> None:
    root = Path(__file__).parent / "public"
    handler = lambda *args, **kwargs: PhotomatonHandler(
        *args, directory=str(root), **kwargs
    )
    with TCPServer(("", 5001), handler) as httpd:
        print("Servidor listo en http://localhost:5001")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
