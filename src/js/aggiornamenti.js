// All'avvio controlla se su GitHub c'è una versione più nuova.
// Vale solo per Lord installato. Mentre lo provi dal computer di sviluppo non fa nulla.

import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { conferma } from "./finestre.js";
import { messaggio } from "./modifiche.js";

export function avviaAggiornamenti() {
  if (!window.__TAURI_INTERNALS__ && !window.__TAURI__) return;
  controlla().catch((errore) => {
    console.warn("Non riesco a controllare gli aggiornamenti.", errore);
  });
}

async function controlla() {
  const aggiornamento = await check();
  if (!aggiornamento) return;
  const si = await conferma(`È pronta la versione ${aggiornamento.version}. Vuoi installarla adesso? Lord si chiude e si riapre da solo.`);
  if (!si) return;
  messaggio("Sto scaricando l'aggiornamento…");
  await aggiornamento.downloadAndInstall();
  await relaunch();
}
