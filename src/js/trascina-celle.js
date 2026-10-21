// Trascina le celle come in Excel:
// - il quadratino in basso a destra della selezione riempie le celle vicine;
// - il bordo della selezione sposta il contenuto in un altro punto della tabella.

import { foglio } from "./editor.js";
import { avvisa } from "./finestre.js";
import { analizzaIndirizzo, lettereDaColonna, parseNumero } from "./formule.js";
import { segnaModifica } from "./modifiche.js";
import { ricalcolaTutte } from "./tabelle.js";

const CHIAVI_FORMATO = ["tipo", "decimali", "bordo", "sfondo", "colore", "font", "dimensione", "interlinea", "allinea", "grassetto", "corsivo", "sottolineato", "barrato"];
const RIFERIMENTO = /(^|[^A-Za-z0-9_])(?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z]{1,3})(\d+)/g;
const RIFERIMENTO_O_INTERVALLO = /(^|[^A-Za-z0-9_])(?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z]{1,3}\d+)(?::(?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z]{1,3}\d+))?/g;
const MARGINE_BORDO = 5;
const MISURA_QUADRATINO = 9;

let trascina = null;

export function avviaTrascinaCelle() {
  new MutationObserver(segnaAngolo).observe(foglio, { subtree: true, attributes: true, attributeFilter: ["class"] });
  document.addEventListener("mousedown", iniziaTrascina, true);
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
  document.addEventListener("keydown", (evento) => {
    if (trascina && evento.key === "Escape") annulla();
  });
}

function segnaAngolo() {
  const figura = foglio.querySelector(".blocco-tabella.tabella-attiva");
  const zona = figura ? zonaSelezionata(figura) : null;
  const giusta = zona ? cellaA(figura, zona.r2, zona.c2) : null;
  foglio.querySelectorAll("td.angolo-selezione").forEach((td) => {
    if (td !== giusta) td.classList.remove("angolo-selezione");
  });
  if (giusta && !giusta.classList.contains("angolo-selezione")) giusta.classList.add("angolo-selezione");
}

function zonaSelezionata(figura) {
  const indirizzi = [...figura.querySelectorAll("tbody td.selezionata")]
    .map((td) => ({ td, ind: analizzaIndirizzo(td.dataset.cella) }))
    .filter((voce) => voce.ind);
  if (!indirizzi.length) return null;
  const zona = { r1: Infinity, r2: -Infinity, c1: Infinity, c2: -Infinity };
  indirizzi.forEach(({ td, ind }) => {
    zona.r1 = Math.min(zona.r1, ind.riga);
    zona.c1 = Math.min(zona.c1, ind.colonna);
    zona.r2 = Math.max(zona.r2, ind.riga + (td.rowSpan || 1) - 1);
    zona.c2 = Math.max(zona.c2, ind.colonna + (td.colSpan || 1) - 1);
  });
  return zona;
}

function cellaA(figura, riga, colonna) {
  if (riga < 1 || colonna < 1) return null;
  return figura.querySelector(`tbody td[data-cella="${lettereDaColonna(colonna)}${riga}"]`);
}

function misureTabella(figura) {
  return {
    righe: figura.querySelectorAll("tbody tr").length,
    colonne: figura.querySelectorAll("thead th").length - 1,
  };
}

function rettangoloSchermo(figura, zona) {
  const primo = cellaA(figura, zona.r1, zona.c1)?.getBoundingClientRect();
  const ultimo = cellaA(figura, zona.r2, zona.c2)?.getBoundingClientRect();
  if (!primo || !ultimo) return null;
  return { left: primo.left, top: primo.top, right: ultimo.right, bottom: ultimo.bottom };
}

function cosaSottoIlMouse(evento) {
  const td = evento.target.closest?.("td[data-cella]");
  if (!td || !foglio.contains(td) || !td.classList.contains("selezionata")) return null;
  const figura = td.closest(".blocco-tabella");
  const zona = zonaSelezionata(figura);
  const box = zona && rettangoloSchermo(figura, zona);
  if (!box) return null;
  const x = evento.clientX;
  const y = evento.clientY;
  if (x > box.right - MISURA_QUADRATINO && y > box.bottom - MISURA_QUADRATINO && td === cellaA(figura, zona.r2, zona.c2)) {
    return { modo: "riempi", figura, zona };
  }
  const vicinoBordo = x - box.left < MARGINE_BORDO || box.right - x < MARGINE_BORDO || y - box.top < MARGINE_BORDO || box.bottom - y < MARGINE_BORDO;
  if (vicinoBordo) return { modo: "sposta", figura, zona, partenza: analizzaIndirizzo(td.dataset.cella) };
  return null;
}

function iniziaTrascina(evento) {
  if (evento.button !== 0 || document.body.classList.contains("formula-punta")) return;
  const presa = cosaSottoIlMouse(evento);
  if (!presa) return;
  evento.preventDefault();
  evento.stopPropagation();
  document.dispatchEvent(new CustomEvent("salva-formula-cella"));
  trascina = { ...presa, arrivo: null };
  document.body.classList.add(presa.modo === "riempi" ? "cursore-riempi" : "cursore-sposta-celle");
}

function muovi(evento) {
  if (!trascina) {
    aggiornaCursore(evento);
    return;
  }
  const sotto = document.elementFromPoint(evento.clientX, evento.clientY)?.closest?.("td[data-cella]");
  if (!sotto || sotto.closest(".blocco-tabella") !== trascina.figura) return;
  const ind = analizzaIndirizzo(sotto.dataset.cella);
  if (!ind) return;
  trascina.arrivo = trascina.modo === "riempi" ? zonaRiempimento(trascina.zona, ind) : zonaSpostata(trascina, ind);
  disegnaAnteprima();
}

function aggiornaCursore(evento) {
  const presa = evento.target.closest?.("td.selezionata") ? cosaSottoIlMouse(evento) : null;
  document.body.classList.toggle("sopra-quadratino", presa?.modo === "riempi");
  document.body.classList.toggle("sopra-bordo-selezione", presa?.modo === "sposta");
}

function zonaRiempimento(zona, ind) {
  const giu = ind.riga - zona.r2;
  const su = zona.r1 - ind.riga;
  const destra = ind.colonna - zona.c2;
  const sinistra = zona.c1 - ind.colonna;
  const verticale = Math.max(giu, su);
  const orizzontale = Math.max(destra, sinistra);
  if (verticale <= 0 && orizzontale <= 0) return null;
  if (verticale >= orizzontale) {
    return giu > 0
      ? { r1: zona.r2 + 1, r2: ind.riga, c1: zona.c1, c2: zona.c2, verso: "giu" }
      : { r1: ind.riga, r2: zona.r1 - 1, c1: zona.c1, c2: zona.c2, verso: "su" };
  }
  return destra > 0
    ? { r1: zona.r1, r2: zona.r2, c1: zona.c2 + 1, c2: ind.colonna, verso: "destra" }
    : { r1: zona.r1, r2: zona.r2, c1: ind.colonna, c2: zona.c1 - 1, verso: "sinistra" };
}

function zonaSpostata(stato, ind) {
  const dr = ind.riga - stato.partenza.riga;
  const dc = ind.colonna - stato.partenza.colonna;
  if (!dr && !dc) return null;
  const { righe, colonne } = misureTabella(stato.figura);
  const z = stato.zona;
  const r1 = Math.min(Math.max(1, z.r1 + dr), righe - (z.r2 - z.r1));
  const c1 = Math.min(Math.max(1, z.c1 + dc), colonne - (z.c2 - z.c1));
  if (r1 === z.r1 && c1 === z.c1) return null;
  return { r1, c1, r2: r1 + (z.r2 - z.r1), c2: c1 + (z.c2 - z.c1) };
}

function disegnaAnteprima() {
  pulisciAnteprima();
  const zona = trascina.arrivo;
  if (!zona) return;
  const classe = trascina.modo === "riempi" ? "anteprima-riempi" : "anteprima-sposta";
  perOgniCella(zona, (riga, colonna) => cellaA(trascina.figura, riga, colonna)?.classList.add(classe));
}

function pulisciAnteprima() {
  foglio.querySelectorAll(".anteprima-riempi, .anteprima-sposta").forEach((td) => td.classList.remove("anteprima-riempi", "anteprima-sposta"));
}

function perOgniCella(zona, azione) {
  for (let riga = zona.r1; riga <= zona.r2; riga += 1) {
    for (let colonna = zona.c1; colonna <= zona.c2; colonna += 1) azione(riga, colonna);
  }
}

function fine() {
  if (!trascina) return;
  const { modo, figura, zona, arrivo } = trascina;
  annulla();
  if (!arrivo) return;
  if (!zonaLibera(figura, zona) || !zonaLibera(figura, arrivo)) {
    avvisa("Qui ci sono celle unite. Separale prima di trascinare.");
    return;
  }
  const nuova = modo === "riempi" ? riempi(figura, zona, arrivo) : sposta(figura, zona, arrivo);
  selezionaZona(figura, nuova);
  ricalcolaTutte();
  segnaModifica();
}

function annulla() {
  trascina = null;
  pulisciAnteprima();
  document.body.classList.remove("cursore-riempi", "cursore-sposta-celle");
}

function zonaLibera(figura, zona) {
  let libera = true;
  perOgniCella(zona, (riga, colonna) => {
    const td = cellaA(figura, riga, colonna);
    if (!td || (td.colSpan || 1) > 1 || (td.rowSpan || 1) > 1) libera = false;
  });
  return libera;
}

function leggiCella(td) {
  const dati = { raw: td.dataset.raw ?? "" };
  CHIAVI_FORMATO.forEach((chiave) => {
    dati[chiave] = td.dataset[chiave];
  });
  return dati;
}

function scriviCella(td, dati) {
  td.dataset.raw = dati.raw;
  CHIAVI_FORMATO.forEach((chiave) => {
    if (dati[chiave]) td.dataset[chiave] = dati[chiave];
    else delete td.dataset[chiave];
  });
  delete td.dataset.totale;
}

// ---------- Riempire ----------

function riempi(figura, zona, arrivo) {
  const alto = zona.r2 - zona.r1 + 1;
  const largo = zona.c2 - zona.c1 + 1;
  const verticale = arrivo.verso === "giu" || arrivo.verso === "su";
  const serie = calcolaSerie(figura, zona, verticale);
  perOgniCella(arrivo, (riga, colonna) => {
    const rigaFonte = zona.r1 + modulo(riga - zona.r1, alto);
    const colonnaFonte = zona.c1 + modulo(colonna - zona.c1, largo);
    const fonte = leggiCella(cellaA(figura, rigaFonte, colonnaFonte));
    const chiaveSerie = verticale ? colonna : riga;
    const passo = verticale ? riga - zona.r1 : colonna - zona.c1;
    const linea = serie.get(chiaveSerie);
    if (linea) fonte.raw = scriviNumero(linea.inizio + linea.passo * passo, linea.virgola);
    else fonte.raw = spostaRiferimenti(fonte.raw, riga - rigaFonte, colonna - colonnaFonte);
    scriviCella(cellaA(figura, riga, colonna), fonte);
  });
  return {
    r1: Math.min(zona.r1, arrivo.r1),
    r2: Math.max(zona.r2, arrivo.r2),
    c1: Math.min(zona.c1, arrivo.c1),
    c2: Math.max(zona.c2, arrivo.c2),
  };
}

function modulo(numero, base) {
  return ((numero % base) + base) % base;
}

// Due o più numeri in fila diventano una serie: 1, 2 → 3, 4, 5…
function calcolaSerie(figura, zona, verticale) {
  const serie = new Map();
  const lunghezza = verticale ? zona.r2 - zona.r1 + 1 : zona.c2 - zona.c1 + 1;
  if (lunghezza < 2) return serie;
  const [da, a] = verticale ? [zona.c1, zona.c2] : [zona.r1, zona.r2];
  for (let linea = da; linea <= a; linea += 1) {
    const valori = [];
    let virgola = false;
    for (let passo = 0; passo < lunghezza; passo += 1) {
      const td = verticale ? cellaA(figura, zona.r1 + passo, linea) : cellaA(figura, linea, zona.c1 + passo);
      const raw = (td?.dataset.raw || "").trim();
      const numero = raw.startsWith("=") ? null : parseNumero(raw);
      if (numero == null) break;
      if (raw.includes(",")) virgola = true;
      valori.push(numero);
    }
    if (valori.length !== lunghezza) continue;
    const passo = (valori[lunghezza - 1] - valori[0]) / (lunghezza - 1);
    serie.set(linea, { inizio: valori[0], passo, virgola });
  }
  return serie;
}

function scriviNumero(numero, virgola) {
  const testo = String(Number(numero.toFixed(10)));
  return virgola ? testo.replace(".", ",") : testo;
}

function spostaRiferimenti(raw, dr, dc) {
  if (!raw.trim().startsWith("=")) return raw;
  return raw.replace(RIFERIMENTO, (tutto, prima, nome, lettere, numeri) => {
    const ind = analizzaIndirizzo(`${lettere}${numeri}`);
    if (!ind) return tutto;
    const riga = ind.riga + dr;
    const colonna = ind.colonna + dc;
    const etichetta = riga < 1 || colonna < 1 ? "ZZ99" : lettereDaColonna(colonna) + riga;
    return nome ? `${prima}${nome}.${etichetta}` : `${prima}${etichetta}`;
  });
}

// ---------- Spostare ----------

function sposta(figura, zona, arrivo) {
  const dr = arrivo.r1 - zona.r1;
  const dc = arrivo.c1 - zona.c1;
  const presi = [];
  perOgniCella(zona, (riga, colonna) => {
    const td = cellaA(figura, riga, colonna);
    presi.push({ riga, colonna, dati: leggiCella(td) });
    scriviCella(td, { raw: "" });
  });
  presi.forEach(({ riga, colonna, dati }) => scriviCella(cellaA(figura, riga + dr, colonna + dc), dati));
  aggiornaRiferimentiSpostati(figura.dataset.id, zona, dr, dc);
  return arrivo;
}

function dentro(zona, ind) {
  return ind.riga >= zona.r1 && ind.riga <= zona.r2 && ind.colonna >= zona.c1 && ind.colonna <= zona.c2;
}

function aggiornaRiferimentiSpostati(id, zona, dr, dc) {
  const stessoNome = (nome) => nome.toLowerCase() === id.toLowerCase();
  document.querySelectorAll(".blocco-tabella td[data-raw]").forEach((td) => {
    const raw = td.dataset.raw || "";
    if (!raw.trim().startsWith("=")) return;
    const nellaStessa = td.closest(".blocco-tabella")?.dataset.id === id;
    td.dataset.raw = raw.replace(RIFERIMENTO_O_INTERVALLO, (tutto, prima, nome, cella, nome2, cella2) => {
      if (nome ? !stessoNome(nome) : !nellaStessa) return tutto;
      const da = analizzaIndirizzo(cella);
      const a = cella2 ? analizzaIndirizzo(cella2) : null;
      if (!da || (cella2 && !a)) return tutto;
      // Un intervallo cambia solo se è stato spostato tutto intero.
      if (!dentro(zona, da) || (a && !dentro(zona, a))) return tutto;
      const sposta = (ind) => lettereDaColonna(ind.colonna + dc) + (ind.riga + dr);
      const inizio = nome ? `${nome}.${sposta(da)}` : sposta(da);
      if (!a) return `${prima}${inizio}`;
      return `${prima}${inizio}:${nome2 ? `${nome2}.` : ""}${sposta(a)}`;
    });
  });
  document.querySelectorAll(".riferimento").forEach((span) => {
    if (span.dataset.tabella !== id) return;
    const ind = analizzaIndirizzo(span.dataset.cella);
    if (!ind || !dentro(zona, ind)) return;
    span.dataset.cella = lettereDaColonna(ind.colonna + dc) + (ind.riga + dr);
  });
}

// ---------- Selezione finale ----------

function selezionaZona(figura, zona) {
  const celle = [];
  perOgniCella(zona, (riga, colonna) => {
    const td = cellaA(figura, riga, colonna);
    if (td) celle.push(td);
  });
  const ancora = cellaA(figura, zona.r1, zona.c1);
  if (!ancora) return;
  const vecchia = document.querySelector(".blocco-tabella td.cella-ancora");
  const formula = document.getElementById("formula");
  if (vecchia) formula.value = vecchia.dataset.raw || "";
  document.dispatchEvent(new CustomEvent("selezione-celle", { detail: { ancora, celle, fuoco: false } }));
  formula.value = ancora.dataset.raw || "";
}
