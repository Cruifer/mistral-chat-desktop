const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const settingsEl = document.getElementById("settings");
const settingsForm = document.getElementById("settings-form");
const settingsError = document.getElementById("settings-error");
const apiKeyInput = document.getElementById("api-key");

const history = [];
let counter = 0;
const replies = new Map();

function addMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `message-row ${role}`;

  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;
  wrapper.appendChild(div);

  if (role === "assistant" && text) {
    const id = `msg-${++counter}`;
    replies.set(id, text);
    div.dataset.id = id;
    wrapper.appendChild(buildSaveBar(id));
  }

  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function buildSaveBar(id) {
  const bar = document.createElement("div");
  bar.className = "save-bar";

  const mdBtn = document.createElement("button");
  mdBtn.type = "button";
  mdBtn.textContent = "Salva .md";
  mdBtn.addEventListener("click", () => saveMessage(id, "md"));

  const pdfBtn = document.createElement("button");
  pdfBtn.type = "button";
  pdfBtn.textContent = "Salva .pdf";
  pdfBtn.addEventListener("click", () => saveMessage(id, "pdf"));

  bar.append(mdBtn, pdfBtn);
  return bar;
}

async function saveMessage(id, format) {
  const content = replies.get(id);
  if (!content) return;
  const defaultName = `risposta-${new Date().toISOString().slice(0, 10)}.${format}`;
  const saved = format === "pdf"
    ? await window.vibeChat.savePdf(content, defaultName)
    : await window.vibeChat.saveText(content, defaultName);
  if (saved) {
    const bar = messagesEl.querySelector(`[data-id="${id}"] .save-bar`);
    if (bar) {
      const note = document.createElement("span");
      note.className = "saved-note";
      note.textContent = `Salvato: ${saved.split(/[\\/]/).pop()}`;
      bar.replaceChildren(note);
    }
  }
}

function setBusy(busy) {
  sendBtn.disabled = busy;
  input.disabled = busy;
}

async function checkKey() {
  const hasKey = await window.vibeChat.keyStatus();
  settingsEl.classList.toggle("hidden", hasKey);
  input.disabled = !hasKey;
  sendBtn.disabled = !hasKey;
  if (hasKey) input.focus();
  else apiKeyInput.focus();
}

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  settingsError.classList.add("hidden");
  const result = await window.vibeChat.setKey(apiKeyInput.value.trim());
  if (!result.ok) {
    settingsError.textContent = result.error;
    settingsError.classList.remove("hidden");
    return;
  }
  apiKeyInput.value = "";
  checkKey();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addMessage("user", text);
  history.push({ role: "user", content: text });

  const pending = addMessage("assistant", "…");
  setBusy(true);

  try {
    const data = await window.vibeChat.send(history);
    if (data.error) throw new Error(data.error);
    pending.textContent = data.reply;
    const id = `msg-${++counter}`;
    replies.set(id, data.reply);
    pending.dataset.id = id;
    pending.parentElement.appendChild(buildSaveBar(id));
    history.push({ role: "assistant", content: data.reply });
  } catch (err) {
    pending.textContent = `Errore: ${err.message}`;
    pending.classList.add("error");
  } finally {
    setBusy(false);
    input.focus();
  }
});

checkKey();
