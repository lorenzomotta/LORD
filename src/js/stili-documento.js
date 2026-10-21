// Stili del documento: Paragrafo, Titolo, Titolo 2, Titolo 3 e gli stili creati da te.
// Si cambiano dalla finestra "Stili…", si salvano dentro la relazione e diventano stili veri in Word.

import { foglio } from "./editor.js";
import { chiedi, conferma } from "./finestre.js";
import { paragrafiSelezionati } from "./interlinea.js";
import { segnaModifica } from "./modifiche.js";

const BASE = {
  p: { font: "Calibri", dimensione: 12, grassetto: false, corsivo: false, colore: "#1c1915", allinea: "left", interlinea: 1.15, sopra: 0, sotto: 8 },
  h1: { font: "Calibri", dimensione: 22, grassetto: true, corsivo: false, colore: "#1c1915", allinea: "left", interlinea: 1.15, sopra: 0, sotto: 12 },
  h2: { font: "Calibri", dimensione: 16, grassetto: true, corsivo: false, colore: "#1c1915", allinea: "left", interlinea: 1.15, sopra: 12, sotto: 8 },
  h3: { font: "Calibri", dimensione: 14, grassetto: true, corsivo: false, colore: "#1c1915", allinea: "left", interlinea: 1.15, sopra: 10, sotto: 6 },
};
const NOMI = Object.keys(BASE);
const ETICHETTE = { p: "Paragrafo", h1: "Titolo", h2: "Titolo 2", h3: "Titolo 3" };
const ALLINEAMENTI = ["left", "center", "right", "justify"];
// Gli stili personali nelle tendine hanno il valore "stile:<id>", per non confondersi con P, H1…
const PREFISSO = "stile:";
const TENDINE = ["stile-paragrafo", "menu-testo-stile"];

let stili = copiaBase();

export function avviaStiliDocumento() {
  const finestra = document.getElementById("finestra-stili");
  document.getElementById("btn-stili").addEventListener("click", () => {
    finestra.hidden = !finestra.hidden;
    if (!finestra.hidden) mostraNellaFinestra();
  });
  document.getElementById("stili-chiudi").addEventListener("click", () => {
    finestra.hidden = true;
  });
  document.getElementById("stili-quale").addEventListener("change", mostraNellaFinestra);
  document.getElementById("stili-ripristina").addEventListener("click", ripristinaScelto);
  document.getElementById("stili-nuovo").addEventListener("click", nuovoStile);
  document.getElementById("stili-rinomina").addEventListener("click", rinominaStile);
  document.getElementById("stili-elimina").addEventListener("click", eliminaStile);
  finestra.querySelectorAll("input, select:not(#stili-quale)").forEach((campo) => {
    campo.addEventListener(campo.type === "number" ? "input" : "change", leggiDallaFinestra);
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !finestra.hidden) finestra.hidden = true;
  });
  document.addEventListener("selectionchange", () => {
    const valore = stileCorrente();
    if (valore) document.getElementById("stile-paragrafo").value = valore;
  });
  applicaStili();
}

// Per il salvataggio: una copia degli stili attuali.
export function leggiStili() {
  return JSON.parse(JSON.stringify(stili));
}

// All'apertura di una relazione (o con "Nuova", passando null): stili salvati oppure quelli di partenza.
export function impostaStili(salvati) {
  stili = copiaBase();
  if (salvati && typeof salvati === "object") {
    NOMI.forEach((nome) => {
      stili[nome] = pulisci({ ...BASE[nome], ...(salvati[nome] || {}) }, BASE[nome]);
    });
    if (Array.isArray(salvati.personali)) {
      stili.personali = salvati.personali
        .filter((stile) => /^s\d+$/.test(stile?.id) && typeof stile.nome === "string" && stile.nome.trim())
        .map((stile) => ({ id: stile.id, nome: stile.nome.trim(), ...pulisci(stile, BASE.p) }));
    }
  }
  applicaStili();
  if (!document.getElementById("finestra-stili").hidden) mostraNellaFinestra();
}

// Dalla tendina "Paragrafo / Titolo / …" della barra e del menu del tasto destro.
export function applicaStileParagrafo(valore) {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount || !foglio.contains(selezione.anchorNode)) {
    if (!valore.startsWith(PREFISSO)) document.execCommand("formatBlock", false, valore);
    return;
  }
  if (!valore.startsWith(PREFISSO)) {
    document.execCommand("formatBlock", false, valore);
    paragrafiSelezionati(window.getSelection().getRangeAt(0)).forEach((blocco) => blocco.removeAttribute("data-stile"));
    return;
  }
  const id = valore.slice(PREFISSO.length);
  // Uno stile personale si appoggia sempre a un paragrafo normale.
  const titoli = paragrafiSelezionati(selezione.getRangeAt(0)).some((blocco) => /^H[1-6]$/.test(blocco.tagName));
  if (titoli) document.execCommand("formatBlock", false, "P");
  paragrafiSelezionati(window.getSelection().getRangeAt(0)).forEach((blocco) => {
    if (blocco.tagName === "P" || blocco.tagName === "DIV") blocco.dataset.stile = id;
  });
}

// Il valore da mostrare nella tendina per il paragrafo dove si trova il cursore.
export function stileCorrente() {
  const nodo = window.getSelection()?.anchorNode;
  const elemento = nodo?.nodeType === 1 ? nodo : nodo?.parentElement;
  if (!elemento || !foglio.contains(elemento) || elemento.closest("td, input, textarea, select")) return null;
  const blocco = elemento.closest("h1, h2, h3, p, div, li");
  if (!blocco || blocco === foglio) return "P";
  if (/^H[1-3]$/.test(blocco.tagName)) return blocco.tagName;
  const id = blocco.dataset.stile;
  if (id && stili.personali.some((stile) => stile.id === id)) return `${PREFISSO}${id}`;
  return "P";
}

// Per Word: gli stili come li vuole la libreria docx.
export function stiliPerWord(docx) {
  const allinea = {
    left: docx.AlignmentType.LEFT,
    center: docx.AlignmentType.CENTER,
    right: docx.AlignmentType.RIGHT,
    justify: docx.AlignmentType.JUSTIFIED,
  };
  const converti = (stile) => ({
    run: {
      font: stile.font,
      size: Math.round(stile.dimensione * 2),
      bold: stile.grassetto,
      italics: stile.corsivo,
      color: stile.colore.replace("#", "").toUpperCase(),
    },
    paragraph: {
      alignment: allinea[stile.allinea],
      spacing: { before: Math.round(stile.sopra * 20), after: Math.round(stile.sotto * 20), line: Math.round(stile.interlinea * 240) },
    },
  });
  return {
    default: {
      document: converti(stili.p),
      heading1: converti(stili.h1),
      heading2: converti(stili.h2),
      heading3: converti(stili.h3),
    },
    paragraphStyles: stili.personali.map((stile) => ({
      id: idWord(stile.id),
      name: stile.nome,
      basedOn: "Normal",
      next: idWord(stile.id),
      quickFormat: true,
      ...converti(stile),
    })),
  };
}

// Per Word: il nome interno dello stile personale di un paragrafo, se ne ha uno.
export function stileWordDi(elemento) {
  const id = elemento.dataset?.stile;
  return id && stili.personali.some((stile) => stile.id === id) ? idWord(id) : null;
}

function idWord(id) {
  return `Relaziolore${id}`;
}

function copiaBase() {
  return { ...JSON.parse(JSON.stringify(BASE)), personali: [] };
}

// Scarta valori strani (per esempio da un file modificato a mano).
function pulisci(stile, base) {
  const numero = (valore, min, max, riserva) => {
    const n = Number(valore);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : riserva;
  };
  return {
    font: typeof stile.font === "string" && stile.font.trim() ? stile.font.trim() : base.font,
    dimensione: numero(stile.dimensione, 6, 72, base.dimensione),
    grassetto: Boolean(stile.grassetto),
    corsivo: Boolean(stile.corsivo),
    colore: /^#[0-9a-f]{6}$/i.test(stile.colore) ? stile.colore : base.colore,
    allinea: ALLINEAMENTI.includes(stile.allinea) ? stile.allinea : base.allinea,
    interlinea: numero(stile.interlinea, 0.8, 3, base.interlinea),
    sopra: numero(stile.sopra, 0, 72, base.sopra),
    sotto: numero(stile.sotto, 0, 72, base.sotto),
  };
}

function trova(chiave) {
  return NOMI.includes(chiave) ? stili[chiave] : stili.personali.find((stile) => stile.id === chiave);
}

function applicaStili() {
  const radice = document.documentElement.style;
  NOMI.forEach((nome) => {
    const stile = stili[nome];
    radice.setProperty(`--stile-${nome}-font`, `"${stile.font.replace(/"/g, "")}"`);
    radice.setProperty(`--stile-${nome}-dimensione`, `${stile.dimensione}pt`);
    radice.setProperty(`--stile-${nome}-peso`, stile.grassetto ? "700" : "400");
    radice.setProperty(`--stile-${nome}-forma`, stile.corsivo ? "italic" : "normal");
    radice.setProperty(`--stile-${nome}-colore`, stile.colore);
    radice.setProperty(`--stile-${nome}-allinea`, stile.allinea);
    radice.setProperty(`--stile-${nome}-interlinea`, String(stile.interlinea));
    radice.setProperty(`--stile-${nome}-sopra`, `${stile.sopra}pt`);
    radice.setProperty(`--stile-${nome}-sotto`, `${stile.sotto}pt`);
  });
  scriviRegolePersonali();
  aggiornaTendine();
  document.dispatchEvent(new CustomEvent("formato-pagina"));
}

// Gli stili personali non hanno una regola fissa nel CSS: il programma la scrive qui.
function scriviRegolePersonali() {
  let foglioStile = document.getElementById("stili-personali");
  if (!foglioStile) {
    foglioStile = document.createElement("style");
    foglioStile.id = "stili-personali";
    document.head.append(foglioStile);
  }
  foglioStile.textContent = stili.personali
    .map((stile) => {
      const sel = `[data-stile="${stile.id}"]`;
      // I :not() servono a vincere sulle regole del Paragrafo in stili-documento.css.
      const selettori = [
        `.foglio > ${sel}:not(.interruzione):not(.taglio-pagina)`,
        `.corpo-pagina > ${sel}:not(.interruzione-stampa):not(.taglio-pagina)`,
        `.misuratore > ${sel}:not(.interruzione-stampa):not(.taglio-pagina)`,
        `.vista-documento > ${sel}:not(.interruzione-stampa):not(.taglio-pagina)`,
      ].join(",\n");
      return `${selettori} {
  font-family: "${stile.font.replace(/"/g, "")}", Carlito, "Segoe UI", sans-serif;
  font-size: ${stile.dimensione}pt;
  font-weight: ${stile.grassetto ? 700 : 400};
  font-style: ${stile.corsivo ? "italic" : "normal"};
  color: ${stile.colore};
  text-align: ${stile.allinea};
  line-height: ${stile.interlinea};
  margin-top: ${stile.sopra}pt;
  margin-bottom: ${stile.sotto}pt;
}`;
    })
    .join("\n\n");
}

// Le tendine "Paragrafo / Titolo / …" mostrano anche gli stili personali, in fondo.
function aggiornaTendine() {
  const elenchi = [...TENDINE, "stili-quale"].map((id) => document.getElementById(id)).filter(Boolean);
  elenchi.forEach((tendina) => {
    const scelto = tendina.value;
    [...tendina.options].filter((opzione) => opzione.dataset.personale).forEach((opzione) => opzione.remove());
    stili.personali.forEach((stile) => {
      const valore = tendina.id === "stili-quale" ? stile.id : `${PREFISSO}${stile.id}`;
      const opzione = new Option(stile.nome, valore);
      opzione.dataset.personale = "1";
      tendina.add(opzione);
    });
    tendina.value = [...tendina.options].some((opzione) => opzione.value === scelto) ? scelto : tendina.options[0].value;
  });
}

function mostraNellaFinestra() {
  const quale = document.getElementById("stili-quale").value;
  const stile = trova(quale);
  if (!stile) return;
  const fontScelto = document.getElementById("stili-font");
  if (![...fontScelto.options].some((opzione) => opzione.value === stile.font)) fontScelto.add(new Option(stile.font, stile.font));
  fontScelto.value = stile.font;
  document.getElementById("stili-dimensione").value = String(stile.dimensione);
  document.getElementById("stili-grassetto").checked = stile.grassetto;
  document.getElementById("stili-corsivo").checked = stile.corsivo;
  document.getElementById("stili-colore").value = stile.colore;
  document.getElementById("stili-allinea").value = stile.allinea;
  document.getElementById("stili-interlinea").value = String(stile.interlinea);
  document.getElementById("stili-sopra").value = String(stile.sopra);
  document.getElementById("stili-sotto").value = String(stile.sotto);
  const personale = !NOMI.includes(quale);
  document.getElementById("stili-rinomina").hidden = !personale;
  document.getElementById("stili-elimina").hidden = !personale;
  aggiornaEsempio(stile);
}

function leggiDallaFinestra() {
  const quale = document.getElementById("stili-quale").value;
  const attuale = trova(quale);
  if (!attuale) return;
  const nuovo = pulisci(
    {
      font: document.getElementById("stili-font").value,
      dimensione: document.getElementById("stili-dimensione").value,
      grassetto: document.getElementById("stili-grassetto").checked,
      corsivo: document.getElementById("stili-corsivo").checked,
      colore: document.getElementById("stili-colore").value,
      allinea: document.getElementById("stili-allinea").value,
      interlinea: document.getElementById("stili-interlinea").value,
      sopra: document.getElementById("stili-sopra").value,
      sotto: document.getElementById("stili-sotto").value,
    },
    attuale,
  );
  Object.assign(attuale, nuovo);
  applicaStili();
  aggiornaEsempio(attuale);
  segnaModifica();
}

// Per gli stili di partenza torna ai valori iniziali; per quelli personali copia il Paragrafo.
function ripristinaScelto() {
  const quale = document.getElementById("stili-quale").value;
  const attuale = trova(quale);
  if (!attuale) return;
  Object.assign(attuale, NOMI.includes(quale) ? BASE[quale] : stili.p);
  applicaStili();
  mostraNellaFinestra();
  segnaModifica();
}

async function nuovoStile() {
  const nome = await chiedereNome("Nuovo stile", "Come vuoi chiamarlo? Per esempio: Citazione, Nota, Didascalia.", "");
  if (!nome) return;
  const numeri = stili.personali.map((stile) => Number(stile.id.slice(1)));
  const id = `s${Math.max(0, ...numeri) + 1}`;
  stili.personali.push({ id, nome, ...stili.p });
  applicaStili();
  document.getElementById("stili-quale").value = id;
  mostraNellaFinestra();
  segnaModifica();
}

async function rinominaStile() {
  const stile = trova(document.getElementById("stili-quale").value);
  if (!stile || NOMI.includes(stile.id)) return;
  const nome = await chiedereNome("Rinomina stile", "Nuovo nome dello stile:", stile.nome, stile.id);
  if (!nome) return;
  stile.nome = nome;
  applicaStili();
  segnaModifica();
}

async function eliminaStile() {
  const stile = trova(document.getElementById("stili-quale").value);
  if (!stile || NOMI.includes(stile.id)) return;
  const usati = foglio.querySelectorAll(`[data-stile="${stile.id}"]`);
  const avviso = usati.length ? ` ${usati.length === 1 ? "Un paragrafo lo usa e tornerà" : `${usati.length} paragrafi lo usano e torneranno`} normale.` : "";
  if (!(await conferma(`Eliminare lo stile "${stile.nome}"?${avviso}`))) return;
  usati.forEach((blocco) => blocco.removeAttribute("data-stile"));
  stili.personali = stili.personali.filter((altro) => altro !== stile);
  document.getElementById("stili-quale").value = "p";
  applicaStili();
  mostraNellaFinestra();
  segnaModifica();
}

async function chiedereNome(titolo, testo, valore, ignora = null) {
  const dati = await chiedi({
    titolo,
    testo,
    campi: [{ nome: "nome", etichetta: "Nome", valore }],
    conferma: "Ok",
    controlla: ({ nome }) => {
      const pulito = nome.trim();
      if (!pulito) return "Scrivi un nome.";
      if (pulito.length > 40) return "Il nome è troppo lungo (massimo 40 lettere).";
      const giaUsato = Object.values(ETICHETTE).some((etichetta) => etichetta.toLowerCase() === pulito.toLowerCase())
        || stili.personali.some((stile) => stile.id !== ignora && stile.nome.toLowerCase() === pulito.toLowerCase());
      return giaUsato ? "Esiste già uno stile con questo nome." : "";
    },
  });
  return dati ? dati.nome.trim() : null;
}

function aggiornaEsempio(stile) {
  const esempio = document.getElementById("stili-esempio");
  esempio.style.fontFamily = `"${stile.font}", Carlito, "Segoe UI", sans-serif`;
  esempio.style.fontSize = `${stile.dimensione}pt`;
  esempio.style.fontWeight = stile.grassetto ? "700" : "400";
  esempio.style.fontStyle = stile.corsivo ? "italic" : "normal";
  esempio.style.color = stile.colore;
  esempio.style.textAlign = stile.allinea;
  esempio.style.lineHeight = String(stile.interlinea);
}
