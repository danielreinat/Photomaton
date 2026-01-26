const startButton = document.getElementById("startButton");
const resetButton = document.getElementById("resetButton");
const countdown = document.getElementById("countdown");
const statusLabel = document.getElementById("status");
const cameraFeed = document.getElementById("cameraFeed");
const photoCanvas = document.getElementById("photoCanvas");
const canvasContext = photoCanvas.getContext("2d");
const phonePanel = document.getElementById("phonePanel");
const screenPanel = document.getElementById("screenPanel");
const previewPanel = document.getElementById("previewPanel");
const phoneInput = document.getElementById("phoneInput");
const phoneSubmit = document.getElementById("phoneSubmit");
const whatsappHelper = document.getElementById("whatsappHelper");
const showYes = document.getElementById("showYes");
const showNo = document.getElementById("showNo");
const photoList = document.getElementById("photoList");
const closePreview = document.getElementById("closePreview");

let photoCount = 0;
let photos = [];
let lastPhotoDataUrl = null;
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
  phonePanel.classList.add("hidden");
  screenPanel.classList.add("hidden");
  previewPanel.classList.add("hidden");
  whatsappHelper.textContent = "";
};

const resetState = () => {
  if (countdownTimer) {
    clearTimeout(countdownTimer);
  }
  photoCount = 0;
  photos = [];
  lastPhotoDataUrl = null;
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

const capturePhoto = () => {
  photoCount += 1;
  if (cameraFeed.videoWidth && cameraFeed.videoHeight) {
    photoCanvas.width = cameraFeed.videoWidth;
    photoCanvas.height = cameraFeed.videoHeight;
    canvasContext.drawImage(cameraFeed, 0, 0);
    photoCanvas.classList.remove("hidden");
    cameraFeed.classList.add("hidden");
    lastPhotoDataUrl = photoCanvas.toDataURL("image/jpeg", 0.9);
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
      phonePanel.classList.remove("hidden");
      statusLabel.textContent = "Introduce tu número para enviar las fotos.";
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

const buildShareMessage = () =>
  "¡Hola! Aquí tienes tu foto del photomaton. Adjunta la imagen descargada.";

const dataUrlToFile = (dataUrl) => {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new File([array], "photomaton.jpg", { type: mime });
};

phoneSubmit.addEventListener("click", async () => {
  const phone = phoneInput.value.trim();
  if (!phone) {
    statusLabel.textContent = "Necesitamos un número válido para enviar las fotos.";
    return;
  }
  const sanitizedPhone = phone.replace(/[^\d]/g, "");
  const message = buildShareMessage();
  statusLabel.textContent = `Preparando envío a ${phone} por WhatsApp...`;
  resetPanels();
  screenPanel.classList.remove("hidden");
  whatsappHelper.textContent =
    "Se abrirá WhatsApp Web para enviar la foto. Si tu navegador lo permite, también aparecerá el diálogo de compartir.";

  if (lastPhotoDataUrl) {
    const photoFile = dataUrlToFile(lastPhotoDataUrl);
    if (navigator.canShare && navigator.canShare({ files: [photoFile] })) {
      try {
        await navigator.share({
          files: [photoFile],
          text: message,
          title: "Photomaton",
        });
      } catch (error) {
        // Ignorar cancelaciones del usuario.
      }
    }
  }

  if (sanitizedPhone) {
    const whatsappUrl = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  }
});

showYes.addEventListener("click", () => {
  resetPanels();
  statusLabel.textContent = "Enviando fotos a la pantalla...";
  photoList.innerHTML = "";
  photos.forEach((photo) => {
    const item = document.createElement("li");
    item.textContent = photo;
    photoList.appendChild(item);
  });
  previewPanel.classList.remove("hidden");
});

showNo.addEventListener("click", () => {
  statusLabel.textContent = "Sesión finalizada. ¡Gracias!";
  resetState();
});

closePreview.addEventListener("click", () => {
  statusLabel.textContent = "Sesión finalizada. ¡Gracias!";
  resetState();
});

const startCamera = async () => {
  if (cameraStream) {
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    cameraFeed.srcObject = cameraStream;
    statusLabel.textContent = "Cámara lista. Pulsa “Realizar foto”.";
  } catch (error) {
    statusLabel.textContent =
      "No se pudo acceder a la cámara. Revisa permisos del navegador.";
    startButton.disabled = true;
  }
};

resetState();
