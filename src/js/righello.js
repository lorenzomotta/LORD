// Il righello sopra il foglio, come in Word: mostra i centimetri, i margini, i rientri e le tabulazioni
// del paragrafo dove sta il cursore. Un clic sul righello aggiunge una tabulazione,
// trascinarla la sposta, trascinarla fuori dal righello la toglie. I triangolini dei rientri si trascinano.

import { impostaMargine } from "./documento.js";
import { foglio } from "./editor.js";
import { messaggio, segnaModifica } from "./modifiche.js";
import { leggiRientri, scriviRientri } from "./rientri.js";
import {
  TIPI_TABULAZIONE,
  disponiParagrafo,
  leggiTabulazioni,
  misureTesto,
  paragrafiSelezionati,
  scriviTabulazioni,
} from "./tabulazioni.js";

const NOMI = {
  sinistra: "a sinistra",
  centro: "al centro",
  destra: "a destra",
  decimale: "decimale (allinea la virgola)",
};

// Il disegno di ogni tipo; "asta" dice a quanti pixel dal bordo sinistro sta la linea verticale.
const SEGNI = {
  sinistra: { asta: 1, disegno: '<path d="M1 0v9h9" />' },
  centro: { asta: 5, disegno: '<path d="M5 0v9M0 9h10" />' },
  destra: { asta: 9, disegno: '<path d="M9 0v9H0" />' },
  decimale: { asta: 5, disegno: '<path d="M5 0v9M0 9h10" /><circle cx="8.5" cy="3.5" r="1.2" />' },
};

const RIENTRI = {
  prima: {
    titolo: "Rientro prima riga: dove comincia la prima riga del paragrafo",
    disegno: '<svg viewBox="0 0 10 7" aria-hidden="true"><path d="M0.5 0.5h9L5 6.5z" /></svg>',
  },
  sporgente: {
    titolo: "Inizio paragrafo: dove cominciano le altre righe (la prima resta ferma)",
    disegno: '<svg viewBox="0 0 10 7" aria-hidden="true"><path d="M5 0.5l4.5 6h-9z" /></svg>',
  },
  sinistra: {
    titolo: "Sposta tutto il paragrafo, prima riga compresa",
    disegno: '<svg viewBox="0 0 10 5" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="4" /></svg>',
  },
  destra: {
    titolo: "Fine paragrafo: dove finiscono le righe a destra",
    disegno: '<svg viewBox="0 0 10 7" aria-hidden="true"><path d="M5 0.5l4.5 6h-9z" /></svg>',
  },
};

const LONTANO_PER_TOGLIERE = 28;
const SPAZIO_MINIMO = 10;

let tipoScelto = "sinistra";
let pista = null;
let paginaRighello = null;
let testoRighello = null;
let tacche = null;
let segni = null;
let ultimaScala = "";
let attesa = 0;
let trascinando = false;

export function avviaRighello() {
  pista = document.getElementById("righello-pista");
  paginaRighello = document.createElement("div");
  paginaRighello.className = "righello-pagina";
  testoRighello = document.createElement("div");
  testoRighello.className = "righello-testo";
  tacche = document.createElement("div");
  tacche.className = "righello-tacche";
  segni = document.createElement("div");
  segni.className = "righello-segni";
  paginaRighello.append(testoRighello, tacche);
  testoRighello.append(
    segni,
    creaManiglia("sinistra", "Margine sinistro: trascina la lineetta per spostarlo"),
    creaManiglia("destra", "Margine destro: trascina la lineetta per spostarlo"),
  );
  pista.append(paginaRighello);

  const tipo = document.getElementById("tipo-tabulazione");
  tipo.addEventListener("mousedown", (evento) => evento.preventDefault());
  tipo.addEventListener("click", () => {
    tipoScelto = TIPI_TABULAZIONE[(TIPI_TABULAZIONE.indexOf(tipoScelto) + 1) % TIPI_TABULAZIONE.length];
    mostraTipo();
  });
  mostraTipo();

  pista.addEventListener("mousedown", iniziaTrascinamento);

  document.getElementById("scrivania").addEventListener("scroll", aggiorna, { passive: true });
  window.addEventListener("resize", aggiorna);
  document.addEventListener("selectionchange", aggiorna);
  document.addEventListener("formato-pagina", aggiorna);
  document.addEventListener("zoom-pagina", aggiorna);
  document.addEventListener("relazione-modificata", aggiorna);
  new ResizeObserver(aggiorna).observe(foglio);
  aggiorna();
}

function mostraTipo() {
  const tipo = document.getElementById("tipo-tabulazione");
  tipo.innerHTML = svgSegno(tipoScelto);
  tipo.title = `Tipo di tabulazione: ${NOMI[tipoScelto]}. Clic per cambiare tipo, poi clicca sul righello.`;
}

function svgSegno(tipo) {
  return `<svg viewBox="0 0 10 10" aria-hidden="true">${SEGNI[tipo].disegno}</svg>`;
}

function aggiorna() {
  if (attesa) return;
  attesa = requestAnimationFrame(() => {
    attesa = 0;
    disegna();
  });
}

function disegna() {
  const { scala, inizio, larghezza } = misureTesto();
  const box = pista.getBoundingClientRect();
  const foglioBox = foglio.getBoundingClientRect();
  const margineSinistro = (inizio - foglioBox.left) / scala;
  const larghezzaPagina = foglioBox.width / scala;

  paginaRighello.style.left = `${foglioBox.left - box.left}px`;
  paginaRighello.style.width = `${foglioBox.width}px`;
  testoRighello.style.left = `${margineSinistro * scala}px`;
  testoRighello.style.width = `${larghezza * scala}px`;

  const chiave = `${scala.toFixed(4)}|${margineSinistro.toFixed(2)}|${larghezzaPagina.toFixed(2)}`;
  if (chiave !== ultimaScala) {
    ultimaScala = chiave;
    disegnaTacche(scala, margineSinistro, larghezzaPagina);
  }
  if (!trascinando) disegnaSegni(scala);
}

// Numeri ogni centimetro, tacca lunga a ogni mezzo, corta a ogni quarto. Lo zero è il margine sinistro.
function disegnaTacche(scala, margineSinistro, larghezzaPagina) {
  tacche.replaceChildren();
  const primo = Math.ceil(-margineSinistro / 2.5);
  const ultimo = Math.floor((larghezzaPagina - margineSinistro) / 2.5);
  for (let passo = primo; passo <= ultimo; passo += 1) {
    if (passo === 0) continue;
    const mm = passo * 2.5;
    const x = (margineSinistro + mm) * scala;
    if (passo % 4 === 0) {
      const numero = document.createElement("span");
      numero.className = "righello-numero";
      numero.style.left = `${x}px`;
      numero.textContent = String(Math.abs(passo / 4));
      tacche.append(numero);
    } else {
      const tacca = document.createElement("span");
      tacca.className = passo % 2 === 0 ? "righello-tacca lunga" : "righello-tacca";
      tacca.style.left = `${x}px`;
      tacche.append(tacca);
    }
  }
}

function disegnaSegni(scala) {
  segni.replaceChildren();
  const [paragrafo] = paragrafiSelezionati();
  pista.classList.toggle("senza-paragrafo", !paragrafo);
  if (!paragrafo) return;
  for (const punto of leggiTabulazioni(paragrafo)) segni.append(creaSegno(punto, scala));

  const { sinistra, prima, destra } = leggiRientri(paragrafo);
  const { larghezza } = misureTesto();
  segni.append(
    creaRientro("prima", prima, scala),
    creaRientro("sporgente", sinistra, scala),
    creaRientro("sinistra", sinistra, scala),
    creaRientro("destra", larghezza - destra, scala),
  );
}

function creaRientro(quale, mm, scala) {
  const segno = document.createElement("span");
  segno.className = `segno-rientro rientro-${quale}`;
  segno.dataset.rientro = quale;
  segno.style.left = `${mm * scala - 5}px`;
  segno.title = `${RIENTRI[quale].titolo} (${centimetri(mm)} cm)`;
  segno.innerHTML = RIENTRI[quale].disegno;
  return segno;
}

function creaSegno(punto, scala) {
  const segno = document.createElement("span");
  segno.className = "segno-tabulazione";
  segno.dataset.tipo = punto.tipo;
  segno.dataset.pos = String(punto.pos);
  segno.style.left = `${punto.pos * scala - SEGNI[punto.tipo].asta}px`;
  segno.title = `Tabulazione ${NOMI[punto.tipo]} a ${centimetri(punto.pos)} cm. Trascinala per spostarla, fuori dal righello per toglierla.`;
  segno.innerHTML = svgSegno(punto.tipo);
  return segno;
}

function centimetri(mm) {
  return (Math.round(mm) / 10).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const NOMI_MARGINE = { sinistra: "Margine sinistro", destra: "Margine destro" };

function trascinaMargine(evento, lato) {
  const id = `margine-${lato}`;
  const partenza = Number(document.getElementById(id).value);
  const guida = document.createElement("div");
  guida.className = "guida-margine verticale";
  document.body.append(guida);
  trascinando = true;
  let frame = 0;
  let ultimo = partenza;

  const applica = (clientX) => {
    const { scala } = misureTesto();
    const box = foglio.getBoundingClientRect();
    ultimo = lato === "sinistra" ? (clientX - box.left) / scala : (box.right - clientX) / scala;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const esito = impostaMargine(id, ultimo);
      messaggio(`${NOMI_MARGINE[lato]}: ${esito.valore} mm`);
      const cornice = document.getElementById("cornice-foglio").getBoundingClientRect();
      const scalaOra = misureTesto().scala;
      const dalSinistro = lato === "sinistra" ? esito.valore : cornice.width / scalaOra - esito.valore;
      guida.style.left = `${cornice.left + dalSinistro * scalaOra}px`;
      guida.style.top = `${cornice.top}px`;
      guida.style.height = `${cornice.height}px`;
    });
  };
  applica(evento.clientX);

  const muovi = (mossa) => applica(mossa.clientX);
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
    trascinando = false;
    if (annulla) {
      impostaMargine(id, partenza);
      messaggio("Margine lasciato com'era.");
    } else {
      const esito = impostaMargine(id, ultimo);
      if (esito.marginiRidotti) messaggio("Ho ridotto un margine, così resta spazio per scrivere.");
      else messaggio(`${NOMI_MARGINE[lato]}: ${esito.valore} mm`);
      if (esito.valore !== partenza) segnaModifica();
    }
    disegna();
  }
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", rilascia);
  document.addEventListener("keydown", tasto);
}

function millimetriDa(clientX) {
  const { scala, inizio, larghezza } = misureTesto();
  const mm = Math.round((clientX - inizio) / scala);
  return { mm, dentro: mm > 0 && mm < larghezza };
}

function creaManiglia(lato, titolo) {
  const maniglia = document.createElement("span");
  maniglia.className = `maniglia-margine ${lato}`;
  maniglia.dataset.margine = lato;
  maniglia.title = titolo;
  return maniglia;
}

function iniziaTrascinamento(evento) {
  if (evento.button !== 0) return;
  const maniglia = evento.target.closest(".maniglia-margine");
  if (maniglia) {
    evento.preventDefault();
    trascinaMargine(evento, maniglia.dataset.margine);
    return;
  }
  evento.preventDefault();
  const paragrafi = paragrafiSelezionati();
  if (!paragrafi.length) {
    messaggio("Clicca prima nel paragrafo dove vuoi la tabulazione, poi sul righello.");
    return;
  }

  const rientro = evento.target.closest(".segno-rientro");
  if (rientro) {
    trascinaRientro(evento, rientro.dataset.rientro, paragrafi);
    return;
  }

  const esistente = evento.target.closest(".segno-tabulazione");
  let tipo = tipoScelto;
  let partenza;
  if (esistente) {
    tipo = esistente.dataset.tipo;
    partenza = Number(esistente.dataset.pos);
  } else {
    const { mm, dentro } = millimetriDa(evento.clientX);
    if (!dentro) return;
    partenza = mm;
  }

  // Per ogni paragrafo: la sua lista e il punto che si sta muovendo (trovato o appena aggiunto).
  const lavori = paragrafi.map((paragrafo) => {
    const punti = leggiTabulazioni(paragrafo);
    let punto = esistente ? punti.find((voce) => voce.tipo === tipo && Math.abs(voce.pos - partenza) < 0.06) : null;
    if (!punto) {
      punto = { tipo, pos: partenza };
      punti.push(punto);
    }
    return { paragrafo, punti, punto };
  });

  trascinando = true;
  const guida = document.createElement("div");
  guida.className = "guida-tabulazione";
  document.body.append(guida);
  const box = pista.getBoundingClientRect();
  const { scala } = misureTesto();
  const segnoVisto = esistente || creaSegno({ tipo, pos: partenza }, scala);
  if (!esistente) segni.append(segnoVisto);

  const applica = (clientX, clientY) => {
    const { mm } = millimetriDa(clientX);
    const { larghezza } = misureTesto();
    const pos = Math.min(Math.max(mm, 0), Math.floor(larghezza));
    const fuori = clientY < box.top - LONTANO_PER_TOGLIERE || clientY > box.bottom + LONTANO_PER_TOGLIERE;
    for (const lavoro of lavori) {
      lavoro.punto.pos = pos;
      lavoro.punto.tolto = fuori;
      scriviTabulazioni(lavoro.paragrafo, lavoro.punti);
      disponiParagrafo(lavoro.paragrafo);
    }
    segnoVisto.style.left = `${pos * scala - SEGNI[tipo].asta}px`;
    segnoVisto.classList.toggle("da-togliere", fuori);
    guida.style.left = `${misureTesto().inizio + pos * scala}px`;
    guida.style.top = `${box.bottom}px`;
    guida.hidden = fuori;
  };
  applica(evento.clientX, evento.clientY);

  const muovi = (mossa) => applica(mossa.clientX, mossa.clientY);
  const fine = () => {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    guida.remove();
    trascinando = false;
    segnaModifica();
    disegna();
  };
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

// I rientri presi dal primo paragrafo scelto valgono poi per tutti quelli selezionati.
function trascinaRientro(evento, quale, paragrafi) {
  const { scala, inizio } = misureTesto();
  const partenza = leggiRientri(paragrafi[0]);
  const xIniziale = (evento.clientX - inizio) / scala;
  const box = pista.getBoundingClientRect();
  const guida = document.createElement("div");
  guida.className = "guida-tabulazione";
  document.body.append(guida);
  trascinando = true;

  const applica = (clientX) => {
    const { larghezza } = misureTesto();
    const spostamento = Math.round((clientX - inizio) / scala - xIniziale);
    let { sinistra, prima, destra } = partenza;
    const limite = larghezza - destra - SPAZIO_MINIMO;
    if (quale === "prima") prima = limita(prima + spostamento, 0, limite);
    if (quale === "sporgente") sinistra = limita(sinistra + spostamento, 0, limite);
    if (quale === "sinistra") {
      const passo = limita(spostamento, -Math.min(sinistra, prima), limite - Math.max(sinistra, prima));
      sinistra += passo;
      prima += passo;
    }
    if (quale === "destra") destra = limita(destra - spostamento, 0, larghezza - Math.max(sinistra, prima) - SPAZIO_MINIMO);

    paragrafi.forEach((paragrafo) => scriviRientri(paragrafo, { sinistra, prima, destra }));
    disegnaSegni(scala);
    const dove = { prima, sporgente: sinistra, sinistra, destra: larghezza - destra }[quale];
    guida.style.left = `${inizio + dove * scala}px`;
    guida.style.top = `${box.bottom}px`;
  };
  applica(evento.clientX);

  const muovi = (mossa) => applica(mossa.clientX);
  const fine = () => {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    guida.remove();
    trascinando = false;
    segnaModifica();
    disegna();
  };
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

function limita(valore, minimo, massimo) {
  return Math.min(Math.max(valore, minimo), Math.max(minimo, massimo));
}
