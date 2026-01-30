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
const qrPanel = document.getElementById("qrPanel");
const qrImage = document.getElementById("qrImage");
const cameraPreview = document.querySelector(".camera-preview");
const filterPanel = document.getElementById("filterPanel");
const filterHint = document.getElementById("filterHint");
const filterCancel = document.getElementById("filterCancel");
const filterButtons = document.querySelectorAll("[data-filter]");
const cameraSelect = document.getElementById("cameraSelect");
const cameraHint = document.getElementById("cameraHint");

let photoCount = 0;
let photoDataUrls = [];
let downloadUrl = null;
let countdownTimer = null;
let cameraStream = null;
let publishChoice = null;
let currentFilter = "normal";
let isChoosingFilter = false;
let selectedDeviceId = "";

const FILTERS = {
  normal: {
    label: "Normal",
    css: "contrast(1.08) saturate(1.18) brightness(1.03) sepia(0.08)",
    hint: "Colores cálidos y vivos.",
  },

  mono: {
    label: "B/N",
    css: "grayscale(1) contrast(1.1)",
    hint: "Blanco y negro clásico.",
  },
};

const watermarkImage = new Image();
watermarkImage.src = "/static/logo.png";

const drawWatermark = (context, width, height) => {
  if (!watermarkImage.complete || watermarkImage.naturalWidth === 0) {
    return;
  }
  const drawWidth = watermarkImage.naturalWidth * scale;
  const drawHeight = watermarkImage.naturalHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = height - drawHeight - Math.max(height * 1, 1000);
  context.save();
  context.globalAlpha = 0.85;
  context.drawImage(watermarkImage, x, y, drawWidth, drawHeight);
  context.restore();
};

const drawCameraFrame = (context, video) => {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) {
    return;
  }
  if (photoCanvas.width !== videoWidth || photoCanvas.height !== videoHeight) {
    photoCanvas.width = videoWidth;
    photoCanvas.height = videoHeight;
  }
  const canvasWidth = photoCanvas.width;
  const canvasHeight = photoCanvas.height;
  const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const x = (canvasWidth - drawWidth) / 2;
  const y = (canvasHeight - drawHeight) / 2;
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.drawImage(video, x, y, drawWidth, drawHeight);
};

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
  isChoosingFilter = false;
  applyFilterSelection("normal");
  toggleCameraPreview(false);
  toggleCaptureFocus(false);
  countdown.textContent = "Listo";
  statusLabel.textContent = "Pulsa “Realizar foto” para comenzar.";
  resetPanels();
  startButton.disabled = false;
  resetButton.disabled = true;
  if (filterPanel) {
    filterPanel.classList.add("hidden");
  }
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

const updateCameraHint = (message, tone = "neutral") => {
  if (!cameraHint) {
    return;
  }
  cameraHint.textContent = message;
  cameraHint.classList.toggle("helper-text--warning", tone === "warning");
};

const buildVideoConstraints = () => {
  if (selectedDeviceId) {
    const { facingMode, ...rest } = PHOTO_CONSTRAINTS;
    return { ...rest, deviceId: { exact: selectedDeviceId } };
  }
  return PHOTO_CONSTRAINTS;
};

const populateCameraOptions = (devices) => {
  if (!cameraSelect) {
    return;
  }
  const currentValue = cameraSelect.value;
  cameraSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Cámara por defecto";
  cameraSelect.appendChild(defaultOption);
  devices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || "Cámara externa";
    cameraSelect.appendChild(option);
  });
  if (currentValue && devices.some((device) => device.deviceId === currentValue)) {
    cameraSelect.value = currentValue;
    selectedDeviceId = currentValue;
    return;
  }
  const eosDevice = devices.find((device) =>
    device.label.toLowerCase().includes("eos webcam utility")
  );
  if (eosDevice) {
    cameraSelect.value = eosDevice.deviceId;
    selectedDeviceId = eosDevice.deviceId;
    updateCameraHint(
      "EOS Webcam Utility detectado. Se usará la Canon conectada.",
      "neutral"
    );
    return;
  }
  const canonDevice = devices.find((device) =>
    device.label.toLowerCase().includes("canon")
  );
  if (canonDevice) {
    cameraSelect.value = canonDevice.deviceId;
    selectedDeviceId = canonDevice.deviceId;
    updateCameraHint(
      "Cámara Canon detectada. Puedes cambiar a EOS Webcam Utility si aparece en la lista.",
      "neutral"
    );
    return;
  }
  if (!devices.length) {
    updateCameraHint(
      "No se detectan cámaras aún. Conecta la Canon y abre EOS Webcam Utility.",
      "warning"
    );
  }
};

const refreshCameraDevices = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    updateCameraHint(
      "Tu navegador no permite listar cámaras. Se usará la cámara por defecto.",
      "warning"
    );
    return;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === "videoinput");
    populateCameraOptions(videoDevices);
  } catch (error) {
    updateCameraHint(
      "No se pudieron listar las cámaras disponibles. Usa la opción por defecto.",
      "warning"
    );
  }
};

const applyFilterSelection = (filterId) => {
  const selectedFilter = FILTERS[filterId] ? filterId : "normal";
  currentFilter = selectedFilter;
  filterButtons.forEach((button) => {
    button.classList.toggle(
      "filter-button--active",
      button.dataset.filter === selectedFilter
    );
  });
  const filterData = FILTERS[selectedFilter];
  if (filterHint) {
    filterHint.textContent = `Filtro seleccionado: ${filterData.label}. ${filterData.hint}`;
  }
  cameraFeed.style.filter = filterData.css;
  photoCanvas.style.filter = filterData.css;
};

const promptFilterSelection = () => {
  if (startButton.disabled || isChoosingFilter) {
    return;
  }
  isChoosingFilter = true;
  if (filterPanel) {
    filterPanel.classList.remove("hidden");
  }
  startButton.disabled = true;
  resetButton.disabled = false;
  statusLabel.textContent = "Elige un filtro para empezar.";
  updateCountdown("Filtro");
};

const cancelFilterSelection = () => {
  if (!isChoosingFilter) {
    return;
  }
  isChoosingFilter = false;
  if (filterPanel) {
    filterPanel.classList.add("hidden");
  }
  startButton.disabled = false;
  resetButton.disabled = true;
  statusLabel.textContent = "Pulsa “Realizar foto” para comenzar.";
  updateCountdown("Listo");
};

const capturePhoto = () => {
  photoCount += 1;
  if (cameraFeed.videoWidth && cameraFeed.videoHeight) {
    canvasContext.filter = FILTERS[currentFilter].css;
    drawCameraFrame(canvasContext, cameraFeed);
    canvasContext.filter = "none";
    drawWatermark(canvasContext, photoCanvas.width, photoCanvas.height);
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
  isChoosingFilter = false;
  if (filterPanel) {
    filterPanel.classList.add("hidden");
  }
  startButton.disabled = true;
  resetButton.disabled = false;
  statusLabel.textContent = `Filtro: ${FILTERS[currentFilter].label}. Encendiendo cámara...`;
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
      updateCountdown("¡Foto!");
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

startButton.addEventListener("click", promptFilterSelection);
resetButton.addEventListener("click", resetState);
publishYes.addEventListener("click", () => handlePublishChoice(true));
publishNo.addEventListener("click", () => handlePublishChoice(false));
filterCancel.addEventListener("click", cancelFilterSelection);
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyFilterSelection(button.dataset.filter);
    startSession();
  });
});

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
    await refreshCameraDevices();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: buildVideoConstraints(),
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
    await refreshCameraDevices();
  } catch (error) {
    if (selectedDeviceId) {
      selectedDeviceId = "";
      if (cameraSelect) {
        cameraSelect.value = "";
      }
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: PHOTO_CONSTRAINTS,
          audio: false,
        });
        cameraFeed.srcObject = cameraStream;
        toggleCameraPreview(true);
        await cameraFeed.play();
        statusLabel.textContent =
          "Cámara lista con el dispositivo por defecto.";
        updateCameraHint(
          "No se pudo acceder a la cámara seleccionada. Usando la cámara por defecto.",
          "warning"
        );
        startButton.disabled = false;
        toggleCaptureFocus(true);
        return;
      } catch (fallbackError) {
        // Continue to final error handling below.
      }
    }
    statusLabel.textContent =
      "No se pudo acceder a la cámara. Revisa permisos del navegador.";
    updateCameraHint(
      "No se pudo acceder a la cámara. Revisa permisos o instala EOS Webcam Utility.",
      "warning"
    );
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
    downloadStatus.textContent = "Enlace listo. Escanea el QR para abrir tus fotos.";
    statusLabel.textContent = "QR de descarga preparado.";
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

if (cameraSelect) {
  cameraSelect.addEventListener("change", () => {
    selectedDeviceId = cameraSelect.value;
    updateCameraHint(
      selectedDeviceId
        ? "Cámara seleccionada. Listo para iniciar."
        : "Se usará la cámara por defecto del sistema.",
      "neutral"
    );
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
      cameraFeed.srcObject = null;
      toggleCameraPreview(false);
      toggleCaptureFocus(false);
      statusLabel.textContent = "Cámara actualizada. Pulsa “Realizar foto”.";
      startButton.disabled = false;
      resetButton.disabled = false;
    }
  });
}

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener("devicechange", () => {
    refreshCameraDevices();
  });
}

refreshCameraDevices();
