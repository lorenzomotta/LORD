// Collega una cella dentro il testo, per esempio =Tabella1.C2

import { foglio, ripristinaCursore } from "./editor.js";
import { analizzaIndirizzo } from "./formule.js";
import { avvisa, chiedi } from "./finestre.js";
import { segnaModifica } from "./modifiche.js";

let stoConvertendo = false;

export function avviaRiferimenti() {

  foglio.addEventListener("input", (evento) => {
    if (evento.target.matches("input, textarea")) return;
    provaCollegamento(false);
  });
  foglio.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && !evento.target.matches("input, textarea")) provaCollegamento(true);
  });
}

export function aggiornaRiferimenti() {
  document.querySelectorAll(".riferimento").forEach((span) => {
    const id = span.dataset.tabella;
    const cella = span.dataset.cella;
    const tabella = document.querySelector(`.blocco-tabella[data-id="${CSS.escape(id)}"]`);
    const td = tabella?.querySelector(`td[data-cella="${CSS.escape(cella)}"]`);
    if (!td) {
      span.textContent = "#RIF!";
      span.classList.add("riferimento-errore");
      span.title = "Cella non trovata";
      return;
    }
    span.textContent = td.textContent || "";
    span.classList.remove("riferimento-errore");
    span.title = `${id}.${cella}`;
  });
}

function provaCollegamento(accettaSenzaSpazio) {
  if (stoConvertendo) return;
  const selezione = window.getSelection();
  if (!selezione || !selezione.isCollapsed || !selezione.rangeCount) return;
  const nodo = selezione.anchorNode;
  if (!nodo || nodo.nodeType !== Node.TEXT_NODE) return;
  if (nodo.parentElement?.closest(".blocco-tabella, .blocco-immagine, .blocco-forma, .riferimento")) return;

  const fino = nodo.textContent.slice(0, selezione.anchorOffset);
  const modello = accettaSenzaSpazio
    ? /=([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z]+)(\d+)$/
    : /=([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z]+)(\d+)([ \u00A0,;:!?)]+)$/;
  const trovato = fino.match(modello);
  if (!trovato) return;

  const inizio = fino.lastIndexOf(trovato[0]);
  if (inizio > 0 && /[A-Za-z0-9_]/.test(fino[inizio - 1])) return;

  const scritto = trovato[1];
  const tabelle = [...document.querySelectorAll(".blocco-tabella")];
  const tabella = tabelle.find((tab) => tab.dataset.id.toLowerCase() === scritto.toLowerCase());
  const id = tabella?.dataset.id || scritto;
  const cella = (trovato[2] + trovato[3]).toUpperCase();
  const delimitatore = trovato[4] || "";

  const range = document.createRange();
  range.setStart(nodo, inizio);
  range.setEnd(nodo, selezione.anchorOffset);
  selezione.removeAllRanges();
  selezione.addRange(range);

  stoConvertendo = true;
  mettiRiferimento(id, cella, delimitatore);
  stoConvertendo = false;
  aggiornaRiferimenti();
  segnaModifica();
}

function mettiRiferimento(id, cella, delimitatore) {
  const selezione = window.getSelection();
  if (!selezione || !selezione.rangeCount) return;
  const range = selezione.getRangeAt(0);
  const span = document.createElement("span");
  span.className = "riferimento";
  span.contentEditable = "false";
  span.dataset.tabella = id;
  span.dataset.cella = cella;
  span.textContent = "…";
  range.deleteContents();
  range.insertNode(span);
  const dopo = document.createTextNode(delimitatore);
  span.after(dopo);
  const cursore = document.createRange();
  cursore.setStart(dopo, dopo.textContent.length);
  cursore.collapse(true);
  selezione.removeAllRanges();
  selezione.addRange(cursore);
}

export function collegaCellaAlCursore(cursore, id, cella) {
  ripristinaCursore(cursore);
  mettiRiferimento(id, cella, " ");
  aggiornaRiferimenti();
  segnaModifica();
}

export async function inserisciDaFinestra(cursore) {
  const tabelle = [...document.querySelectorAll(".blocco-tabella")];
  if (!tabelle.length) {
    await avvisa("Prima inserisci una tabella.");
    return;
  }
  const dati = await chiedi({
    titolo: "Collega una cella",
    testo: "Il valore della cella comparirà nel testo e si aggiornerà da solo.",
    conferma: "Inserisci",
    campi: [
      {
        nome: "tabella",
        etichetta: "Tabella",
        tipo: "select",
        opzioni: tabelle.map((tab) => ({ valore: tab.dataset.id, testo: tab.dataset.id })),
      },
      { nome: "cella", etichetta: "Cella (esempio C2)", valore: "A1" },
    ],
    controlla(datiScritti) {
      const indirizzo = analizzaIndirizzo(datiScritti.cella);
      if (!indirizzo) return "Scrivi la cella come in Excel, per esempio C2.";
      const tabella = document.querySelector(`.blocco-tabella[data-id="${CSS.escape(datiScritti.tabella)}"]`);
      if (!tabella?.querySelector(`td[data-cella="${indirizzo.etichetta}"]`)) return "Quella cella non esiste nella tabella.";
      return "";
    },
  });
  if (!dati) return;
  const indirizzo = analizzaIndirizzo(dati.cella);
  collegaCellaAlCursore(cursore, dati.tabella, indirizzo.etichetta);
}
