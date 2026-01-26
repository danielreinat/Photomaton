const startButton = document.getElementById("startButton");
const resetButton = document.getElementById("resetButton");
const countdown = document.getElementById("countdown");
const statusLabel = document.getElementById("status");
const cameraFeed = document.getElementById("cameraFeed");
const photoCanvas = document.getElementById("photoCanvas");
const canvasContext = photoCanvas.getContext("2d");
const qrPanel = document.getElementById("qrPanel");
const previewPanel = document.getElementById("previewPanel");
const qrImage = document.getElementById("qrImage");
const downloadLink = document.getElementById("downloadLink");
const qrStatus = document.getElementById("qrStatus");
const showPreview = document.getElementById("showPreview");
const retryQr = document.getElementById("retryQr");
const photoList = document.getElementById("photoList");
const closePreview = document.getElementById("closePreview");

const QR_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><rect width='100%25' height='100%25' fill='%2310140c'/><text x='50%25' y='50%25' fill='%23a3adb8' font-family='Poppins, sans-serif' font-size='16' dominant-baseline='middle' text-anchor='middle'>QR listo en breve</text></svg>";

let photoCount = 0;
let photos = [];
let photoDataUrls = [];
let downloadUrl = null;
let countdownTimer = null;
let cameraStream = null;

const toggleCameraPreview = (show) => {
  if (show) {
    cameraFeed.classList.remove("hidden");
    photoCanvas.classList.add("hidden");
  } else {
    cameraFeed.classList.add("hidden");
    photoCanvas.classList.add("hidden");
  }
};

const resetPanels = () => {
  qrPanel.classList.add("hidden");
  previewPanel.classList.add("hidden");
  qrStatus.textContent = "";
  retryQr.classList.add("hidden");
  downloadLink.classList.add("hidden");
  qrImage.src = QR_PLACEHOLDER;
};

const resetState = () => {
  if (countdownTimer) {
    clearTimeout(countdownTimer);
  }
  photoCount = 0;
  photos = [];
  photoDataUrls = [];
  downloadUrl = null;
  toggleCameraPreview(false);
  countdown.textContent = "Listo";
  statusLabel.textContent = "Pulsa “Realizar foto” para comenzar.";
  resetPanels();
  startButton.disabled = false;
  resetButton.disabled = true;
};

const updateCountdown = (value) => {
  countdown.textContent = value;
};

const PHOTO_CONSTRAINTS = {
  facingMode: "user",
  width: { ideal: 4096 },
  height: { ideal: 2160 },
  frameRate: { ideal: 30, max: 60 },
};

const capturePhoto = () => {
  photoCount += 1;
  if (cameraFeed.videoWidth && cameraFeed.videoHeight) {
    photoCanvas.width = cameraFeed.videoWidth;
    photoCanvas.height = cameraFeed.videoHeight;
    canvasContext.drawImage(cameraFeed, 0, 0);
    photoCanvas.classList.remove("hidden");
    cameraFeed.classList.add("hidden");
    photoDataUrls.push(photoCanvas.toDataURL("image/png"));
  }
  const now = new Date();
  const timestamp = now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  photos.push(`Foto ${photoCount} tomada a las ${timestamp}.`);
  statusLabel.textContent = `Foto ${photoCount} tomada.`;
  updateCountdown(`${photoCount}/3`);

  if (photoCount < 3) {
    setTimeout(() => {
      photoCanvas.classList.add("hidden");
      cameraFeed.classList.remove("hidden");
    }, 600);
    statusLabel.textContent = "Siguiente foto en 2 segundos...";
    updateCountdown("2");
    countdownTimer = setTimeout(capturePhoto, 2000);
  } else {
    countdownTimer = setTimeout(() => {
      resetPanels();
      qrPanel.classList.remove("hidden");
      statusLabel.textContent = "Generando tu enlace de descarga...";
      updateCountdown("✓");
      createDownloadSession();
    }, 800);
  }
};

const startSession = async () => {
  resetPanels();
  startButton.disabled = true;
  resetButton.disabled = false;
  statusLabel.textContent = "Encendiendo cámara...";
  await startCamera();
  if (!cameraStream) {
    startButton.disabled = false;
    resetButton.disabled = true;
    return;
  }
  toggleCameraPreview(true);
  let remaining = 5;
  const tick = () => {
    if (remaining > 0) {
      updateCountdown(remaining);
      statusLabel.textContent = `Primera foto en ${remaining} segundo${
        remaining === 1 ? "" : "s"
      }.`;
      remaining -= 1;
      countdownTimer = setTimeout(tick, 1000);
    } else {
      updateCountdown("¡Flash!");
      capturePhoto();
    }
  };
  tick();
};

startButton.addEventListener("click", startSession);
resetButton.addEventListener("click", resetState);

const renderPreview = () => {
  resetPanels();
  statusLabel.textContent = "Resumen de la sesión.";
  photoList.innerHTML = "";
  photos.forEach((photo) => {
    const item = document.createElement("li");
    item.textContent = photo;
    photoList.appendChild(item);
  });
  previewPanel.classList.remove("hidden");
};

closePreview.addEventListener("click", () => {
  statusLabel.textContent = "Sesión finalizada. ¡Gracias!";
  resetState();
});

const startCamera = async () => {
  if (cameraStream) {
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusLabel.textContent =
      "Tu navegador no soporta la cámara. Usa un dispositivo compatible.";
    startButton.disabled = true;
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: PHOTO_CONSTRAINTS,
      audio: false,
    });
    cameraFeed.srcObject = cameraStream;
    try {
      await cameraFeed.play();
    } catch (error) {
      statusLabel.textContent =
        "No se pudo iniciar la cámara automáticamente. Toca la pantalla y vuelve a intentarlo.";
      startButton.disabled = false;
      return;
    }
    statusLabel.textContent = "Cámara lista. Pulsa “Realizar foto”.";
  } catch (error) {
    statusLabel.textContent =
      "No se pudo acceder a la cámara. Revisa permisos del navegador.";
    startButton.disabled = true;
  }
};

const createDownloadSession = async () => {
  if (!photoDataUrls.length) {
    qrStatus.textContent = "No hay fotos disponibles para descargar.";
    return;
  }
  qrStatus.textContent = "Generando enlace seguro...";
  retryQr.classList.add("hidden");
  downloadLink.classList.add("hidden");
  try {
    const response = await fetch("/api/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: photoDataUrls }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "No se pudo generar el enlace.");
    }
    downloadUrl = payload.downloadUrl;
    const encodedUrl = encodeURIComponent(downloadUrl);
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodedUrl}`;
    downloadLink.href = downloadUrl;
    downloadLink.textContent = "Abrir enlace de descarga";
    downloadLink.classList.remove("hidden");
    qrStatus.textContent = "Enlace listo. Escanea el QR para descargar.";
    statusLabel.textContent = "Enlace de descarga preparado.";
  } catch (error) {
    statusLabel.textContent =
      "No se pudo generar el QR. Pulsa reintentar.";
    qrStatus.textContent =
      error instanceof Error ? error.message : "Error desconocido.";
    retryQr.classList.remove("hidden");
  }
};

showPreview.addEventListener("click", renderPreview);
retryQr.addEventListener("click", createDownloadSession);

resetState();
