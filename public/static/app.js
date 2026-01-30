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
const securityModal = document.getElementById("securityModal");
const securityTitle = document.getElementById("securityTitle");
const securityMessage = document.getElementById("securityMessage");
const securityPasswordInput = document.getElementById("securityPassword");
const securitySubmit = document.getElementById("securitySubmit");
const securityError = document.getElementById("securityError");
const securityExitActions = document.getElementById("securityExitActions");
const securityStay = document.getElementById("securityStay");
const securityExit = document.getElementById("securityExit");

let photoCount = 0;
let photoDataUrls = [];
let downloadUrl = null;
let countdownTimer = null;
let cameraStream = null;
let publishChoice = null;
let currentFilter = "normal";
let isChoosingFilter = false;
let securityUnlocked = false;
let exitApproved = false;
let securityMode = "entry";
let exitRequested = false;

const PHOTO_ASPECT_RATIO = 3 / 2;
const ACCESS_PASSWORD = document.body?.dataset.accessPassword?.trim() || "1234";

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
  const maxWidth = Math.min(width * 0.55, 360);
  const scale = maxWidth / watermarkImage.naturalWidth;
  const drawWidth = watermarkImage.naturalWidth * scale;
  const drawHeight = watermarkImage.naturalHeight * scale;
  const x = (width - drawWidth) / 2;
  const margin = Math.max(height * 0.04, 24);
  const y = Math.max(height - drawHeight - margin, margin);
  context.save();
  context.globalAlpha = 0.85; 
  context.drawImage(watermarkImage, x, y, drawWidth, drawHeight);
  context.restore();
};

const drawCameraFrame = (context, video, filter = "none", targetCanvas = photoCanvas) => {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) {
    return;
  }
  const sourceRatio = videoWidth / videoHeight;
  let cropWidth = videoWidth;
  let cropHeight = videoHeight;
  let sourceX = 0;
  let sourceY = 0;
  if (sourceRatio > PHOTO_ASPECT_RATIO) {
    cropHeight = videoHeight;
    cropWidth = Math.round(videoHeight * PHOTO_ASPECT_RATIO);
    sourceX = Math.round((videoWidth - cropWidth) / 2);
  } else if (sourceRatio < PHOTO_ASPECT_RATIO) {
    cropWidth = videoWidth;
    cropHeight = Math.round(videoWidth / PHOTO_ASPECT_RATIO);
    sourceY = Math.round((videoHeight - cropHeight) / 2);
  }
  if (targetCanvas.width !== cropWidth || targetCanvas.height !== cropHeight) {
    targetCanvas.width = cropWidth;
    targetCanvas.height = cropHeight;
  }
  const canvasWidth = targetCanvas.width;
  const canvasHeight = targetCanvas.height;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.filter = filter;
  context.drawImage(
    video,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvasWidth,
    canvasHeight
  );
  context.filter = "none";
};

const setSecurityMode = (mode) => {
  securityMode = mode;
  if (!securityModal) {
    return;
  }
  if (mode === "exit") {
    if (securityTitle) {
      securityTitle.textContent = "Salida protegida";
    }
    if (securityMessage) {
      securityMessage.textContent =
        "Introduce la contraseña para cerrar la pestaña o salir de la ventana.";
    }
    if (securitySubmit) {
      securitySubmit.classList.add("hidden");
    }
    if (securityExitActions) {
      securityExitActions.classList.remove("hidden");
    }
  } else {
    if (securityTitle) {
      securityTitle.textContent = "Acceso protegido";
    }
    if (securityMessage) {
      securityMessage.textContent = "Introduce la contraseña para continuar.";
    }
    if (securitySubmit) {
      securitySubmit.textContent = "Entrar";
      securitySubmit.classList.remove("hidden");
    }
    if (securityExitActions) {
      securityExitActions.classList.add("hidden");
    }
  }
};

const showSecurityModal = (mode = "entry") => {
  if (!securityModal) {
    return;
  }
  setSecurityMode(mode);
  securityModal.classList.remove("hidden");
  securityModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("security-locked");
  if (securityPasswordInput) {
    securityPasswordInput.value = "";
    securityPasswordInput.focus();
  }
  if (securityError) {
    securityError.classList.add("hidden");
  }
};

const hideSecurityModal = () => {
  if (!securityModal) {
    return;
  }
  securityModal.classList.add("hidden");
  securityModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("security-locked");
};

const validateSecurityPassword = () => {
  if (!securityPasswordInput) {
    return false;
  }
  const entered = securityPasswordInput.value.trim();
  return entered === ACCESS_PASSWORD;
};

const handleSecuritySuccess = () => {
  if (securityMode === "exit") {
    exitApproved = true;
    exitRequested = false;
    hideSecurityModal();
    window.removeEventListener("beforeunload", handleBeforeUnload);
    const attemptClose = () => {
      window.close();
      if (!window.closed) {
        window.location.replace("about:blank");
      }
    };
    setTimeout(attemptClose, 50);
  } else {
    securityUnlocked = true;
    hideSecurityModal();
  }
};

const handleSecuritySubmit = () => {
  if (validateSecurityPassword()) {
    handleSecuritySuccess();
    return;
  }
  if (securityError) {
    securityError.classList.remove("hidden");
  }
  if (securityPasswordInput) {
    securityPasswordInput.value = "";
    securityPasswordInput.focus();
  }
};

const handleBeforeUnload = (event) => {
  if (exitApproved) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
  if (!exitRequested) {
    exitRequested = true;
    showSecurityModal("exit");
  }
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
  aspectRatio: PHOTO_ASPECT_RATIO,
  width: { ideal: 4500 },
  height: { ideal: 3000 },
  frameRate: { ideal: 30, max: 60 },
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
    drawCameraFrame(canvasContext, cameraFeed, FILTERS[currentFilter].css, photoCanvas);
    photoCanvas.classList.remove("hidden");
    cameraFeed.classList.add("hidden");
    const outputCanvas = document.createElement("canvas");
    const outputContext = outputCanvas.getContext("2d");
    if (outputContext) {
      drawCameraFrame(outputContext, cameraFeed, FILTERS[currentFilter].css, outputCanvas);
      drawWatermark(outputContext, outputCanvas.width, outputCanvas.height);
      photoDataUrls.push(outputCanvas.toDataURL("image/jpeg", 0.95));
    }
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

if (securitySubmit) {
  securitySubmit.addEventListener("click", handleSecuritySubmit);
}

if (securityPasswordInput) {
  securityPasswordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSecuritySubmit();
    }
  });
}

if (securityStay) {
  securityStay.addEventListener("click", () => {
    exitRequested = false;
    hideSecurityModal();
  });
}

if (securityExit) {
  securityExit.addEventListener("click", handleSecuritySubmit);
}

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
    downloadStatus.textContent = "Enlace listo.";
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
showSecurityModal("entry");
window.addEventListener("beforeunload", handleBeforeUnload);
