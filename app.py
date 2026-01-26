from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from pathlib import Path


class PhotomatonHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path in {"", "/"}:
            self.path = "/index.html"
        super().do_GET()


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
