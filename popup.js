const DEFAULTS = {
  enabled: true,
  targetLang: "en",
  fontColor: "#3b82f6",
  fontSize: "0.92em",
  fontStyle: "normal",
  romajiOnHover: true
};

const enableToggle = document.getElementById("enableToggle");
const romajiHoverToggle = document.getElementById("romajiHoverToggle");
const langSelect = document.getElementById("langSelect");
const fontColorInput = document.getElementById("fontColorInput");
const fontSizeSelect = document.getElementById("fontSizeSelect");
const fontStyleSelect = document.getElementById("fontStyleSelect");
const resetBtn = document.getElementById("resetBtn");
const statusText = document.getElementById("statusText");

chrome.storage.sync.get(DEFAULTS, (settings) => {
  enableToggle.checked = settings.enabled;
  romajiHoverToggle.checked = settings.romajiOnHover;
  langSelect.value = settings.targetLang;
  fontColorInput.value = settings.fontColor;
  fontSizeSelect.value = settings.fontSize;
  fontStyleSelect.value = settings.fontStyle;
});

function showSaved() {
  statusText.textContent = "Saved!";
  setTimeout(() => {
    statusText.textContent = "";
  }, 1200);
}

function saveSettings() {
  chrome.storage.sync.set(
    {
      enabled: enableToggle.checked,
      romajiOnHover: romajiHoverToggle.checked,
      targetLang: langSelect.value,
      fontColor: fontColorInput.value,
      fontSize: fontSizeSelect.value,
      fontStyle: fontStyleSelect.value
    },
    showSaved
  );
}

[
  enableToggle,
  romajiHoverToggle,
  langSelect,
  fontColorInput,
  fontSizeSelect,
  fontStyleSelect
].forEach((el) => {
  el.addEventListener("change", saveSettings);
});

resetBtn.addEventListener("click", () => {
  fontColorInput.value = DEFAULTS.fontColor;
  fontSizeSelect.value = DEFAULTS.fontSize;
  fontStyleSelect.value = DEFAULTS.fontStyle;
  romajiHoverToggle.checked = DEFAULTS.romajiOnHover;
  saveSettings();
});