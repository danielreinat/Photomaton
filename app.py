from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from pathlib import Path
import os
import base64
import html
import hashlib
import io
import json
import mimetypes
import re
import socket
import time
import uuid
import urllib.parse
import urllib.request
import zipfile


def _send_json(handler: SimpleHTTPRequestHandler, payload: dict, status: int = 200) -> None:
    response = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(response)))
    handler.end_headers()
    handler.wfile.write(response)


def _save_data_url(data_url: str, root: Path, folder: str = "uploads") -> str:
    match = re.match(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", data_url)
    if not match:
        raise ValueError("Formato de imagen inválido.")
    mime_type, encoded = match.groups()
    extension = mime_type.split("/")[-1]
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except Exception as error:
        raise ValueError("Formato de imagen inválido.") from error
    uploads_dir = root / folder
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"photomaton-{uuid.uuid4().hex}.{extension}"
    file_path = uploads_dir / filename
    file_path.write_bytes(image_bytes)
    return f"/{folder}/{filename}"


def _validate_data_url(data_url: str) -> None:
    match = re.match(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", data_url)
    if not match:
        raise ValueError("Formato de imagen inválido.")
    _, encoded = match.groups()
    try:
        base64.b64decode(encoded, validate=True)
    except Exception as error:
        raise ValueError("Formato de imagen inválido.") from error


def _cloudinary_config() -> dict | None:
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    if not cloud_name or not api_key or not api_secret:
        return None
    folder = os.getenv("CLOUDINARY_FOLDER", "photomaton").strip().strip("/")
    return {
        "cloud_name": cloud_name,
        "api_key": api_key,
        "api_secret": api_secret,
        "folder": folder or "photomaton",
    }


def _sign_cloudinary(params: dict, api_secret: str) -> str:
    pieces = [f"{key}={params[key]}" for key in sorted(params)]
    signature_payload = "&".join(pieces) + api_secret
    return hashlib.sha1(signature_payload.encode("utf-8")).hexdigest()


def _encode_multipart(fields: dict, boundary: str) -> bytes:
    lines: list[bytes] = []
    for key, value in fields.items():
        lines.append(f"--{boundary}".encode("utf-8"))
        header = f'Content-Disposition: form-data; name="{key}"'
        lines.append(header.encode("utf-8"))
        lines.append(b"")
        lines.append(str(value).encode("utf-8"))
    lines.append(f"--{boundary}--".encode("utf-8"))
    lines.append(b"")
    return b"\r\n".join(lines)


def _upload_to_cloudinary(data_url: str, folder: str) -> str:
    config = _cloudinary_config()
    if not config:
        raise RuntimeError("Cloudinary no está configurado.")
    timestamp = int(time.time())
    public_id = f"photomaton-{uuid.uuid4().hex}"
    signature = _sign_cloudinary(
        {"folder": folder, "public_id": public_id, "timestamp": timestamp},
        config["api_secret"],
    )
    fields = {
        "file": data_url,
        "api_key": config["api_key"],
        "timestamp": timestamp,
        "folder": folder,
        "public_id": public_id,
        "signature": signature,
    }
    boundary = f"photomaton-{uuid.uuid4().hex}"
    body = _encode_multipart(fields, boundary)
    request = urllib.request.Request(
        f"https://api.cloudinary.com/v1_1/{config['cloud_name']}/image/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        payload = response.read().decode("utf-8")
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as error:
        raise RuntimeError("Respuesta inválida de Cloudinary.") from error
    secure_url = data.get("secure_url")
    if not secure_url:
        raise RuntimeError(f"Cloudinary error: {data.get('error')}")
    return secure_url


def _store_photos(images: list[str], root: Path, publish: bool) -> list[str]:
    config = _cloudinary_config()
    saved_paths: list[str] = []
    if not config:
        target_folder = "publicar" if publish else "uploads"
        for image_data_url in images:
            saved_paths.append(_save_data_url(image_data_url, root, folder=target_folder))
        return saved_paths

    base_folder = config["folder"]
    all_folder = f"{base_folder}/todas"
    publish_folder = f"{base_folder}/publicar"
    for image_data_url in images:
        _validate_data_url(image_data_url)
        saved_paths.append(_upload_to_cloudinary(image_data_url, all_folder))
        if publish:
            _upload_to_cloudinary(image_data_url, publish_folder)
    return saved_paths


def _get_tunnel_url() -> str | None:
    configured = os.getenv("PUBLIC_TUNNEL_URL", "").strip()
    if configured:
        return configured.rstrip("/")
    api_url = os.getenv("NGROK_API_URL", "http://127.0.0.1:4040/api/tunnels").strip()
    if not api_url:
        return None
    try:
        with urllib.request.urlopen(api_url, timeout=3) as response:
            payload = response.read().decode("utf-8")
        data = json.loads(payload)
    except Exception:
        return None
    for tunnel in data.get("tunnels", []):
        public_url = tunnel.get("public_url")
        if isinstance(public_url, str) and public_url.startswith("https://"):
            return public_url.rstrip("/")
    return None


def _get_local_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except Exception:
        return None


DEFAULT_PUBLIC_BASE_URL = "https://photomaton-5b71.onrender.com"


def _resolve_base_url() -> str:
    configured = os.getenv("PUBLIC_BASE_URL", DEFAULT_PUBLIC_BASE_URL).strip()
    if configured:
        return configured.rstrip("/")
    return ""


def _resolve_base_url_for_request(handler: SimpleHTTPRequestHandler) -> str:
    configured = os.getenv("PUBLIC_BASE_URL", "").strip()
    if configured:
        return configured.rstrip("/")

def _save_session(image_paths: list[str], root: Path) -> str:
    sessions_dir = root / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    session_id = uuid.uuid4().hex
    payload = {"images": image_paths}
    session_path = sessions_dir / f"{session_id}.json"
    session_path.write_text(json.dumps(payload), encoding="utf-8")
    return session_id


def _load_session(session_id: str, root: Path) -> dict | None:
    session_path = root / "sessions" / f"{session_id}.json"
    if not session_path.exists():
        return None
    try:
        return json.loads(session_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _render_download_page(session_id: str, images: list[str], base_url: str | None) -> str:
    asset_prefix = f"{base_url}/static" if base_url else "/static"
    link_prefix = base_url or ""
    items_html = []
    for index, image_path in enumerate(images, start=1):
        safe_path = html.escape(image_path, quote=True)
        filename = Path(image_path).name
        safe_filename = html.escape(filename, quote=True)
        download_link = f"{link_prefix}/download-photo/{session_id}/{index}"
        items_html.append(
            f"""
            <li class="download-item">
              <img src="{safe_path}" alt="Foto {index}" />
              <div>
                <p>Foto {index}</p>
                <a class="button" href="{download_link}" download="{safe_filename}">
                  Descargar
                </a>
              </div>
            </li>
            """
        )
    items = "\n".join(items_html)
    return f"""<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Descarga tus fotos</title>
    <link rel="stylesheet" href="{asset_prefix}/download.css" />
  </head>
  <body>
    <main class="download">
      <header>
        <h1>Descarga tus fotos</h1>
        <div class="download-actions">
          <a class="button" id="downloadAll" href="{link_prefix}/download-all/{session_id}">
            Descargar todas
          </a>
        </div>
      </header>
      <ul class="download-list">
        {items}
      </ul>
      <p class="helper">Puedes guardar cada foto en tu móvil tocando “Descargar”.</p>
    </main>
    <script>
      const downloadAllButton = document.getElementById("downloadAll");
      downloadAllButton?.addEventListener("click", (event) => {{
        downloadAllButton.setAttribute("aria-busy", "true");
      }});
    </script>
  </body>
</html>
"""


def _fetch_qr_image(data: str, size: str = "240x240") -> tuple[bytes, str]:
    safe_size = size if re.match(r"^\d{2,4}x\d{2,4}$", size) else "240x240"
    encoded_data = urllib.parse.quote(data, safe="")
    request_urls = [
        (
            "https://api.qrserver.com/v1/create-qr-code/"
            f"?size={safe_size}&data={encoded_data}"
        ),
        f"https://quickchart.io/qr?size={safe_size}&text={encoded_data}",
    ]
    last_error: Exception | None = None
    for request_url in request_urls:
        request = urllib.request.Request(request_url, headers={"User-Agent": "Photomaton"})
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                content_type = response.headers.get("Content-Type", "image/png")
                payload = response.read()
                if not content_type.startswith("image/") or not payload:
                    raise ValueError("Respuesta inválida del servicio de QR.")
                return payload, content_type
        except Exception as error:
            last_error = error
            continue
    raise last_error or RuntimeError("No se pudo generar el QR.")


class PhotomatonHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == "/api/qr":
            query = urllib.parse.parse_qs(parsed_url.query)
            data = query.get("data", [""])[0]
            size = query.get("size", ["240x240"])[0]
            if not data:
                self.send_error(400, "Falta el parámetro data.")
                return
            try:
                payload, content_type = _fetch_qr_image(data, size)
            except Exception:
                self.send_error(502, "No se pudo generar el QR.")
                return
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)
            return

        if self.path in {"", "/"}:
            self.path = "/index.html"
            super().do_GET()
            return

        if self.path.startswith("/download/"):
            session_id = self.path.split("/download/")[-1].strip()
            if not session_id:
                self.send_error(404)
                return
            session = _load_session(session_id, Path(self.directory))
            if not session or not session.get("images"):
                self.send_error(404)
                return
            base_url = _resolve_base_url_for_request(self)
            html_payload = _render_download_page(
                session_id, session["images"], base_url
            )
            encoded = html_payload.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return

        if self.path.startswith("/download-photo/"):
            parts = self.path.split("/download-photo/")[-1].strip().split("/")
            if len(parts) != 2:
                self.send_error(404)
                return
            session_id, index_raw = parts
            try:
                index = int(index_raw)
            except ValueError:
                self.send_error(404)
                return
            session = _load_session(session_id, Path(self.directory))
            if not session or not session.get("images"):
                self.send_error(404)
                return
            images = session["images"]
            if index < 1 or index > len(images):
                self.send_error(404)
                return
            image_path = images[index - 1]
            filename = Path(urllib.parse.urlparse(image_path).path).name or f"photo-{index}.png"
            if image_path.startswith("http"):
                try:
                    with urllib.request.urlopen(image_path, timeout=10) as response:
                        payload = response.read()
                        content_type = response.headers.get("Content-Type", "application/octet-stream")
                except Exception:
                    self.send_error(502, "No se pudo descargar la imagen.")
                    return
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header(
                    "Content-Disposition", f'attachment; filename="{filename}"'
                )
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return

            file_path = Path(self.directory) / image_path.lstrip("/")
            if not file_path.exists():
                self.send_error(404)
                return
            payload = file_path.read_bytes()
            content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header(
                "Content-Disposition", f'attachment; filename="{file_path.name}"'
            )
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if self.path.startswith("/download-all/"):
            session_id = self.path.split("/download-all/")[-1].strip()
            if not session_id:
                self.send_error(404)
                return
            session = _load_session(session_id, Path(self.directory))
            if not session or not session.get("images"):
                self.send_error(404)
                return
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
                for image_path in session["images"]:
                    if image_path.startswith("http"):
                        try:
                            with urllib.request.urlopen(image_path, timeout=10) as response:
                                payload = response.read()
                            filename = Path(
                                urllib.parse.urlparse(image_path).path
                            ).name or "photo.png"
                            zip_file.writestr(filename, payload)
                        except Exception:
                            continue
                    else:
                        file_path = Path(self.directory) / image_path.lstrip("/")
                        if not file_path.exists():
                            continue
                        zip_file.write(file_path, arcname=file_path.name)
            zip_payload = zip_buffer.getvalue()
            filename = f"photomaton-{session_id}.zip"
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header(
                "Content-Disposition", f'attachment; filename="{filename}"'
            )
            self.send_header("Content-Length", str(len(zip_payload)))
            self.end_headers()
            self.wfile.write(zip_payload)
            return

        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/create-session":
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

        images = payload.get("images")
        if not isinstance(images, list) or not images:
            _send_json(self, {"error": "Faltan las imágenes."}, status=400)
            return
        publish = payload.get("publish", False)
        if not isinstance(publish, bool):
            publish = False

        base_url = _resolve_base_url_for_request(self)

        for image_data_url in images:
            if not isinstance(image_data_url, str):
                _send_json(self, {"error": "Formato de imagen inválido."}, status=400)
                return

        try:
            image_paths = _store_photos(images, Path(self.directory), publish)
        except ValueError as error:
            _send_json(self, {"error": str(error)}, status=400)
            return
        except Exception:
            _send_json(self, {"error": "No se pudieron guardar las fotos."}, status=500)
            return

        session_id = _save_session(image_paths, Path(self.directory))
        download_url = f"{base_url}/download/{session_id}"
        _send_json(self, {"downloadUrl": download_url})


class ReusableTCPServer(TCPServer):
    allow_reuse_address = True


def main() -> None:
    root = Path(__file__).parent / "public"
    handler = lambda *args, **kwargs: PhotomatonHandler(
        *args, directory=str(root), **kwargs
    )
    with ReusableTCPServer(("", 5002), handler) as httpd:
        print(
            "Servidor listo en http://localhost:5002"
            f"(QR local en {_resolve_base_url()})"
        )
        httpd.serve_forever()


if __name__ == "__main__":
    main()
