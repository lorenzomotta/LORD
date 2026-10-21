// Colore del testo ed evidenziatore, come in Word.
// Il pulsante grande mette subito l'ultimo colore usato; la freccina apre la tavolozza
// con i colori pronti, quelli usati di recente e "Altri colori…".

import { messaggio, segnaModifica } from "./modifiche.js";

const TEMA = ["#ffffff", "#000000", "#e7e6e6", "#44546a", "#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47"];
const STANDARD = ["#c00000", "#ff0000", "#ffc000", "#ffff00", "#92d050", "#00b050", "#00b0f0", "#0070c0", "#002060", "#7030a0"];
// Valori positivi schiariscono, negativi scuriscono.
const SFUMATURE = [0.8, 0.6, 0.4, -0.25, -0.5];
const CHIAVE = "relaziolore-colori";
const MAX_RECENTI = 10;
// Un colore che nessuno usa: serve a ritrovare i pezzi da cui togliere il colore.
const SEGNO_TOGLI = "#010203";

// I tipi con "cella" non toccano il testo selezionato: avvisano il menu della cella con l'evento "colore-cella".
const TIPI = {
  testo: { comando: "foreColor", proprieta: "color", iniziale: "#c00000", togli: "Automatico (colore dello stile)" },
  sfondo: { comando: "hiliteColor", proprieta: "backgroundColor", iniziale: "#ffff00", togli: "Nessun colore" },
  "cella-sfondo": { cella: "sfondo", iniziale: "#e2efda", togli: "Nessun colore" },
  "cella-testo": { cella: "colore", iniziale: "#c00000", togli: "Automatico (colore del foglio)" },
  "asse-testo": { cella: "colore", evento: "colore-asse", iniziale: "#c00000", togli: "Automatico (colore del foglio)" },
  "asse-sfondo": { cella: "sfondo", evento: "colore-asse", iniziale: "#e2efda", togli: "Nessun colore" },
};

let memoria = carica();
let tavolozza = null;
let aperta = null;
let zonaSalvata = null;

export function avviaTavolozzaColori() {
  tavolozza = document.getElementById("tavolozza-colori");
  riempiGriglia("tavolozza-tema", coloriTema());
  riempiGriglia("tavolozza-standard", STANDARD);
  aggiornaRecenti();

  // Le stesse coppie di pulsanti stanno nella barra e nel menu del tasto destro.
  document.querySelectorAll("[data-colore-metti], [data-colore-apri]").forEach((bottone) => {
    // Così il clic non toglie la selezione dal foglio.
    bottone.addEventListener("mousedown", (evento) => evento.preventDefault());
  });
  document.querySelectorAll("[data-colore-metti]").forEach((metti) => {
    const tipo = metti.dataset.coloreMetti;
    metti.addEventListener("click", () => {
      chiudi();
      applica(tipo, memoria[tipo], zonaCorrente());
    });
  });
  document.querySelectorAll("[data-colore-apri]").forEach((freccia) => {
    const tipo = freccia.dataset.coloreApri;
    const gruppo = freccia.closest(".scelta-colore");
    freccia.addEventListener("click", () => {
      if (aperta === tipo && gruppo.classList.contains("aperta")) chiudi();
      else apri(tipo, gruppo);
    });
  });
  Object.keys(TIPI).forEach(aggiornaBarra);

  tavolozza.addEventListener("mousedown", (evento) => {
    if (!evento.target.closest("input, label")) evento.preventDefault();
  });
  tavolozza.addEventListener("click", (evento) => {
    const cella = evento.target.closest("[data-colore]");
    if (cella) scegli(cella.dataset.colore);
  });
  document.getElementById("tavolozza-togli").addEventListener("click", () => scegli(null));
  document.getElementById("tavolozza-altro").addEventListener("change", (evento) => scegli(evento.target.value));

  document.addEventListener("mousedown", (evento) => {
    if (!aperta || tavolozza.contains(evento.target) || evento.target.closest(".scelta-colore")) return;
    chiudi();
  });
  document.addEventListener("keydown", (evento) => {
    if (aperta && evento.key === "Escape") chiudi();
  });
}

function apri(tipo, gruppo) {
  aperta = tipo;
  zonaSalvata = zonaCorrente();
  document.getElementById("tavolozza-togli").querySelector("span:last-child").textContent = TIPI[tipo].togli;
  document.getElementById("tavolozza-altro").value = memoria[tipo];
  document.querySelectorAll(".scelta-colore").forEach((elemento) => elemento.classList.toggle("aperta", elemento === gruppo));
  tavolozza.hidden = false;

  const posto = gruppo.getBoundingClientRect();
  const larghezza = tavolozza.offsetWidth;
  const altezza = tavolozza.offsetHeight;
  // Sotto il pulsante; se non c'è posto, sopra.
  let alto = posto.bottom + 4;
  if (alto + altezza > window.innerHeight - 8) alto = Math.max(8, posto.top - altezza - 4);
  tavolozza.style.left = `${Math.max(8, Math.min(posto.left, window.innerWidth - larghezza - 8))}px`;
  tavolozza.style.top = `${alto}px`;
}

function chiudi() {
  aperta = null;
  tavolozza.hidden = true;
  document.querySelectorAll(".scelta-colore.aperta").forEach((elemento) => elemento.classList.remove("aperta"));
}

function scegli(colore) {
  const tipo = aperta;
  const zona = zonaSalvata;
  chiudi();
  if (tipo) applica(tipo, colore, zona);
}

// La parte del foglio (o intestazione e piè di pagina) con la selezione, e la selezione stessa.
function zonaCorrente() {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return null;
  const nodo = selezione.anchorNode;
  let zona = nodo?.nodeType === 1 ? nodo : nodo?.parentElement;
  if (!zona?.isContentEditable) return null;
  while (zona.parentElement?.isContentEditable) zona = zona.parentElement;
  return { zona, range: selezione.getRangeAt(0).cloneRange() };
}

function applica(tipo, colore, dove) {
  if (TIPI[tipo].cella) {
    if (colore) ricordaColore(tipo, colore);
    document.dispatchEvent(new CustomEvent(TIPI[tipo].evento || "colore-cella", { detail: { campo: TIPI[tipo].cella, colore: colore || "" } }));
    salva();
    return;
  }
  if (!dove) {
    messaggio("Metti prima il cursore nel testo, oppure selezionalo.");
    return;
  }
  dove.zona.focus();
  const selezione = window.getSelection();
  selezione.removeAllRanges();
  selezione.addRange(dove.range);

  const { comando, proprieta } = TIPI[tipo];
  if (colore) {
    document.execCommand(comando, false, colore);
    ricordaColore(tipo, colore);
  } else {
    if (selezione.isCollapsed) {
      messaggio("Seleziona il testo da cui togliere il colore.");
      return;
    }
    togliColore(dove.zona, comando, proprieta);
  }
  salva();
  segnaModifica();
}

// Il browser sa solo mettere un colore: ne metto uno "segnaposto" e poi lo cancello,
// così il testo torna al colore del suo stile (o senza evidenziatore).
function togliColore(zona, comando, proprieta) {
  document.execCommand(comando, false, SEGNO_TOGLI);
  const segno = coloreRgb(SEGNO_TOGLI);
  zona.querySelectorAll("[style]").forEach((elemento) => {
    if (elemento.style[proprieta] !== segno) return;
    elemento.style[proprieta] = "";
    if (!elemento.getAttribute("style")) elemento.removeAttribute("style");
  });
}

function ricordaColore(tipo, colore) {
  memoria[tipo] = colore;
  ricordaRecente(colore);
  aggiornaBarra(tipo);
}

function aggiornaBarra(tipo) {
  document.querySelectorAll(`[data-colore-barra="${tipo}"]`).forEach((barra) => {
    barra.style.background = memoria[tipo];
  });
}

function riempiGriglia(id, colori) {
  const griglia = document.getElementById(id);
  griglia.replaceChildren(
    ...colori.map((colore) => {
      const cella = document.createElement("button");
      cella.type = "button";
      cella.dataset.colore = colore;
      cella.style.background = colore;
      cella.title = colore.toUpperCase();
      cella.setAttribute("aria-label", colore);
      return cella;
    }),
  );
}

function aggiornaRecenti() {
  const recenti = memoria.recenti;
  document.getElementById("tavolozza-titolo-recenti").hidden = !recenti.length;
  document.getElementById("tavolozza-recenti").hidden = !recenti.length;
  riempiGriglia("tavolozza-recenti", recenti);
}

function ricordaRecente(colore) {
  memoria.recenti = [colore, ...memoria.recenti.filter((altro) => altro !== colore)].slice(0, MAX_RECENTI);
  aggiornaRecenti();
}

// Prima riga i colori base, sotto le loro sfumature: la griglia si legge per colonne.
function coloriTema() {
  const righe = [TEMA];
  SFUMATURE.forEach((quanto, indice) => {
    righe.push(
      TEMA.map((base) => {
        // Il bianco si può solo scurire e il nero solo schiarire.
        if (base === "#ffffff") return sfumatura(base, -[0.05, 0.15, 0.25, 0.35, 0.5][indice]);
        if (base === "#000000") return sfumatura(base, [0.5, 0.35, 0.25, 0.15, 0.05][indice]);
        return sfumatura(base, quanto);
      }),
    );
  });
  return righe.flat();
}

function sfumatura(hex, quanto) {
  const canali = [1, 3, 5].map((inizio) => parseInt(hex.slice(inizio, inizio + 2), 16));
  const nuovi = canali.map((canale) => Math.round(quanto > 0 ? canale + (255 - canale) * quanto : canale * (1 + quanto)));
  return `#${nuovi.map((canale) => canale.toString(16).padStart(2, "0")).join("")}`;
}

function coloreRgb(hex) {
  const [r, g, b] = [1, 3, 5].map((inizio) => parseInt(hex.slice(inizio, inizio + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

function carica() {
  const iniziale = { recenti: [] };
  Object.entries(TIPI).forEach(([tipo, dati]) => {
    iniziale[tipo] = dati.iniziale;
  });
  try {
    const letto = JSON.parse(localStorage.getItem(CHIAVE) || "null");
    if (!letto) return iniziale;
    const memoria = { recenti: Array.isArray(letto.recenti) ? letto.recenti.slice(0, MAX_RECENTI) : [] };
    Object.keys(TIPI).forEach((tipo) => {
      memoria[tipo] = letto[tipo] || iniziale[tipo];
    });
    return memoria;
  } catch {
    return iniziale;
  }
}

function salva() {
  localStorage.setItem(CHIAVE, JSON.stringify(memoria));
}
