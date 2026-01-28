from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from pathlib import Path
import argparse
import base64
import html
import json
import os
import re
import threading
import uuid
import urllib.parse


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


def _is_localhost(host: str) -> bool:
    hostname = host.split(":", 1)[0].strip("[]").lower()
    return hostname in {"localhost", "127.0.0.1"}


def _public_base_url(headers) -> str | None:
    configured = os.getenv("PUBLIC_BASE_URL")
    if configured:
        return configured.rstrip("/")
    host = headers.get("Host")
    if not host:
        return None
    scheme = headers.get("X-Forwarded-Proto", "http").split(",")[0].strip()
    return f"{scheme}://{host}"


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


def _render_download_page(
    session_id: str, images: list[str], base_url: str | None
) -> str:
    asset_prefix = f"{base_url}/static" if base_url else "/static"
    items_html = []
    for index, image_path in enumerate(images, start=1):
        file_url = f"{base_url}{image_path}" if base_url else image_path
        safe_path = html.escape(file_url, quote=True)
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
          <button class="button" id="downloadAll" type="button">Descargar todas</button>
        </div>
      </header>
      <ul class="download-list">
        {items}
      </ul>
      <p class="helper">Puedes guardar cada foto en tu móvil tocando “Descargar”.</p>
    </main>
    <script>
      const downloadAllButton = document.getElementById("downloadAll");
      const downloadLinks = Array.from(
        document.querySelectorAll(".download-item a")
      );

      const triggerDownload = (link) => {{
        const anchor = document.createElement("a");
        anchor.href = link.href;
        anchor.download = link.getAttribute("download") || "";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }};

      downloadAllButton?.addEventListener("click", () => {{
        downloadLinks.forEach((link, index) => {{
          setTimeout(() => triggerDownload(link), index * 300);
        }});
      }});
    </script>
  </body>
</html>
"""


class PhotomatonHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
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
            base_url = _public_base_url(self.headers)
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

        host = self.headers.get("Host", "")
        if not os.getenv("PUBLIC_BASE_URL") and host and _is_localhost(host):
            _send_json(
                self,
                {
                    "error": (
                        "Estás usando localhost. Abre la app desde la IP local "
                        "(por ejemplo http://192.168.1.50:5001) o define "
                        "PUBLIC_BASE_URL para generar un QR accesible desde el móvil."
                    )
                },
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

        image_paths = []
        for image_data_url in images:
            try:
                image_paths.append(_save_data_url(image_data_url, Path(self.directory)))
            except ValueError as error:
                _send_json(self, {"error": str(error)}, status=400)
                return

        session_id = _save_session(image_paths, Path(self.directory))
        download_url = f"{base_url}/download/{session_id}"
        _send_json(self, {"downloadUrl": download_url})


def _create_server(root: Path) -> TCPServer:
    handler = lambda *args, **kwargs: PhotomatonHandler(
        *args, directory=str(root), **kwargs
    )
    return TCPServer(("", 5001), handler)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Photomaton: servidor local con opción de ventana de escritorio."
    )
    parser.add_argument(
        "--window",
        action="store_true",
        help="Abre una ventana de escritorio usando pywebview.",
    )
    args = parser.parse_args()

    root = Path(__file__).parent / "public"
    httpd = _create_server(root)
    if args.window:
        try:
            import webview
        except ImportError:
            print(
                "pywebview no está instalado. Ejecuta: pip install pywebview y vuelve a intentarlo."
            )
            httpd.server_close()
            return

        server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        server_thread.start()
        window = webview.create_window(
            "Photomaton", "http://localhost:5001", min_size=(1024, 720)
        )

        try:
            window.events.closed += lambda: httpd.shutdown()
        except AttributeError:
            pass

        print("Ventana lista en http://localhost:5001")
        webview.start()
        httpd.server_close()
        return

    with httpd:
        print("Servidor listo en http://localhost:5001")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
