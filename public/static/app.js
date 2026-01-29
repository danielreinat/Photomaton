const startButton = document.getElementById("startButton");
const resetButton = document.getElementById("resetButton");
const countdown = document.getElementById("countdown");
const statusLabel = document.getElementById("status");
const cameraFeed = document.getElementById("cameraFeed");
const photoCanvas = document.getElementById("photoCanvas");
const canvasContext = photoCanvas.getContext("2d");
const publishPanel = document.getElementById("publishPanel");
const publishYes = document.getElementById("publishYes");
const publishNo = document.getElementById("publishNo");
const downloadPanel = document.getElementById("downloadPanel");
const downloadStatus = document.getElementById("downloadStatus");
const downloadLink = document.getElementById("downloadLink");
const qrPanel = document.getElementById("qrPanel");
const qrImage = document.getElementById("qrImage");
const cameraPreview = document.querySelector(".camera-preview");

let photoCount = 0;
let photoDataUrls = [];
let downloadUrl = null;
let countdownTimer = null;
let cameraStream = null;
let publishChoice = null;

const toggleCameraPreview = (show) => {
  if (show) {
    cameraFeed.classList.remove("hidden");
    photoCanvas.classList.add("hidden");
  } else {
    cameraFeed.classList.add("hidden");
    photoCanvas.classList.add("hidden");
  }
};

const toggleCaptureFocus = (active) => {
  if (!cameraPreview) {
    return;
  }
  cameraPreview.classList.toggle("camera-preview--active", active);
};

const resetPanels = () => {
  publishPanel.classList.add("hidden");
  downloadPanel.classList.add("hidden");
  downloadStatus.textContent = "";
  if (downloadLink) {
    downloadLink.classList.add("hidden");
    downloadLink.setAttribute("href", "#");
  }
  if (qrPanel) {
    qrPanel.classList.add("hidden");
  }
  if (qrImage) {
    qrImage.removeAttribute("src");
  }
};

const resetState = () => {
  if (countdownTimer) {
    clearTimeout(countdownTimer);
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraFeed.srcObject = null;
  photoCount = 0;
  photoDataUrls = [];
  downloadUrl = null;
  publishChoice = null;
  toggleCameraPreview(false);
  toggleCaptureFocus(false);
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
  statusLabel.textContent = `Foto ${photoCount} tomada.`;
  updateCountdown(`${photoCount}/3`);

  if (photoCount < 3) {
    setTimeout(() => {
      photoCanvas.classList.add("hidden");
      cameraFeed.classList.remove("hidden");
    }, 600);
    const startInterPhotoCountdown = (seconds) => {
      let remaining = seconds;
      const tick = () => {
        updateCountdown(remaining);
        statusLabel.textContent = `Siguiente foto en ${remaining} segundo${
          remaining === 1 ? "" : "s"
        }...`;
        remaining -= 1;
        if (remaining > 0) {
          countdownTimer = setTimeout(tick, 1000);
        } else {
          countdownTimer = setTimeout(capturePhoto, 1000);
        }
      };
      tick();
    };
    startInterPhotoCountdown(2);
  } else {
    countdownTimer = setTimeout(() => {
      resetPanels();
      toggleCaptureFocus(false);
      publishPanel.classList.remove("hidden");
      statusLabel.textContent = "¿Quieres publicar las fotos en redes sociales?";
      updateCountdown("✓");
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
  toggleCaptureFocus(true);
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

const handlePublishChoice = (choice) => {
  publishChoice = choice;
  publishPanel.classList.add("hidden");
  downloadPanel.classList.remove("hidden");
  statusLabel.textContent = "Generando tu enlace de descarga...";
  updateCountdown("✓");
  createDownloadSession();
};

startButton.addEventListener("click", startSession);
resetButton.addEventListener("click", resetState);
publishYes.addEventListener("click", () => handlePublishChoice(true));
publishNo.addEventListener("click", () => handlePublishChoice(false));

const startCamera = async () => {
  if (cameraStream) {
    toggleCameraPreview(true);
    toggleCaptureFocus(true);
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusLabel.textContent =
      "Tu navegador no soporta la cámara. Usa un dispositivo compatible.";
    startButton.disabled = true;
    toggleCaptureFocus(false);
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: PHOTO_CONSTRAINTS,
      audio: false,
    });
    cameraFeed.srcObject = cameraStream;
    toggleCameraPreview(true);
    try {
      await cameraFeed.play();
    } catch (error) {
      statusLabel.textContent =
        "No se pudo iniciar la cámara automáticamente. Toca la pantalla y vuelve a intentarlo.";
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
      cameraFeed.srcObject = null;
      startButton.disabled = false;
      toggleCaptureFocus(false);
      return;
    }
    statusLabel.textContent = "Cámara lista. Pulsa “Realizar foto”.";
  } catch (error) {
    statusLabel.textContent =
      "No se pudo acceder a la cámara. Revisa permisos del navegador.";
    startButton.disabled = true;
    toggleCameraPreview(false);
    toggleCaptureFocus(false);
  }
};

const createDownloadSession = async () => {
  if (!photoDataUrls.length) {
    downloadStatus.textContent = "No hay fotos disponibles para descargar.";
    return;
  }
  downloadStatus.textContent = "Generando enlace seguro...";
  try {
    const response = await fetch("/api/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: photoDataUrls, publish: publishChoice === true }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "No se pudo generar el enlace.");
    }
    downloadUrl = payload.downloadUrl;
    downloadStatus.textContent = "Enlace listo. Puedes abrir tus fotos.";
    statusLabel.textContent = "Enlace de descarga preparado.";
    if (downloadLink) {
      downloadLink.setAttribute("href", downloadUrl);
      downloadLink.classList.remove("hidden");
    }
    if (qrPanel && qrImage) {
      qrImage.setAttribute(
        "src",
        `/api/qr?size=260x260&data=${encodeURIComponent(downloadUrl)}`
      );
      qrPanel.classList.remove("hidden");
    }
  } catch (error) {
    statusLabel.textContent =
      "No se pudo generar el enlace. Intenta de nuevo.";
    downloadStatus.textContent =
      error instanceof Error ? error.message : "Error desconocido.";
  }
};

resetState();
