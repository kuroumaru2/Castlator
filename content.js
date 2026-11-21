const DEFAULT_SETTINGS = {
  enabled: true,
  targetLang: "en",
  fontColor: "#3b82f6",
  fontSize: "0.92em",
  fontStyle: "normal",
  romajiOnHover: true
};

let settings = { ...DEFAULT_SETTINGS };

const JAPANESE_REGEX = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f\u4e00-\u9faf]/;

// Floating tooltip element for Romaji on hover
const romajiTooltip = document.createElement("div");
romajiTooltip.id = "tc-romaji-hover-popup";
Object.assign(romajiTooltip.style, {
  position: "fixed",
  zIndex: "2147483647",
  pointerEvents: "none",
  display: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  backgroundColor: "rgba(15, 23, 42, 0.95)",
  color: "#f8fafc",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35)",
  fontSize: "12.5px",
  lineHeight: "1.35",
  maxWidth: "360px",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
});
document.documentElement.appendChild(romajiTooltip);

function positionTooltip(clientX, clientY) {
  const offset = 14;
  const rect = romajiTooltip.getBoundingClientRect();
  let left = clientX + offset;
  let top = clientY + offset;

  if (left + rect.width > window.innerWidth - 10) {
    left = Math.max(10, clientX - rect.width - offset);
  }
  if (top + rect.height > window.innerHeight - 10) {
    top = Math.max(10, clientY - rect.height - offset);
  }

  romajiTooltip.style.left = `${left}px`;
  romajiTooltip.style.top = `${top}px`;
}

function showRomajiTooltip(romajiText, clientX, clientY) {
  if (!settings.romajiOnHover || !romajiText) {
    hideRomajiTooltip();
    return;
  }
  romajiTooltip.innerHTML = `<span style="color:#94a3b8;font-size:10.5px;text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:2px;">Romaji</span><span>${escapeHtml(
    romajiText
  )}</span>`;
  romajiTooltip.style.display = "block";
  positionTooltip(clientX, clientY);
}

function hideRomajiTooltip() {
  romajiTooltip.style.display = "none";
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyTranslationStyles(spanEl) {
  spanEl.style.color = settings.fontColor;
  spanEl.style.fontSize = settings.fontSize;
  spanEl.style.fontStyle = settings.fontStyle;
}

function updateAllExistingStyles() {
  document.querySelectorAll(".tc-chatslator-inline").forEach((spanEl) => {
    applyTranslationStyles(spanEl);
  });
  if (!settings.romajiOnHover) {
    hideRomajiTooltip();
  }
}

function attachHoverRomaji(element, getRomaji) {
  element.addEventListener("mouseenter", (e) => {
    const text = typeof getRomaji === "function" ? getRomaji() : getRomaji;
    if (text) showRomajiTooltip(text, e.clientX, e.clientY);
  });
  element.addEventListener("mousemove", (e) => {
    if (romajiTooltip.style.display === "block") {
      positionTooltip(e.clientX, e.clientY);
    }
  });
  element.addEventListener("mouseleave", () => {
    hideRomajiTooltip();
  });
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
  settings = { ...DEFAULT_SETTINGS, ...stored };
  updateAllExistingStyles();
  if (settings.enabled) scanExistingComments();
});

chrome.storage.onChanged.addListener((changes) => {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (changes[key]) {
      settings[key] = changes[key].newValue;
    }
  }
  updateAllExistingStyles();
  if (settings.enabled) scanExistingComments();
});

const COMMENT_ITEM_SELECTORS = [
  ".tw-comment-item",
  ".tw-player-comment-item",
  "[class*='comment-item']"
].join(", ");

const MESSAGE_TEXT_SELECTORS = [
  ".tw-comment-item-comment",
  ".tw-player-comment-item-comment",
  "[class*='comment-text']",
  "[class*='comment-body']",
  "[class*='message']"
].join(", ");

const EXCLUDE_SELECTORS = [
  ".tw-comment-item-author",
  ".tw-player-comment-item-author",
  ".tw-comment-item-name",
  ".tw-comment-item-screen-name",
  ".tw-comment-item-date",
  ".tw-comment-item-icon",
  "[class*='author']",
  "[class*='user']",
  "[class*='name']",
  "[class*='handle']",
  "[class*='time']",
  "[class*='date']",
  "a[href^='/']",
  "img",
  "svg",
  "button"
].join(", ");

function shouldSkipText(text) {
  const cleaned = text.trim();
  if (!cleaned) return true;
  if (/^[0-9\s!?.~ーwwｗ]+$/i.test(cleaned)) return true;
  return false;
}

function extractMessageTarget(commentItemNode) {
  const dedicatedTextNode = commentItemNode.querySelector(MESSAGE_TEXT_SELECTORS);
  if (dedicatedTextNode) {
    return {
      targetNode: dedicatedTextNode,
      cleanText: dedicatedTextNode.innerText?.trim() || ""
    };
  }

  const clone = commentItemNode.cloneNode(true);
  clone.querySelectorAll(EXCLUDE_SELECTORS).forEach((el) => el.remove());

  let text = clone.innerText?.trim() || "";

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines[0].includes("@")) {
    lines.shift();
    text = lines.join(" ");
  }

  const candidateNodes = Array.from(commentItemNode.querySelectorAll("div, span, p"))
    .filter((el) => !el.matches(EXCLUDE_SELECTORS) && el.innerText?.trim() === text);
  const targetNode = candidateNodes[candidateNodes.length - 1] || commentItemNode;

  return { targetNode, cleanText: text };
}

function processCommentNode(commentItemNode) {
  if (!settings.enabled) return;
  if (commentItemNode.dataset.tcTranslated === "true") return;

  const { targetNode, cleanText } = extractMessageTarget(commentItemNode);
  if (!cleanText || shouldSkipText(cleanText)) return;

  commentItemNode.dataset.tcTranslated = "true";

  chrome.runtime.sendMessage(
    { action: "translate", text: cleanText, targetLang: settings.targetLang },
    (response) => {
      if (chrome.runtime.lastError || !response) return;

      const hasJapanese = JAPANESE_REGEX.test(cleanText);
      const romaji = hasJapanese ? response.romaji : null;

      if (romaji) {
        commentItemNode.dataset.tcRomaji = romaji;
        attachHoverRomaji(targetNode, () => commentItemNode.dataset.tcRomaji || "");
      }

      const translated = response.translatedText?.trim();
      if (!translated || translated.toLowerCase() === cleanText.toLowerCase()) return;

      const translationSpan = document.createElement("span");
      translationSpan.className = "tc-chatslator-inline";
      translationSpan.textContent = `  (${translated})`;
      applyTranslationStyles(translationSpan);

      if (romaji) {
        attachHoverRomaji(translationSpan, () => commentItemNode.dataset.tcRomaji || "");
      }

      targetNode.appendChild(translationSpan);
    }
  );
}

function scanExistingComments() {
  document.querySelectorAll(COMMENT_ITEM_SELECTORS).forEach(processCommentNode);
}

const observer = new MutationObserver((mutations) => {
  if (!settings.enabled) return;

  for (const mutation of mutations) {
    for (const addedNode of mutation.addedNodes) {
      if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;

      if (addedNode.matches?.(COMMENT_ITEM_SELECTORS)) {
        processCommentNode(addedNode);
      } else {
        addedNode.querySelectorAll?.(COMMENT_ITEM_SELECTORS).forEach(processCommentNode);
      }
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});