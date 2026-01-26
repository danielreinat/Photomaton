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
const showYes = document.getElementById("showYes");
const showNo = document.getElementById("showNo");
const photoList = document.getElementById("photoList");
const closePreview = document.getElementById("closePreview");

let photoCount = 0;
let photos = [];
let countdownTimer = null;
let cameraStream = null;

const resetPanels = () => {
  phonePanel.classList.add("hidden");
  screenPanel.classList.add("hidden");
  previewPanel.classList.add("hidden");
};

const resetState = () => {
  if (countdownTimer) {
    clearTimeout(countdownTimer);
  }
  photoCount = 0;
  photos = [];
  photoCanvas.style.display = "none";
  cameraFeed.style.display = "block";
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
    photoCanvas.style.display = "block";
    cameraFeed.style.display = "none";
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
      photoCanvas.style.display = "none";
      cameraFeed.style.display = "block";
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

const startSession = () => {
  resetPanels();
  startButton.disabled = true;
  resetButton.disabled = false;
  statusLabel.textContent = "Encendiendo cámara...";
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

phoneSubmit.addEventListener("click", () => {
  const phone = phoneInput.value.trim();
  if (!phone) {
    statusLabel.textContent = "Necesitamos un número válido para enviar las fotos.";
    return;
  }
  statusLabel.textContent = `Enviando fotos a ${phone} por WhatsApp...`;
  resetPanels();
  screenPanel.classList.remove("hidden");
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

startCamera();
resetState();
