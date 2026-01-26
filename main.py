import time
import tkinter as tk
from tkinter import messagebox, simpledialog, ttk


class PhotomatonApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Photomaton")
        self.root.geometry("560x420")
        self.root.resizable(False, False)
        self.root.configure(bg="#f4f1ed")

        self._configure_styles()

        self.header_frame = tk.Frame(root, bg="#f4f1ed")
        self.header_frame.pack(fill="x", padx=24, pady=(24, 12))

        self.title_label = tk.Label(
            self.header_frame,
            text="Photomaton Studio",
            font=("Helvetica", 22, "bold"),
            bg="#f4f1ed",
            fg="#3a2f2f",
        )
        self.title_label.pack(anchor="w")

        self.subtitle_label = tk.Label(
            self.header_frame,
            text="Captura tres momentos inolvidables.",
            font=("Helvetica", 12),
            bg="#f4f1ed",
            fg="#6b5e57",
        )
        self.subtitle_label.pack(anchor="w", pady=(4, 0))

        self.card_frame = tk.Frame(root, bg="#ffffff", bd=0, highlightthickness=0)
        self.card_frame.pack(fill="both", expand=True, padx=24, pady=(0, 24))

        self.countdown_label = tk.Label(
            self.card_frame,
            text="",
            font=("Helvetica", 36, "bold"),
            bg="#ffffff",
            fg="#9a7f6b",
        )
        self.countdown_label.pack(pady=(26, 8))

        self.status_label = tk.Label(
            self.card_frame,
            text="Pulsa el botón para iniciar la sesión de fotos.",
            font=("Helvetica", 12),
            bg="#ffffff",
            fg="#4a3f38",
            wraplength=480,
        )
        self.status_label.pack(pady=8)

        self.action_button = ttk.Button(
            self.card_frame,
            text="Realizar foto",
            style="Primary.TButton",
            command=self.start_session,
        )
        self.action_button.pack(pady=18, ipadx=20, ipady=8)

        self.photo_count = 0
        self.photos: list[str] = []

    def start_session(self) -> None:
        self.photo_count = 0
        self.photos = []
        self.action_button.config(state=tk.DISABLED)
        self.countdown_label.config(text="")
        self.status_label.config(text="Encendiendo cámara...")
        self.root.after(500, lambda: self.run_countdown(5))

    def run_countdown(self, remaining: int) -> None:
        if remaining > 0:
            self.countdown_label.config(text=str(remaining))
            self.status_label.config(
                text=f"Primera foto en {remaining} segundo{'s' if remaining != 1 else ''}."
            )
            self.root.after(1000, lambda: self.run_countdown(remaining - 1))
        else:
            self.countdown_label.config(text="¡Flash!")
            self.capture_photo()

    def capture_photo(self) -> None:
        self.photo_count += 1
        timestamp = time.strftime("%H:%M:%S")
        self.photos.append(f"Foto {self.photo_count} tomada a las {timestamp}.")
        self.status_label.config(text=f"Foto {self.photo_count} tomada.")
        self.countdown_label.config(text=f"{self.photo_count}/3")

        if self.photo_count < 3:
            self.root.after(1000, self.prepare_next_photo)
        else:
            self.root.after(800, self.ask_phone_number)

    def prepare_next_photo(self) -> None:
        self.status_label.config(text="Siguiente foto en 2 segundos...")
        self.countdown_label.config(text="2")
        self.root.after(2000, self.capture_photo)

    def ask_phone_number(self) -> None:
        self.countdown_label.config(text="")
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
        preview.geometry("460x280")
        preview.resizable(False, False)
        preview.configure(bg="#f8f5f2")

        tk.Label(
            preview,
            text="Fotos capturadas",
            font=("Helvetica", 14, "bold"),
            bg="#f8f5f2",
            fg="#3a2f2f",
        ).pack(pady=10)

        for photo in self.photos:
            tk.Label(
                preview,
                text=photo,
                font=("Helvetica", 10),
                bg="#f8f5f2",
                fg="#4a3f38",
            ).pack(anchor="w", padx=20)

        ttk.Button(
            preview,
            text="Cerrar",
            style="Secondary.TButton",
            command=lambda: self.close_preview(preview),
        ).pack(pady=18, ipadx=12, ipady=4)

    def close_preview(self, preview: tk.Toplevel) -> None:
        preview.destroy()
        self.reset_to_start("Sesión finalizada. ¡Gracias!")

    def reset_to_start(self, message: str) -> None:
        self.status_label.config(text=message)
        self.countdown_label.config(text="")
        self.action_button.config(state=tk.NORMAL)

    def _configure_styles(self) -> None:
        style = ttk.Style()
        style.theme_use("clam")

        style.configure(
            "Primary.TButton",
            font=("Helvetica", 12, "bold"),
            foreground="#ffffff",
            background="#c86f3d",
            padding=10,
        )
        style.map(
            "Primary.TButton",
            background=[("active", "#b45f32"), ("disabled", "#d9c3b5")],
            foreground=[("disabled", "#f2eae4")],
        )

        style.configure(
            "Secondary.TButton",
            font=("Helvetica", 10, "bold"),
            foreground="#ffffff",
            background="#7a6759",
            padding=6,
        )
        style.map(
            "Secondary.TButton",
            background=[("active", "#68584c")],
        )


def main() -> None:
    root = tk.Tk()
    app = PhotomatonApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
