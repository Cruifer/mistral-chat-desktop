const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vibeChat", {
  send: (messages) => ipcRenderer.invoke("chat:send", { messages }),
  keyStatus: () => ipcRenderer.invoke("key:status"),
  setKey: (key) => ipcRenderer.invoke("key:set", key),
  saveText: (content, defaultName) =>
    ipcRenderer.invoke("file:save-text", { content, defaultName }),
  savePdf: (content, defaultName) =>
    ipcRenderer.invoke("file:save-pdf", { content, defaultName }),
});
