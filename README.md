# Chat Mistral — app desktop (Electron)

App desktop per Windows (funziona anche su macOS/Linux) che parla con l'API Mistral
a consumo usando l'SDK ufficiale TypeScript
([@mistralai/mistralai](https://www.npmjs.com/package/@mistralai/mistralai)).

- Modello: `mistral-small-latest`
- La chiave `MISTRAL_API_KEY` resta **solo sul tuo computer**: non viene mai esposta
  alla finestra dell'app (processo renderer isolato) né inviata altrove.
- Salvataggio delle risposte in cartelle locali tramite i dialog nativi
  (`.md`/`.txt` o `.pdf`).

## Requisiti

- Node.js 18 o superiore
- Una chiave API da [console.mistral.ai](https://console.mistral.ai/)

## Installazione

```bash
npm install
```

## Avvio in sviluppo

```bash
npm start
```

Al primo avvio l'app chiede la chiave API in una finestra dedicata: la chiave viene
verificata contro l'API e salvata in locale nella cartella dati dell'app
(`%APPDATA%/mistral-chat-app/config.json` su Windows), con permessi restrittivi.

In alternativa puoi impostare la variabile d'ambiente `MISTRAL_API_KEY`
o creare un file `.env` accanto a `main.mjs` (copia `.env.example`): in quel caso
il pannello di configurazione non viene mostrato.

## Creare l'installer per Windows 11

```bash
npm run dist
```

Genera in `dist/` l'installer NSIS (`Mistral Chat Setup <versione>.exe`) con
scelta della cartella di installazione. Per una versione portabile senza
installazione aggiungi `"portable"` tra i target `win` in `package.json`.

Per cambiare icona e metadati, aggiungi i file nella configurazione `build` di
`package.json` (vedi [documentazione electron-builder](https://www.electron.build/)).

## Struttura

```
main.mjs           # processo main: finestra, chiamate SDK Mistral, dialog di salvataggio
preload.cjs        # ponte sicuro (contextBridge) tra interfaccia e processo main
public/
  index.html       # interfaccia chat + pannello chiave API
  app.js           # logica client (IPC verso il processo main)
  style.css        # stili
```

## Sicurezza

- Renderer isolato: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Le chiamate all'API Mistral avvengono solo nel processo main.
- La chiave salvata dal pannello è in un file locale con permessi `0600`;
  per rimuoverla basta cancellare quel file (o usare solo la variabile d'ambiente).

## Nota sulle prestazioni

Se Electron risultasse troppo pesante, la stessa app può essere riscritta in
Tauri (Rust + WebView2, ~10 MB): l'interfaccia in `public/` è già separata dalla
logica e riutilizzabile quasi tutta.
