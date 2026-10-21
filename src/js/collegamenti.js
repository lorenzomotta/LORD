// Collegamenti (hyperlink) nel testo, come in Word: pulsante o Ctrl+K per inserirli o cambiarli,
// Ctrl+clic per aprirli nel browser. Nell'anteprima basta un clic.

import { avvisa, chiedi } from "./finestre.js";
import { messaggio, segnaModifica } from "./modifiche.js";

const ZONE = "#foglio, #intestazione-foglio, #pie-foglio";
const ESCLUSI = "td[data-cella], .blocco-immagine, .blocco-tabella, input, textarea, select";
const BLOCCHI = "p, h1, h2, h3, h4, li, div";

export function avviaCollegamenti() {
  document.querySelectorAll("[data-collegamento]").forEach((bottone) => {
    bottone.addEventListener("mousedown", (evento) => evento.preventDefault());
    bottone.addEventListener("click", () => {
      document.getElementById("menu-testo").hidden = true;
      modificaCollegamento();
    });
  });

  document.addEventListener("keydown", (evento) => {
    if (!(evento.ctrlKey || evento.metaKey) || evento.altKey || evento.key.toLowerCase() !== "k") return;
    if (!zonaCorrente()) return;
    evento.preventDefault();
    modificaCollegamento();
  });

  // Il clic su un collegamento non deve far cambiare pagina all'app.
  document.addEventListener("click", (evento) => {
    const link = evento.target.closest?.("a[href]");
    if (!link) return;
    const nelFoglio = link.closest(ZONE);
    const inAnteprima = link.closest("#anteprima");
    if (!nelFoglio && !inAnteprima) return;
    evento.preventDefault();
    if (inAnteprima || evento.ctrlKey || evento.metaKey) apri(link.getAttribute("href"));
  });

  // Con Ctrl premuto, sui collegamenti compare la manina.
  const segnaCtrl = (evento) => document.body.classList.toggle("tasto-ctrl", evento.ctrlKey);
  document.addEventListener("keydown", segnaCtrl);
  document.addEventListener("keyup", segnaCtrl);
  window.addEventListener("blur", () => document.body.classList.remove("tasto-ctrl"));
}

async function modificaCollegamento() {
  const dove = zonaCorrente();
  if (!dove) {
    messaggio("Metti prima il cursore nel testo, oppure seleziona le parole da collegare.");
    return;
  }
  const { range } = dove;
  const esistente = elementoDi(range.startContainer)?.closest("a[href]") || elementoDi(range.commonAncestorContainer)?.closest("a[href]");
  if (!esistente && bloccoDi(range.startContainer) !== bloccoDi(range.endContainer)) {
    await avvisa("Il collegamento si mette su parole di un solo paragrafo. Seleziona meno testo.");
    ripristina(dove);
    return;
  }

  const testoIniziale = esistente ? esistente.textContent : range.toString();
  const risposta = await chiedi({
    titolo: esistente ? "Modifica collegamento" : "Inserisci collegamento",
    testo: esistente
      ? "Per togliere il collegamento cancella l'indirizzo e premi Ok: il testo resta."
      : "Scrivi l'indirizzo di un sito (per esempio www.comune.it) oppure un indirizzo e-mail.",
    campi: [
      { nome: "testo", etichetta: "Testo da mostrare", valore: testoIniziale },
      { nome: "indirizzo", etichetta: "Indirizzo", valore: esistente ? esistente.getAttribute("href") : "" },
    ],
    controlla: (dati) => {
      if (!esistente && !dati.indirizzo.trim()) return "Scrivi l'indirizzo.";
      if (dati.indirizzo.trim() && normalizza(dati.indirizzo) === null) return "Questo indirizzo non sembra valido. Esempio: www.sito.it oppure nome@posta.it";
      return null;
    },
  });
  ripristina(dove);
  if (!risposta) return;

  const indirizzo = normalizza(risposta.indirizzo);
  const testo = risposta.testo.trim() ? risposta.testo : "";

  if (esistente) {
    if (!indirizzo) esistente.replaceWith(...esistente.childNodes);
    else {
      imposta(esistente, indirizzo);
      if (testo && testo !== esistente.textContent) esistente.textContent = testo;
    }
    segnaModifica();
    return;
  }

  const link = document.createElement("a");
  imposta(link, indirizzo);
  // Se il testo non cambia, si tengono le parole selezionate con la loro formattazione.
  if (!range.collapsed && (!testo || testo === testoIniziale)) link.append(range.extractContents());
  else {
    range.deleteContents();
    link.textContent = testo || indirizzo.replace(/^mailto:/i, "");
  }
  range.insertNode(link);
  cursoreDopo(link);
  segnaModifica();
}

// Trasforma quello che scrive l'utente in un indirizzo completo. null vuol dire "non valido".
function normalizza(testo) {
  const pulito = testo.trim();
  if (!pulito) return "";
  if (/\s/.test(pulito)) return null;
  if (/^(https?:\/\/|mailto:)/i.test(pulito)) return pulito;
  if (/^[^@]+@[^@]+\.[^@]+$/.test(pulito)) return `mailto:${pulito}`;
  if (/^[^@/]+\.[^@]+$/.test(pulito)) return `https://${pulito}`;
  return null;
}

function imposta(link, indirizzo) {
  link.setAttribute("href", indirizzo);
  link.title = `${indirizzo.replace(/^mailto:/i, "")}\nCtrl+clic per aprire`;
}

async function apri(indirizzo) {
  if (!/^(https?:\/\/|mailto:)/i.test(indirizzo || "")) return;
  try {
    if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("apri_collegamento", { indirizzo });
    } else {
      window.open(indirizzo, "_blank", "noopener");
    }
  } catch (errore) {
    console.error(errore);
    await avvisa("Non sono riuscito ad aprire il collegamento.");
  }
}

function zonaCorrente() {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return null;
  const elemento = elementoDi(selezione.anchorNode);
  const zona = elemento?.closest(ZONE);
  if (!zona || elemento.closest(ESCLUSI)) return null;
  return { zona, range: selezione.getRangeAt(0).cloneRange() };
}

function ripristina({ zona, range }) {
  zona.focus();
  const selezione = window.getSelection();
  selezione.removeAllRanges();
  selezione.addRange(range);
}

// Dopo il collegamento serve un punto dove scrivere che non sia dentro il collegamento.
function cursoreDopo(link) {
  let dopo = link.nextSibling;
  if (!dopo || dopo.nodeType !== Node.TEXT_NODE || !dopo.textContent) {
    dopo = document.createTextNode("\u200B");
    link.after(dopo);
  }
  const range = document.createRange();
  range.setStart(dopo, dopo.textContent.startsWith("\u200B") ? 1 : 0);
  range.collapse(true);
  const selezione = window.getSelection();
  selezione.removeAllRanges();
  selezione.addRange(range);
}

function elementoDi(nodo) {
  return nodo?.nodeType === Node.ELEMENT_NODE ? nodo : nodo?.parentElement;
}

function bloccoDi(nodo) {
  const elemento = elementoDi(nodo);
  return elemento?.closest(BLOCCHI) || elemento?.closest(ZONE);
}
