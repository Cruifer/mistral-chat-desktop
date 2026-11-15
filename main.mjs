import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Mistral } from "@mistralai/mistralai";
import { jsPDF } from "jspdf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL = "mistral-small-latest";

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

let configPath;
let mainWindow;

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function getApiKey() {
  return process.env.MISTRAL_API_KEY || loadConfig().mistralApiKey || null;
}

function extractMessages(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.messages)) return null;
  const messages = [];
  for (const msg of raw.messages) {
    if (!msg || typeof msg !== "object") return null;
    if (msg.role !== "user" && msg.role !== "assistant") return null;
    if (typeof msg.content !== "string" || msg.content.length === 0 || msg.content.length > 8000) {
      return null;
    }
    messages.push({ role: msg.role, content: msg.content });
  }
  if (messages.length === 0 || messages.length > 50) return null;
  return messages;
}

function buildPdf(text) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 14;
  let y = margin;

  for (const paragraph of String(text).split(/\r?\n/)) {
    const lines = paragraph.trim() ? doc.splitTextToSize(paragraph, maxWidth) : [""];
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 6;
  }
  return Buffer.from(doc.output("arraybuffer"));
}

function registerIpc() {
  ipcMain.handle("chat:send", async (_event, raw) => {
    const apiKey = getApiKey();
    if (!apiKey) return { error: "Chiave API non configurata" };
    const messages = extractMessages(raw);
    if (!messages) return { error: "Formato messaggi non valido" };
    try {
      const client = new Mistral({ apiKey });
      const result = await client.chat.complete({ model: MODEL, messages });
      return { reply: result?.choices?.[0]?.message?.content ?? "" };
    } catch (err) {
      console.error("Errore API Mistral:", err.message ?? err);
      return { error: "Errore nella chiamata all'API Mistral" };
    }
  });

  ipcMain.handle("key:status", () => Boolean(getApiKey()));

  ipcMain.handle("key:set", async (_event, apiKey) => {
    if (typeof apiKey !== "string" || apiKey.trim().length < 10) {
      return { ok: false, error: "Chiave non valida" };
    }
    try {
      const client = new Mistral({ apiKey: apiKey.trim() });
      await client.models.list();
    } catch {
      return { ok: false, error: "Chiave rifiutata dall'API Mistral" };
    }
    const config = loadConfig();
    config.mistralApiKey = apiKey.trim();
    saveConfig(config);
    return { ok: true };
  });

  ipcMain.handle("file:save-text", async (_event, { content, defaultName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || "risposta.md",
      filters: [
        { name: "Markdown / Testo", extensions: ["md", "txt"] },
        { name: "Tutti i file", extensions: ["*"] },
      ],
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, String(content), "utf8");
    return filePath;
  });

  ipcMain.handle("file:save-pdf", async (_event, { content, defaultName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || "risposta.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, buildPdf(content));
    return filePath;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 480,
    minHeight: 480,
    autoHideMenuBar: true,
    title: "Chat Mistral",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "public", "index.html"));
}

app.whenReady().then(() => {
  configPath = path.join(app.getPath("userData"), "config.json");
  loadEnvFile();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
