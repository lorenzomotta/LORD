// Righello sul lato sinistro della pagina. Segue lo scorrimento del foglio.
// Lo zero è il margine alto: da lì i numeri scendono di un centimetro alla volta.

import { impostaMargine } from "./documento.js";
import { foglio } from "./editor.js";
import { messaggio, segnaModifica } from "./modifiche.js";
import { zoomPagina } from "./zoom-pagina.js";

const PIXEL_PER_MM = 96 / 25.4;

let pista = null;
let attesa = 0;

export function avviaRighelloVerticale() {
  pista = document.getElementById("righello-verticale");
  const scrivania = document.getElementById("scrivania");
  scrivania.addEventListener("scroll", aggiorna, { passive: true });
  window.addEventListener("resize", aggiorna);
  document.addEventListener("formato-pagina", aggiorna);
  document.addEventListener("zoom-pagina", aggiorna);
  document.addEventListener("relazione-modificata", aggiorna);
  new ResizeObserver(aggiorna).observe(foglio);
  new ResizeObserver(aggiorna).observe(document.getElementById("cornice-foglio"));
  pista.addEventListener("mousedown", iniziaMargine);
  aggiorna();
}

function aggiorna() {
  if (attesa) return;
  attesa = requestAnimationFrame(() => {
    attesa = 0;
    disegna();
  });
}

function disegna() {
  const origine = pista.getBoundingClientRect().top;
  const zoom = zoomPagina();
  const scala = PIXEL_PER_MM * zoom;
  const stile = getComputedStyle(foglio);
  const sopra = (parseFloat(stile.paddingTop) || 0) * zoom;
  const sotto = (parseFloat(stile.paddingBottom) || 0) * zoom;
  const pagine = document.querySelectorAll(".carta-pagina");
  const pezzi = pagine.length ? [...pagine] : [foglio];

  while (pista.childElementCount > pezzi.length) pista.lastElementChild.remove();
  pezzi.forEach((pezzo, indice) => {
    const box = pezzo.getBoundingClientRect();
    let fascia = pista.children[indice];
    if (!fascia) {
      fascia = document.createElement("div");
      fascia.className = "righello-v-pagina";
      fascia.innerHTML = '<div class="righello-v-testo"><span class="maniglia-margine sopra" data-margine="sopra" title="Margine alto: trascina la lineetta per spostarlo"></span><span class="maniglia-margine sotto" data-margine="sotto" title="Margine basso: trascina la lineetta per spostarlo"></span></div><div class="righello-v-tacche"></div>';
      pista.append(fascia);
    }
    fascia.style.top = `${box.top - origine}px`;
    fascia.style.height = `${box.height}px`;
    const testo = fascia.querySelector(".righello-v-testo");
    testo.style.top = `${sopra}px`;
    testo.style.bottom = `${sotto}px`;
    const chiave = `${scala.toFixed(4)}|${Math.round(box.height)}|${Math.round(sopra)}|${Math.round(sotto)}`;
    if (fascia.dataset.chiave !== chiave) {
      fascia.dataset.chiave = chiave;
      disegnaTacche(fascia.querySelector(".righello-v-tacche"), box.height, sopra, scala);
    }
  });
}

const NOMI_MARGINE = { sopra: "Margine alto", sotto: "Margine basso" };

function iniziaMargine(evento) {
  if (evento.button !== 0) return;
  const maniglia = evento.target.closest(".maniglia-margine");
  if (!maniglia) return;
  evento.preventDefault();
  const lato = maniglia.dataset.margine;
  const id = `margine-${lato}`;
  const indice = [...pista.children].indexOf(maniglia.closest(".righello-v-pagina"));
  const partenza = Number(document.getElementById(id).value);
  const guida = document.createElement("div");
  guida.className = "guida-margine orizzontale";
  document.body.append(guida);
  let frame = 0;
  let ultimo = partenza;

  const cartaDi = () => document.querySelectorAll(".carta-pagina")[indice] || foglio;
  const applica = (clientY) => {
    const scala = PIXEL_PER_MM * zoomPagina();
    const box = cartaDi().getBoundingClientRect();
    ultimo = lato === "sopra" ? (clientY - box.top) / scala : (box.bottom - clientY) / scala;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const esito = impostaMargine(id, ultimo);
      messaggio(`${NOMI_MARGINE[lato]}: ${esito.valore} mm`);
      const ora = cartaDi().getBoundingClientRect();
      const scalaOra = PIXEL_PER_MM * zoomPagina();
      guida.style.top = `${lato === "sopra" ? ora.top + esito.valore * scalaOra : ora.bottom - esito.valore * scalaOra}px`;
      guida.style.left = `${ora.left}px`;
      guida.style.width = `${ora.width}px`;
    });
  };
  applica(evento.clientY);

  const muovi = (mossa) => applica(mossa.clientY);
  const tasto = (mossa) => {
    if (mossa.key === "Escape") chiudi(true);
  };
  const rilascia = () => chiudi(false);
  function chiudi(annulla) {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", rilascia);
    document.removeEventListener("keydown", tasto);
    cancelAnimationFrame(frame);
    guida.remove();
    if (annulla) {
      impostaMargine(id, partenza);
      messaggio("Margine lasciato com'era.");
    } else {
      const esito = impostaMargine(id, ultimo);
      if (esito.marginiRidotti) messaggio("Ho ridotto un margine, così resta spazio per scrivere.");
      else if (esito.distanzaRidotta) messaggio("Ho avvicinato l’intestazione al bordo, così resta nel margine alto.");
      else messaggio(`${NOMI_MARGINE[lato]}: ${esito.valore} mm`);
      if (esito.valore !== partenza) segnaModifica();
    }
    disegna();
  }
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", rilascia);
  document.addEventListener("keydown", tasto);
}

// Numeri ogni centimetro, tacca lunga a ogni mezzo, corta a ogni quarto. Lo zero è il margine alto.
function disegnaTacche(contenitore, altezza, sopra, scala) {
  contenitore.replaceChildren();
  const primo = Math.ceil(-sopra / scala / 2.5);
  const ultimo = Math.floor((altezza - sopra) / scala / 2.5);
  for (let passo = primo; passo <= ultimo; passo += 1) {
    if (passo === 0) continue;
    const y = sopra + passo * 2.5 * scala;
    if (y < 8 || y > altezza - 4) continue;
    if (passo % 4 === 0) {
      const numero = document.createElement("span");
      numero.className = "righello-v-numero";
      numero.style.top = `${y}px`;
      numero.textContent = String(Math.abs(passo / 4));
      contenitore.append(numero);
    } else {
      const tacca = document.createElement("span");
      tacca.className = passo % 2 === 0 ? "righello-v-tacca lunga" : "righello-v-tacca";
      tacca.style.top = `${y}px`;
      contenitore.append(tacca);
    }
  }
}
