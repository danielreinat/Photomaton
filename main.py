import time
import tkinter as tk
from tkinter import messagebox, simpledialog


class PhotomatonApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Photomaton")
        self.root.geometry("480x320")
        self.root.resizable(False, False)

        self.title_label = tk.Label(
            root,
            text="Bienvenido al Photomaton",
            font=("Helvetica", 18, "bold"),
        )
        self.title_label.pack(pady=20)

        self.status_label = tk.Label(
            root,
            text="Pulsa el botón para iniciar la sesión de fotos.",
            font=("Helvetica", 12),
            wraplength=420,
        )
        self.status_label.pack(pady=10)

        self.action_button = tk.Button(
            root,
            text="Realizar foto",
            font=("Helvetica", 14, "bold"),
            width=18,
            height=2,
            command=self.start_session,
        )
        self.action_button.pack(pady=20)

        self.photo_count = 0
        self.photos: list[str] = []

    def start_session(self) -> None:
        self.photo_count = 0
        self.photos = []
        self.action_button.config(state=tk.DISABLED)
        self.status_label.config(text="Encendiendo cámara...")
        self.root.after(500, lambda: self.run_countdown(5))

    def run_countdown(self, remaining: int) -> None:
        if remaining > 0:
            self.status_label.config(
                text=f"Primera foto en {remaining} segundo{'s' if remaining != 1 else ''}."
            )
            self.root.after(1000, lambda: self.run_countdown(remaining - 1))
        else:
            self.capture_photo()

    def capture_photo(self) -> None:
        self.photo_count += 1
        timestamp = time.strftime("%H:%M:%S")
        self.photos.append(f"Foto {self.photo_count} tomada a las {timestamp}.")
        self.status_label.config(text=f"Foto {self.photo_count} tomada.")

        if self.photo_count < 3:
            self.root.after(1000, self.prepare_next_photo)
        else:
            self.root.after(800, self.ask_phone_number)

    def prepare_next_photo(self) -> None:
        self.status_label.config(text="Siguiente foto en 2 segundos...")
        self.root.after(2000, self.capture_photo)

    def ask_phone_number(self) -> None:
        phone_number = simpledialog.askstring(
            "Número de teléfono",
            "Introduce tu número para enviar las fotos por WhatsApp:",
            parent=self.root,
        )
        if not phone_number:
            self.reset_to_start(
                "No se introdujo número. Volviendo a la pantalla inicial."
            )
            return

        self.status_label.config(
            text=f"Enviando fotos a {phone_number} por WhatsApp..."
        )
        self.root.after(800, self.ask_show_on_screen)

    def ask_show_on_screen(self) -> None:
        show = messagebox.askyesno(
            "Mostrar en pantalla",
            "¿Quieres que las fotos aparezcan en pantalla?",
            parent=self.root,
        )
        if show:
            self.show_photos_on_screen()
        else:
            self.reset_to_start("Sesión finalizada. ¡Gracias!")

    def show_photos_on_screen(self) -> None:
        self.status_label.config(text="Enviando fotos a la pantalla...")
        preview = tk.Toplevel(self.root)
        preview.title("Vista previa")
        preview.geometry("420x240")
        preview.resizable(False, False)

        tk.Label(
            preview,
            text="Fotos capturadas",
            font=("Helvetica", 14, "bold"),
        ).pack(pady=10)

        for photo in self.photos:
            tk.Label(preview, text=photo, font=("Helvetica", 10)).pack(anchor="w", padx=16)

        tk.Button(
            preview,
            text="Cerrar",
            command=lambda: self.close_preview(preview),
        ).pack(pady=16)

    def close_preview(self, preview: tk.Toplevel) -> None:
        preview.destroy()
        self.reset_to_start("Sesión finalizada. ¡Gracias!")

    def reset_to_start(self, message: str) -> None:
        self.status_label.config(text=message)
        self.action_button.config(state=tk.NORMAL)


def main() -> None:
    root = tk.Tk()
    app = PhotomatonApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
