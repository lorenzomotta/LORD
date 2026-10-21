// Decide quali lati di ogni cella hanno la linea. Lo usano editor, anteprima e Word,
// così i bordi sono uguali dappertutto.

import { analizzaIndirizzo } from "./formule.js";

const LATI = ["su", "giu", "sx", "dx"];
const CLASSI_SENZA = LATI.map((lato) => `senza-${lato}`);

export function modoBordiTabella(figura) {
  const modo = figura?.dataset?.bordi;
  return ["tutti", "cornice", "orizzontali", "nessuno"].includes(modo) ? modo : "tutti";
}

function posizione(td) {
  const ind = analizzaIndirizzo(td.dataset.cella);
  if (!ind) return null;
  return {
    r1: ind.riga,
    c1: ind.colonna,
    r2: ind.riga + Math.max(1, td.rowSpan || 1) - 1,
    c2: ind.colonna + Math.max(1, td.colSpan || 1) - 1,
  };
}

// Cosa chiede la cella da sola: la scelta sulla cella vince su quella della tabella.
function desiderio(td, pos, modo, ultimaRiga, ultimaColonna) {
  const scelta = td.dataset.bordo;
  if (scelta === "tutti") return { su: true, giu: true, sx: true, dx: true, esplicito: true };
  if (scelta === "sotto") return { su: false, giu: true, sx: false, dx: false, esplicito: true };
  if (scelta === "nessuno") return { su: false, giu: false, sx: false, dx: false, esplicito: true };
  if (modo === "nessuno") return { su: false, giu: false, sx: false, dx: false };
  if (modo === "orizzontali") return { su: true, giu: true, sx: false, dx: false };
  if (modo === "cornice") {
    return { su: pos.r1 === 1, giu: pos.r2 === ultimaRiga, sx: pos.c1 === 1, dx: pos.c2 === ultimaColonna };
  }
  return { su: true, giu: true, sx: true, dx: true };
}

// Due celle vicine condividono la stessa linea. Se solo una delle due ha una scelta propria,
// decide lei; altrimenti basta che una delle due la voglia.
function unisci(mio, vicino, latoMio, latoVicino) {
  if (!vicino) return mio[latoMio];
  if (mio.esplicito && !vicino.esplicito) return mio[latoMio];
  if (vicino.esplicito && !mio.esplicito) return vicino[latoVicino];
  return mio[latoMio] || vicino[latoVicino];
}

// Restituisce una Map: cella → { su, giu, sx, dx } (true = linea visibile).
export function calcolaBordi(figura) {
  const celle = [...figura.querySelectorAll("table > tbody > tr > td[data-cella]")];
  const griglia = new Map();
  const posizioni = new Map();
  let ultimaRiga = 0;
  let ultimaColonna = 0;
  celle.forEach((td) => {
    const pos = posizione(td);
    if (!pos) return;
    posizioni.set(td, pos);
    ultimaRiga = Math.max(ultimaRiga, pos.r2);
    ultimaColonna = Math.max(ultimaColonna, pos.c2);
    for (let r = pos.r1; r <= pos.r2; r++) {
      for (let c = pos.c1; c <= pos.c2; c++) griglia.set(`${r},${c}`, td);
    }
  });

  const modo = modoBordiTabella(figura);
  const desideri = new Map();
  posizioni.forEach((pos, td) => desideri.set(td, desiderio(td, pos, modo, ultimaRiga, ultimaColonna)));
  const vicino = (r, c) => desideri.get(griglia.get(`${r},${c}`));

  const risultato = new Map();
  posizioni.forEach((pos, td) => {
    const mio = desideri.get(td);
    const lati = { su: false, giu: false, sx: false, dx: false };
    // Una cella unita può toccare più celle su un lato: la linea c'è se serve almeno in un tratto.
    for (let c = pos.c1; c <= pos.c2; c++) {
      lati.su ||= unisci(mio, vicino(pos.r1 - 1, c), "su", "giu");
      lati.giu ||= unisci(mio, vicino(pos.r2 + 1, c), "giu", "su");
    }
    for (let r = pos.r1; r <= pos.r2; r++) {
      lati.sx ||= unisci(mio, vicino(r, pos.c1 - 1), "sx", "dx");
      lati.dx ||= unisci(mio, vicino(r, pos.c2 + 1), "dx", "sx");
    }
    risultato.set(td, lati);
  });
  return risultato;
}

// Ogni lato senza linea riceve la classe senza-su / senza-giu / senza-sx / senza-dx.
export function segnaLati(td, lati) {
  LATI.forEach((lato) => td.classList.toggle(`senza-${lato}`, Boolean(lati) && !lati[lato]));
}

export function aggiornaBordiTabella(figura) {
  if (!figura) return;
  calcolaBordi(figura).forEach((lati, td) => segnaLati(td, lati));
}

// Per Word: legge le classi messe da segnaLati.
export function latiDaClassi(td) {
  const lati = {};
  LATI.forEach((lato, i) => {
    lati[lato] = !td.classList.contains(CLASSI_SENZA[i]);
  });
  return lati;
}
