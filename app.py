from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from pathlib import Path
import base64
import html
import io
import json
import re
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
    image_bytes = base64.b64decode(encoded)
    uploads_dir = root / folder
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"photomaton-{uuid.uuid4().hex}.{extension}"
    file_path = uploads_dir / filename
    file_path.write_bytes(image_bytes)
    return f"/{folder}/{filename}"


def _local_base_url() -> str:
    return "http://localhost:5001"


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
    items_html = []
    for index, image_path in enumerate(images, start=1):
        safe_path = html.escape(image_path, quote=True)
        filename = Path(image_path).name
        safe_filename = html.escape(filename, quote=True)
        items_html.append(
            f"""
            <li class="download-item">
              <img src="{safe_path}" alt="Foto {index}" />
              <div>
                <p>Foto {index}</p>
                <a class="button" href="{safe_path}" download="{safe_filename}">
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
          <a class="button" id="downloadAll" href="/download-all/{session_id}">
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
            base_url = _local_base_url()
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

        base_url = _local_base_url()

        image_paths = []
        target_folder = "publicar" if publish else "uploads"
        for image_data_url in images:
            try:
                image_paths.append(
                    _save_data_url(
                        image_data_url, Path(self.directory), folder=target_folder
                    )
                )
            except ValueError as error:
                _send_json(self, {"error": str(error)}, status=400)
                return

        session_id = _save_session(image_paths, Path(self.directory))
        download_url = f"{base_url}/download/{session_id}"
        _send_json(self, {"downloadUrl": download_url})


def main() -> None:
    root = Path(__file__).parent / "public"
    handler = lambda *args, **kwargs: PhotomatonHandler(
        *args, directory=str(root), **kwargs
    )
    with TCPServer(("", 5001), handler) as httpd:
        print(
            "Servidor listo en http://localhost:5001 "
            f"(QR local en {_local_base_url()})"
        )
        httpd.serve_forever()


if __name__ == "__main__":
    main()
