const itemsList = document.querySelector("#items-list");
const itemCount = document.querySelector("#item-count");
const healthStatus = document.querySelector("#health-status");
const statusDot = document.querySelector(".status-dot");

// Replace this relative path with the final cloud-storage audio URL when needed.
// Keeping the audio source in one place makes the storage migration simple.
const cloudAudioUrl = "secret-cue.mp3";
const secretCue = "Keep it secret!";
const cloudAudio = new Audio(cloudAudioUrl);
cloudAudio.preload = "auto";

const speakSecretCue = () => {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(secretCue);
  const voices = window.speechSynthesis.getVoices();
  const cartoonVoice = voices.find((voice) => voice.lang.startsWith("en") && /Google|Microsoft|Samantha|Daniel/i.test(voice.name));
  speech.voice = cartoonVoice || voices.find((voice) => voice.lang.startsWith("en")) || null;
  speech.lang = "en-US";
  speech.pitch = 1.5;
  speech.rate = 1.02;
  speech.volume = 1;
  window.speechSynthesis.speak(speech);
};

const playSecretCue = () => {
  cloudAudio.currentTime = 0;
  cloudAudio.play().catch(() => speakSecretCue());
};

const emojiFor = (name) => {
  const lower = name.toLowerCase();
  if (lower.includes("sauce")) return "🥫";
  if (lower.includes("pickle")) return "🥒";
  if (lower.includes("jelly")) return "🪼";
  if (lower.includes("salt")) return "🧂";
  if (lower.includes("cheese")) return "🧀";
  return "✨";
};

const showMessage = (element, message, kind) => {
  element.textContent = message;
  element.className = `form-message ${kind}`;
};

const renderItems = (items) => {
  itemCount.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  if (!items.length) {
    itemsList.innerHTML = '<div class="empty">The vault is empty. Add the first secret!</div>';
    return;
  }
  itemsList.innerHTML = items.map((item, index) => `
    <article class="item-card" style="animation-delay:${index * 45}ms">
      <div class="item-emoji">${emojiFor(item.name)}</div>
      <div>
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-note">${escapeHtml(item.notes || "Ready for a Krabby Patty.")}</div>
      </div>
      <div class="quantity">× ${item.quantity}</div>
    </article>
  `).join("");
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const loadItems = async () => {
  try {
    const response = await fetch("/api/items");
    if (!response.ok) throw new Error("Inventory unavailable");
    renderItems(await response.json());
  } catch {
    itemsList.innerHTML = '<div class="empty">The inventory scanner is taking a nap. Try again soon!</div>';
  }
};

const checkHealth = async () => {
  try {
    const response = await fetch("/api/health");
    const result = await response.json();
    healthStatus.textContent = result.status;
    statusDot.classList.add("ready");
  } catch {
    healthStatus.textContent = "Kitchen connection needs attention";
  }
};

document.querySelector("#item-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#item-message");
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not add item");
    form.reset();
    form.quantity.value = 1;
    showMessage(message, `${result.name} added to the vault!`, "success");
    playSecretCue();
    await loadItems();
  } catch (error) {
    showMessage(message, error.message, "error");
  }
});

document.querySelector('input[type="file"]').addEventListener("change", (event) => {
  document.querySelector("#file-label").textContent = event.target.files[0]?.name || "Choose an image";
});

const uploadedImages = document.querySelector("#uploaded-images");
const uploadCount = document.querySelector("#upload-count");

const loadUploads = async () => {
  try {
    const response = await fetch("/api/uploads");
    if (!response.ok) throw new Error("Could not load saved images");
    const files = await response.json();

    uploadCount.textContent = `${files.length} ${files.length === 1 ? "image" : "images"}`;

    if (!files.length) {
      uploadedImages.innerHTML = '<div class="empty">No saved images yet. Upload one above!</div>';
      return;
    }

    uploadedImages.innerHTML = files.map((file) => `
      <figure class="uploaded-image-card">
        <a href="${escapeHtml(file.url)}" target="_blank" rel="noopener noreferrer">
          <img src="${escapeHtml(file.url)}" alt="Uploaded recipe image" loading="lazy" />
        </a>
        <figcaption title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</figcaption>
      </figure>
    `).join("");
  } catch {
    uploadedImages.innerHTML = '<div class="empty">Could not load saved images. Please refresh.</div>';
  }
};

document.querySelector("#upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#upload-message");

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: new FormData(form),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Upload failed");

    showMessage(message, `${result.file.originalName} stored safely!`, "success");
    form.reset();
    document.querySelector("#file-label").textContent = "Choose an image";
    await loadUploads();
  } catch (error) {
    showMessage(message, error.message || "Upload failed", "error");
  }
});

checkHealth();
loadItems();
loadUploads();