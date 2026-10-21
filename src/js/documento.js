// Apre, salva e ripristina la relazione. La bozza resta anche se chiudi la finestra.

import { foglio } from "./editor.js";
import { apriTesto, salvaByte } from "./file-disco.js";
import { avvisa, conferma } from "./finestre.js";
import { messaggio, segnaModifica } from "./modifiche.js";
import { htmlIntestazione, htmlPie, impostaFasce } from "./fasce-foglio.js";
import { preparaImmagini } from "./immagini.js";
import { ricalcolaTutte } from "./tabelle.js";
import { impostaStili, leggiStili } from "./stili-documento.js";
import { aggiornaPosizioneNumero } from "./numeri-pagina.js";

const CHIAVE = "relaziolore-bozza";
const FORMATI = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  A6: [105, 148],
};

function millimetriInTwip(millimetri) {
  return Math.round((millimetri * 1440) / 25.4);
}

function leggiMillimetri(id, riserva) {
  const valore = Number(document.getElementById(id).value);
  if (!Number.isFinite(valore)) return riserva;
  return Math.min(600, Math.max(100, Math.round(valore)));
}

function nomeDaMisure(larghezza, altezza) {
  const trovato = Object.entries(FORMATI).find(([, misure]) => misure[0] === larghezza && misure[1] === altezza);
  return trovato ? trovato[0] : "personalizzato";
}

function applicaFormatoVisivo() {
  const pagina = opzioniPagina();
  const radice = document.documentElement;
  radice.style.setProperty("--pagina-larghezza", `${pagina.larghezza}mm`);
  radice.style.setProperty("--pagina-altezza", `${pagina.altezza}mm`);
  radice.style.setProperty("--margine-sopra", `${pagina.margineSopra}mm`);
  radice.style.setProperty("--margine-sotto", `${pagina.margineSotto}mm`);
  radice.style.setProperty("--margine-sinistra", `${pagina.margineSinistra}mm`);
  radice.style.setProperty("--margine-destra", `${pagina.margineDestra}mm`);
  radice.style.setProperty("--distanza-intestazione", `${pagina.distanzaIntestazione}mm`);
  radice.style.setProperty("--pagina-testo", `${Math.max(40, pagina.larghezza - pagina.margineSinistra - pagina.margineDestra)}mm`);
  document.dispatchEvent(new CustomEvent("formato-pagina"));
}
const HTML_INIZIALE = "<p><br></p>";

export function avviaDocumento() {
  document.getElementById("btn-nuovo").addEventListener("click", nuova);
  document.getElementById("btn-salva").addEventListener("click", salva);
  document.getElementById("btn-apri").addEventListener("click", apri);
  document.getElementById("numeri-pagina").addEventListener("change", segnaModifica);
  document.getElementById("posizione-numero").addEventListener("change", segnaModifica);
  document.getElementById("formato-pagina").addEventListener("change", (evento) => {
    const misure = FORMATI[evento.target.value];
    if (misure) {
      document.getElementById("larghezza-pagina").value = String(misure[0]);
      document.getElementById("altezza-pagina").value = String(misure[1]);
    }
    if (normalizzaMargini()) messaggio("Ho ridotto un margine, così resta spazio per scrivere.");
    else if (normalizzaDistanzaIntestazione()) messaggio("Ho avvicinato l’intestazione al bordo, così resta nel margine alto.");
    applicaFormatoVisivo();
    segnaModifica();
  });
  document.getElementById("larghezza-pagina").addEventListener("change", aggiornaMisurePagina);
  document.getElementById("altezza-pagina").addEventListener("change", aggiornaMisurePagina);
  for (const id of ["margine-sopra", "margine-sotto", "margine-sinistra", "margine-destra"]) {
    document.getElementById(id).addEventListener("change", aggiornaMargine);
  }
  document.getElementById("distanza-intestazione").addEventListener("change", aggiornaDistanzaIntestazione);

  document.addEventListener("keydown", (evento) => {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "s") {
      evento.preventDefault();
      salva();
    }
  });

  let timer = null;
  document.addEventListener("relazione-modificata", () => {
    clearTimeout(timer);
    timer = setTimeout(salvaBozza, 700);
  });

  applicaFormatoVisivo();
  const bozza = localStorage.getItem(CHIAVE);
  if (!bozza) return;
  try {
    applica(JSON.parse(bozza));
    messaggio("Bozza precedente ripristinata.");
  } catch {
    messaggio("Pronto.");
  }
}

export function opzioniPagina() {
  const formatoScelto = document.getElementById("formato-pagina")?.value || "A4";
  const standard = FORMATI[formatoScelto];
  const larghezza = standard ? standard[0] : leggiMillimetri("larghezza-pagina", 210);
  const altezza = standard ? standard[1] : leggiMillimetri("altezza-pagina", 297);
  const margineSopra = leggiMargine("margine-sopra", 18);
  const margineSotto = leggiMargine("margine-sotto", 22);
  const margineSinistra = leggiMargine("margine-sinistra", 18);
  const margineDestra = leggiMargine("margine-destra", 18);
  return {
    numeri: document.getElementById("numeri-pagina").checked,
    posizione: document.getElementById("posizione-numero").value,
    formato: standard ? formatoScelto : "personalizzato",
    nome: standard ? formatoScelto : `${larghezza} × ${altezza} mm`,
    larghezza,
    altezza,
    larghezzaTwip: millimetriInTwip(larghezza),
    altezzaTwip: millimetriInTwip(altezza),
    margineSopra,
    margineSotto,
    margineSinistra,
    margineDestra,
    margineSopraTwip: millimetriInTwip(margineSopra),
    margineSottoTwip: millimetriInTwip(margineSotto),
    margineSinistraTwip: millimetriInTwip(margineSinistra),
    margineDestraTwip: millimetriInTwip(margineDestra),
    distanzaIntestazione: leggiDistanzaIntestazione(),
    distanzaIntestazioneTwip: millimetriInTwip(leggiDistanzaIntestazione()),
    intestazione: htmlIntestazione(),
    pie: htmlPie(),
  };
}

function leggiMargine(id, riserva) {
  const campo = document.getElementById(id);
  const valore = Number(campo?.value);
  if (!Number.isFinite(valore)) return riserva;
  return Math.min(80, Math.max(0, Math.round(valore)));
}

function leggiDistanzaIntestazione() {
  return leggiMargine("distanza-intestazione", 2);
}

function normalizzaDistanzaIntestazione() {
  const campo = document.getElementById("distanza-intestazione");
  if (!campo) return false;
  const margine = leggiMargine("margine-sopra", 18);
  const massimo = Math.max(0, margine - 6);
  let valore = leggiDistanzaIntestazione();
  let ridotta = false;
  if (valore > massimo) {
    valore = massimo;
    ridotta = true;
  }
  campo.value = String(valore);
  return ridotta;
}

function normalizzaMargini() {
  const pagina = opzioniPagina();
  let ridotto = false;
  const sistema = (id, altroId, tetto) => {
    const campo = document.getElementById(id);
    const altro = leggiMargine(altroId, 0);
    let valore = leggiMargine(id, 0);
    const massimo = Math.max(0, tetto - altro);
    if (valore > massimo) {
      valore = Math.round(massimo);
      ridotto = true;
    }
    campo.value = String(valore);
  };
  sistema("margine-destra", "margine-sinistra", pagina.larghezza - 40);
  sistema("margine-sinistra", "margine-destra", pagina.larghezza - 40);
  sistema("margine-sotto", "margine-sopra", pagina.altezza - 40);
  sistema("margine-sopra", "margine-sotto", pagina.altezza - 40);
  return ridotto;
}

function aggiornaMisurePagina(evento) {
  const campo = evento.target;
  const valore = Number(campo.value);
  if (Number.isFinite(valore)) campo.value = String(Math.min(600, Math.max(100, Math.round(valore))));
  const larghezza = leggiMillimetri("larghezza-pagina", 210);
  const altezza = leggiMillimetri("altezza-pagina", 297);
  document.getElementById("formato-pagina").value = nomeDaMisure(larghezza, altezza);
  if (normalizzaMargini()) messaggio("Ho ridotto un margine, così resta spazio per scrivere.");
  else if (normalizzaDistanzaIntestazione()) messaggio("Ho avvicinato l’intestazione al bordo, così resta nel margine alto.");
  applicaFormatoVisivo();
  segnaModifica();
}

export function impostaMargine(id, millimetri) {
  const campo = document.getElementById(id);
  const valore = Number(millimetri);
  campo.value = String(Number.isFinite(valore) ? Math.min(80, Math.max(0, Math.round(valore))) : 0);
  const marginiRidotti = normalizzaMargini();
  const distanzaRidotta = normalizzaDistanzaIntestazione();
  applicaFormatoVisivo();
  return { valore: Number(campo.value), marginiRidotti, distanzaRidotta };
}

function aggiornaMargine(evento) {
  const esito = impostaMargine(evento.target.id, evento.target.value);
  if (esito.marginiRidotti) messaggio("Ho ridotto un margine, così resta spazio per scrivere.");
  else if (esito.distanzaRidotta) messaggio("Ho avvicinato l’intestazione al bordo, così resta nel margine alto.");
  segnaModifica();
}

function aggiornaDistanzaIntestazione(evento) {
  const campo = evento.target;
  const valore = Number(campo.value);
  campo.value = String(Number.isFinite(valore) ? Math.min(80, Math.max(0, Math.round(valore))) : 0);
  if (normalizzaDistanzaIntestazione()) messaggio("Ho avvicinato l’intestazione al bordo, così resta nel margine alto.");
  applicaFormatoVisivo();
  segnaModifica();
}

export function nomeFile() {
  const titolo = foglio.querySelector("h1")?.textContent?.trim() || "Relazione";
  const pulito = titolo.replace(/[\\/:*?"<>|]/g, "").slice(0, 40).trim();
  return pulito || "Relazione";
}

function htmlSenzaStacchi() {
  const copia = foglio.cloneNode(true);
  copia.querySelectorAll(".taglio-pagina").forEach((nodo) => nodo.remove());
  copia.querySelectorAll("td.selezionata, td.cella-ancora, td.angolo-selezione, td.anteprima-riempi, td.anteprima-sposta").forEach((td) => {
    td.classList.remove("selezionata", "cella-ancora", "angolo-selezione", "anteprima-riempi", "anteprima-sposta");
  });
  copia.querySelectorAll("[data-cursor-ref]").forEach((nodo) => nodo.removeAttribute("data-cursor-ref"));
  return copia.innerHTML;
}

function serializza() {
  document.querySelectorAll("#foglio select").forEach((select) => {
    [...select.options].forEach((opzione) => opzione.toggleAttribute("selected", opzione.value === select.value));
  });
  document.querySelectorAll("#foglio input").forEach((input) => {
    if (input.classList.contains("campo-id")) {
      input.setAttribute("value", input.closest(".blocco-tabella").dataset.id || input.value);
    } else {
      input.setAttribute("value", input.value);
    }
  });
  return {
    versione: 1,
    numeriPagina: opzioniPagina().numeri,
    posizioneNumero: opzioniPagina().posizione,
    formatoPagina: opzioniPagina().formato,
    larghezzaPagina: opzioniPagina().larghezza,
    altezzaPagina: opzioniPagina().altezza,
    margineSopra: opzioniPagina().margineSopra,
    margineSotto: opzioniPagina().margineSotto,
    margineSinistra: opzioniPagina().margineSinistra,
    margineDestra: opzioniPagina().margineDestra,
    distanzaIntestazione: opzioniPagina().distanzaIntestazione,
    intestazione: opzioniPagina().intestazione,
    pie: opzioniPagina().pie,
    stili: leggiStili(),
    html: htmlSenzaStacchi(),
  };
}

function salvaBozza() {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(serializza()));
    messaggio("Bozza salvata su questo computer.");
  } catch {
    messaggio("Bozza troppo grande per il salvataggio automatico. Usa il pulsante Salva.");
  }
}

async function nuova() {
  const si = await conferma("Vuoi iniziare una relazione nuova? La bozza su questo computer verrà sostituita.");
  if (!si) return;
  foglio.innerHTML = HTML_INIZIALE;
  document.getElementById("numeri-pagina").checked = true;
  document.getElementById("posizione-numero").value = "centro";
  aggiornaPosizioneNumero();
  document.getElementById("formato-pagina").value = "A4";
  document.getElementById("larghezza-pagina").value = "210";
  document.getElementById("altezza-pagina").value = "297";
  document.getElementById("margine-sopra").value = "18";
  document.getElementById("margine-sotto").value = "22";
  document.getElementById("margine-sinistra").value = "18";
  document.getElementById("margine-destra").value = "18";
  document.getElementById("distanza-intestazione").value = "2";
  impostaFasce("", "");
  impostaStili(null);
  applicaFormatoVisivo();
  ricalcolaTutte();
  salvaBozza();
  messaggio("Foglio vuoto.");
}

async function salva() {
  try {
    const byte = new TextEncoder().encode(JSON.stringify(serializza(), null, 2));
    const salvato = await salvaByte(`${nomeFile()}.lrd`, "lrd", "*.lrd", byte, "application/json");
    messaggio(salvato ? "Relazione salvata." : "Salvataggio annullato.");
  } catch (errore) {
    console.error(errore);
    await avvisa("Non sono riuscito a salvare il file.");
  }
}

async function apri() {
  try {
    const testo = await apriTesto("Relazione", ["lrd", "relazione"]);
    if (!testo) return;
    applica(JSON.parse(testo));
    salvaBozza();
    messaggio("Relazione aperta.");
  } catch {
    await avvisa("Questo file non è una relazione di Lord.");
  }
}

function applica(dati) {
  if (!dati || typeof dati.html !== "string") throw new Error("file");
  foglio.innerHTML = dati.html;
  document.getElementById("numeri-pagina").checked = dati.numeriPagina !== false;
  document.getElementById("posizione-numero").value = dati.posizioneNumero || "centro";
  aggiornaPosizioneNumero();
  const formato = FORMATI[dati.formatoPagina] || dati.formatoPagina === "personalizzato" ? dati.formatoPagina || "A4" : "A4";
  document.getElementById("formato-pagina").value = FORMATI[formato] || formato === "personalizzato" ? formato : "A4";
  document.getElementById("larghezza-pagina").value = String(dati.larghezzaPagina || FORMATI[formato]?.[0] || 210);
  document.getElementById("altezza-pagina").value = String(dati.altezzaPagina || FORMATI[formato]?.[1] || 297);
  document.getElementById("margine-sopra").value = String(dati.margineSopra ?? 18);
  document.getElementById("margine-sotto").value = String(dati.margineSotto ?? 22);
  document.getElementById("margine-sinistra").value = String(dati.margineSinistra ?? 18);
  document.getElementById("margine-destra").value = String(dati.margineDestra ?? 18);
  document.getElementById("distanza-intestazione").value = String(dati.distanzaIntestazione ?? 2);
  impostaFasce(dati.intestazione || "", dati.pie || "");
  impostaStili(dati.stili);
  normalizzaMargini();
  normalizzaDistanzaIntestazione();
  applicaFormatoVisivo();
  ricalcolaTutte();
  preparaImmagini();
}
