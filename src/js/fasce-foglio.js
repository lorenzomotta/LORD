// Intestazione e piè di pagina. Il testo scritto qui compare su ogni pagina.

import { segnaModifica } from "./modifiche.js";

const ID_INTESTAZIONE = "intestazione-foglio";
const ID_PIE = "pie-foglio";

export function avviaFasce() {
  for (const id of [ID_INTESTAZIONE, ID_PIE]) {
    const fascia = document.getElementById(id);
    segnaVuota(fascia);
    fascia.addEventListener("input", () => {
      segnaVuota(fascia);
      aggiornaSpecchi();
      segnaModifica();
    });
  }
}

export function impostaFasce(intestazione, pie) {
  scrivi(ID_INTESTAZIONE, intestazione);
  scrivi(ID_PIE, pie);
  aggiornaSpecchi();
}

export function htmlIntestazione() {
  return htmlFascia(ID_INTESTAZIONE);
}

export function htmlPie() {
  return htmlFascia(ID_PIE);
}

export function sistemaFasce(sopra, sotto) {
  const intestazione = document.getElementById(ID_INTESTAZIONE);
  const pie = document.getElementById(ID_PIE);
  const carte = [...document.querySelectorAll(".carta-pagina")];
  if (!intestazione || !pie || !carte.length) return;

  const prima = carte[0];
  const riservaNumero = document.getElementById("numeri-pagina")?.checked ? Math.min(sotto * 0.4, 36) : 8;
  const distanza = distanzaIntestazionePx(sopra);
  const altezzaIntestazione = Math.max(0, sopra - distanza - 4);
  const topPrima = parseFloat(prima.style.top) || 0;
  intestazione.style.top = `${topPrima + distanza}px`;
  intestazione.style.minHeight = "0px";
  intestazione.style.height = `${altezzaIntestazione}px`;
  pie.style.top = `${prima.top + prima.height - sotto + 2}px`;
  pie.style.height = `${Math.max(22, sotto - riservaNumero - 4)}px`;

  carte.forEach((carta, indice) => {
    carta.querySelectorAll(".specchio-fascia").forEach((nodo) => nodo.remove());
    if (indice === 0) return;
    carta.append(specchio("specchio-intestazione", intestazione.innerHTML, `top:${distanza}px;height:${altezzaIntestazione}px`));
    carta.append(specchio("specchio-pie", pie.innerHTML, `bottom:${Math.round(riservaNumero)}px;height:${Math.max(22, sotto - riservaNumero - 4)}px`));
  });
}

function distanzaIntestazionePx(sopraPx) {
  const margine = Number(document.getElementById("margine-sopra")?.value);
  const distanza = Number(document.getElementById("distanza-intestazione")?.value);
  if (!Number.isFinite(margine) || margine <= 0 || !Number.isFinite(distanza) || distanza <= 0) return 0;
  return sopraPx * (Math.min(distanza, margine) / margine);
}

function specchio(classe, html, stile) {
  const nodo = document.createElement("div");
  nodo.className = `specchio-fascia ${classe}`;
  nodo.style.cssText = stile;
  nodo.innerHTML = html;
  return nodo;
}

function aggiornaSpecchi() {
  const intestazione = document.getElementById(ID_INTESTAZIONE);
  const pie = document.getElementById(ID_PIE);
  document.querySelectorAll(".specchio-intestazione").forEach((nodo) => {
    nodo.innerHTML = intestazione?.innerHTML || "";
  });
  document.querySelectorAll(".specchio-pie").forEach((nodo) => {
    nodo.innerHTML = pie?.innerHTML || "";
  });
}

function scrivi(id, html) {
  const fascia = document.getElementById(id);
  if (!fascia) return;
  fascia.innerHTML = html || "";
  segnaVuota(fascia);
}

function segnaVuota(fascia) {
  if (!fascia) return;
  const vuota = !fascia.textContent.replace(/\u00a0/g, " ").trim() && !fascia.querySelector("img");
  fascia.classList.toggle("vuota", vuota);
}

function htmlFascia(id) {
  const fascia = document.getElementById(id);
  if (!fascia) return "";
  if (!fascia.textContent.replace(/\u00a0/g, " ").trim() && !fascia.querySelector("img")) return "";
  const copia = fascia.cloneNode(true);
  copia.querySelectorAll("script, style").forEach((nodo) => nodo.remove());
  copia.querySelectorAll("[data-cursor-ref]").forEach((nodo) => nodo.removeAttribute("data-cursor-ref"));
  return copia.innerHTML;
}
