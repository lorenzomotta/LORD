// I rientri del paragrafo, come in Word, in millimetri dai margini della pagina:
// "sinistra" è dove cominciano le righe, "prima" dove comincia la prima riga,
// "destra" quanto il paragrafo si ferma prima del margine destro.
// Si salvano nello stile del paragrafo (margin-left, text-indent, margin-right).

import { PIXEL_PER_MM } from "./tabulazioni.js";

export function leggiRientri(paragrafo) {
  const sinistra = millimetri(paragrafo.style.marginLeft);
  return {
    sinistra,
    prima: sinistra + millimetri(paragrafo.style.textIndent),
    destra: millimetri(paragrafo.style.marginRight),
  };
}

export function scriviRientri(paragrafo, { sinistra, prima, destra }) {
  const rientro = prima - sinistra;
  paragrafo.style.marginLeft = sinistra ? `${arrotonda(sinistra)}mm` : "";
  paragrafo.style.textIndent = rientro ? `${arrotonda(rientro)}mm` : "";
  paragrafo.style.marginRight = destra ? `${arrotonda(destra)}mm` : "";
  if (!paragrafo.getAttribute("style")) paragrafo.removeAttribute("style");
}

// Gli stessi rientri per Word, che li vuole in ventesimi di punto (twip).
export function rientriWord(paragrafo) {
  const { sinistra, prima, destra } = leggiRientri(paragrafo);
  if (!sinistra && !prima && !destra) return null;
  const twip = (mm) => Math.round((mm * 1440) / 25.4);
  const rientro = { left: twip(sinistra), right: twip(destra) };
  if (prima > sinistra) rientro.firstLine = twip(prima - sinistra);
  if (prima < sinistra) rientro.hanging = twip(sinistra - prima);
  return rientro;
}

function arrotonda(mm) {
  return Math.round(mm * 10) / 10;
}

// Il testo incollato da altri programmi può usare pt, cm o px: tutto diventa millimetri.
function millimetri(valore) {
  const numero = parseFloat(valore);
  if (!Number.isFinite(numero)) return 0;
  if (valore.endsWith("mm")) return numero;
  if (valore.endsWith("cm")) return numero * 10;
  if (valore.endsWith("pt")) return (numero * 25.4) / 72;
  if (valore.endsWith("in")) return numero * 25.4;
  if (valore.endsWith("px")) return numero / PIXEL_PER_MM;
  return 0;
}
