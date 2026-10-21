// Crea il file Word (.docx) a partire dalla relazione.

import { foglio } from "./editor.js";
import { salvaByte } from "./file-disco.js";
import { avvisa } from "./finestre.js";
import { messaggio } from "./modifiche.js";
import { nomeFile, opzioniPagina } from "./documento.js";
import { attendiImmagini, costruisciVista } from "./vista.js";
import { latiDaClassi } from "./bordi-tabella.js";
import { stileWordDi, stiliPerWord } from "./stili-documento.js";
import { zoomPagina } from "./zoom-pagina.js";
import { formeSulFoglio, pngForma, segnaPagineEditor } from "./forme.js";
import { leggiTabulazioni } from "./tabulazioni.js";
import { rientriWord } from "./rientri.js";

export function avviaEsportazione() {
  document.getElementById("btn-docx").addEventListener("click", () => esportaDocx());
}

export async function esportaDocx() {
  try {
    messaggio("Creo il file Word...");
    const blob = await blobDocx();
    const byte = new Uint8Array(await blob.arrayBuffer());
    const salvato = await salvaByte(
      `${nomeFile()}.docx`,
      "docx",
      "Documento Word",
      byte,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    messaggio(salvato ? "File Word creato." : "Esportazione annullata.");
  } catch (errore) {
    console.error(errore);
    messaggio("Esportazione non riuscita.");
    await avvisa("Non sono riuscito a creare il file Word.");
  }
}

export async function blobDocx() {
  const docx = await import("docx");
  const vista = costruisciVista(foglio);
  vista.classList.add("fuori-schermo");
  document.body.append(vista);
  try {
    azzeraCommenti();
    await attendiImmagini(vista);
    const children = await blocchiDocx(vista, docx);
    const opzioni = opzioniPagina();
    const sezione = {
      properties: {
        page: {
          size: { width: opzioni.larghezzaTwip, height: opzioni.altezzaTwip },
          margin: {
            top: opzioni.margineSopraTwip,
            right: opzioni.margineDestraTwip,
            bottom: opzioni.margineSottoTwip,
            left: opzioni.margineSinistraTwip,
            header: opzioni.distanzaIntestazioneTwip,
            footer: Math.min(opzioni.margineSottoTwip, millimetriInTwip(10)),
          },
        },
      },
      children,
    };
    const headers = intestazioneDocx(docx);
    const footers = pieDiPagina(opzioni, docx);
    if (headers) sezione.headers = headers;
    if (footers) sezione.footers = footers;
    const opzioniDoc = {
      styles: stiliPerWord(docx),
      numbering: { config: numerazioni(vista, docx) },
      sections: [sezione],
    };
    const commenti = commentiPerWord(docx);
    if (commenti) opzioniDoc.comments = commenti;
    const doc = new docx.Document(opzioniDoc);
    return docx.Packer.toBlob(doc);
  } finally {
    vista.remove();
  }
}

function numerazioni(vista, docx) {
  return [...vista.querySelectorAll("ol")].map((_, indice) => ({
    reference: `elenco-${indice}`,
    levels: [
      {
        level: 0,
        format: docx.LevelFormat.DECIMAL,
        text: "%1.",
        alignment: docx.AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      },
    ],
  }));
}

function millimetriInTwip(millimetri) {
  return Math.round((millimetri * 1440) / 25.4);
}

function intestazioneDocx(docx) {
  const fascia = document.getElementById("intestazione-foglio");
  if (!fascia || !fascia.textContent.trim()) return undefined;
  return { default: new docx.Header({ children: [paragrafoFascia(fascia, docx)] }) };
}

function pieDiPagina(opzioni, docx) {
  const children = [];
  const fascia = document.getElementById("pie-foglio");
  if (fascia && fascia.textContent.trim()) children.push(paragrafoFascia(fascia, docx));
  if (opzioni.numeri) {
    children.push(
      new docx.Paragraph({
        alignment: allineamentoNumero(opzioni.posizione, docx),
        children: [
          new docx.TextRun("Pagina "),
          new docx.TextRun({ children: [docx.PageNumber.CURRENT] }),
          new docx.TextRun(" di "),
          new docx.TextRun({ children: [docx.PageNumber.TOTAL_PAGES] }),
        ],
      }),
    );
  }
  if (!children.length) return undefined;
  return { default: new docx.Footer({ children }) };
}

function paragrafoFascia(fascia, docx) {
  return new docx.Paragraph({
    alignment: allineamento(fascia, docx),
    spacing: { after: 40 },
    children: runsDocx(leggiRun(fascia), docx),
  });
}

function allineamentoNumero(posizione, docx) {
  if (posizione === "sinistra") return docx.AlignmentType.LEFT;
  if (posizione === "destra") return docx.AlignmentType.RIGHT;
  return docx.AlignmentType.CENTER;
}

async function blocchiDocx(vista, docx) {
  segnaPagineEditor(vista);
  const forme = [];
  for (const forma of formeSulFoglio()) {
    const paragrafo = await formaFlottante(forma, docx);
    if (paragrafo) forme.push({ pagina: forma.pagina, paragrafo });
  }
  const acc = [];
  const stato = { elenco: 0 };
  let paginaVista = null;
  const usate = new Set();
  const mettiPagina = (pagina) => {
    forme.forEach((forma, indice) => {
      if (usate.has(indice) || forma.pagina !== pagina) return;
      acc.push(forma.paragrafo);
      usate.add(indice);
    });
  };
  for (const nodo of vista.children) {
    if (nodo.dataset.paginaEditor != null) {
      const pagina = Number(nodo.dataset.paginaEditor);
      if (pagina !== paginaVista) {
        paginaVista = pagina;
        mettiPagina(pagina);
      }
    }
    await aggiungi(nodo, acc, stato, docx);
  }
  forme.forEach((forma, indice) => {
    if (!usate.has(indice)) acc.push(forma.paragrafo);
  });
  if (!acc.length) acc.push(new docx.Paragraph({ children: [new docx.TextRun("")] }));
  return acc;
}

async function aggiungi(nodo, acc, stato, docx) {
  if (nodo.classList.contains("interruzione-stampa")) {
    acc.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
    return;
  }
  if (nodo.classList.contains("tabella-stampa")) {
    acc.push(...tabellaDocx(nodo, docx));
    return;
  }
  if (nodo.classList.contains("immagine-stampa")) {
    acc.push(...(await immagineDocx(nodo, docx)));
    return;
  }
  if (nodo.tagName === "UL" || nodo.tagName === "OL") {
    esportaLista(nodo, acc, stato, docx);
    return;
  }
  acc.push(paragrafoDocx(nodo, docx));
}

function esportaLista(lista, acc, stato, docx) {
  const ordinato = lista.tagName === "OL";
  const reference = ordinato ? `elenco-${stato.elenco}` : null;
  if (ordinato) stato.elenco += 1;
  const voci = [...lista.children].filter((voce) => voce.tagName === "LI");
  for (const voce of voci) {
    const dopo = voce === voci[voci.length - 1] ? spazioDopo(lista) : 0;
    acc.push(paragrafoDocx(voce, docx, { reference, bullet: !ordinato, dopo }));
    voce.querySelectorAll(":scope > ul, :scope > ol").forEach((sub) => esportaLista(sub, acc, stato, docx));
  }
}

function paragrafoDocx(elemento, docx, extra = {}) {
  const opzioni = {
    alignment: allineamento(elemento, docx),
    spacing: { before: extra.dopo === undefined ? spazioSopra(elemento) : 0, after: extra.dopo ?? spazioDopo(elemento), line: interlinea(elemento), lineRule: "auto" },
    children: runsDocx(leggiRun(elemento), docx),
  };
  if (elemento.tagName === "H1") opzioni.heading = docx.HeadingLevel.HEADING_1;
  if (elemento.tagName === "H2") opzioni.heading = docx.HeadingLevel.HEADING_2;
  if (elemento.tagName === "H3") opzioni.heading = docx.HeadingLevel.HEADING_3;
  const stilePersonale = stileWordDi(elemento);
  if (stilePersonale) opzioni.style = stilePersonale;
  if (extra.bullet) opzioni.bullet = { level: 0 };
  if (extra.reference) opzioni.numbering = { reference: extra.reference, level: 0 };
  const rientro = rientriWord(elemento);
  if (rientro) opzioni.indent = rientro;
  const tabulazioni = tabulazioniDocx(elemento, docx);
  if (tabulazioni.length) opzioni.tabStops = tabulazioni;
  return new docx.Paragraph(opzioni);
}

function tabulazioniDocx(elemento, docx) {
  const tipi = {
    sinistra: docx.TabStopType.LEFT,
    centro: docx.TabStopType.CENTER,
    destra: docx.TabStopType.RIGHT,
    decimale: docx.TabStopType.DECIMAL,
  };
  return leggiTabulazioni(elemento).map((punto) => ({
    type: tipi[punto.tipo],
    position: Math.round((punto.pos * 1440) / 25.4),
  }));
}

function tabellaDocx(figura, docx) {
  const proporzione = parseFloat(figura.dataset.scala) || 1;
  const blocchi = [];
  const titolo = figura.querySelector("figcaption")?.textContent?.trim();
  if (titolo) {
    blocchi.push(
      new docx.Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new docx.TextRun({ text: titolo, bold: true, font: "Calibri", size: 22 })],
      }),
    );
  }
  const righeDom = [...figura.querySelectorAll("tbody tr")];
  const percentuali = [...figura.querySelectorAll("colgroup col")].map((col) => {
    const trovato = String(col.style.width).match(/([\d.]+)%/);
    return trovato ? Math.round(Number(trovato[1])) : 0;
  });
  const righe = righeDom.map((tr) => {
    const celleDom = [...tr.children];
    let cursoreColonna = 0;
    const celle = celleDom.map((td) => {
      const spanColonne = td.colSpan || 1;
      const testo = {
        text: td.textContent || "",
        bold: tr.classList.contains("riga-totale") || td.dataset.grassetto === "1",
        italics: td.dataset.corsivo === "1",
        strike: td.dataset.barrato === "1",
        font: td.dataset.font || "Calibri",
        size: td.dataset.dimensione
          ? Math.max(8, Math.round(parseFloat(td.dataset.dimensione) * proporzione * 2))
          : Math.max(8, Math.round(22 * proporzione)),
      };
      if (td.dataset.colore) testo.color = td.dataset.colore.replace("#", "").toUpperCase();
      if (td.dataset.sottolineato) testo.underline = { type: docx.UnderlineType.SINGLE };
      const paragrafo = {
        alignment: allineamentoCella(td, docx),
        children: [new docx.TextRun(testo)],
      };
      if (td.dataset.interlinea) {
        const fattore = parseFloat(td.dataset.interlinea);
        if (fattore) paragrafo.spacing = { line: Math.round(fattore * 240), lineRule: "auto" };
      }
      const opzioniCella = {
        borders: bordiCella(docx, td),
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [new docx.Paragraph(paragrafo)],
      };
      if (spanColonne > 1) opzioniCella.columnSpan = spanColonne;
      if ((td.rowSpan || 1) > 1) opzioniCella.rowSpan = td.rowSpan;
      if (td.dataset.sfondo) {
        opzioniCella.shading = {
          type: docx.ShadingType.CLEAR,
          fill: td.dataset.sfondo.replace("#", "").toUpperCase(),
        };
      }
      const somma = percentuali.slice(cursoreColonna, cursoreColonna + spanColonne).reduce((totale, valore) => totale + valore, 0);
      if (somma) opzioniCella.width = { size: somma, type: docx.WidthType.PERCENTAGE };
      cursoreColonna += spanColonne;
      return new docx.TableCell(opzioniCella);
    });
    const opzioniRiga = { children: celle };
    const altezza = parseFloat(tr.style.height);
    if (altezza) opzioniRiga.height = { value: Math.round(altezza * proporzione * 15), rule: docx.HeightRule.ATLEAST };
    return new docx.TableRow(opzioniRiga);
  });
  if (righe.length) {
    const nessuno = { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const larghezzaTabella = parseFloat(figura.dataset.larghezza);
    const percento = Math.round((larghezzaTabella >= 20 && larghezzaTabella < 99.5 ? larghezzaTabella : 100) * proporzione);
    const posto = figura.dataset.posto === "centro" ? docx.AlignmentType.CENTER : figura.dataset.posto === "destra" ? docx.AlignmentType.RIGHT : docx.AlignmentType.LEFT;
    blocchi.push(
      new docx.Table({
        alignment: posto,
        width: { size: Math.max(20, Math.min(100, percento)), type: docx.WidthType.PERCENTAGE },
        borders: {
          top: nessuno,
          bottom: nessuno,
          left: nessuno,
          right: nessuno,
          insideHorizontal: nessuno,
          insideVertical: nessuno,
        },
        rows: righe,
      }),
    );
  }
  return blocchi;
}

async function formaFlottante(forma, docx) {
  try {
    const dati = await pngForma(forma.figura);
    let larghezza = Math.round(parseFloat(forma.figura.dataset.larghezza) || 180);
    let altezza = Math.round(parseFloat(forma.figura.dataset.altezza) || 100);
    const scala = Math.min(1, 620 / larghezza, 780 / altezza);
    larghezza = Math.max(20, Math.round(larghezza * scala));
    altezza = Math.max(16, Math.round(altezza * scala));
    const angolo = Math.round(Number(forma.figura.dataset.angolo) || 0);
    return new docx.Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new docx.ImageRun({
          type: "png",
          data: dati,
          transformation: { width: larghezza, height: altezza, rotation: angolo || undefined },
          floating: {
            horizontalPosition: {
              relative: docx.HorizontalPositionRelativeFrom.PAGE,
              offset: Math.round(forma.x * 9525),
            },
            verticalPosition: {
              relative: docx.VerticalPositionRelativeFrom.PAGE,
              offset: Math.round(forma.y * 9525),
            },
            allowOverlap: true,
            behindDocument: Boolean(forma.dietro),
            wrap: { type: docx.TextWrappingType.NONE },
            zIndex: forma.piano,
          },
        }),
      ],
    });
  } catch (errore) {
    console.error(errore);
    return null;
  }
}

async function immagineDocx(figura, docx) {
  const img = figura.querySelector("img");
  const blocchi = [];
  if (img?.src) {
    try {
      const dati = await pngDi(img);
      const rettangolo = img.getBoundingClientRect();
      const zoom = foglio.contains(img) ? zoomPagina() : 1;
      let larghezza = Math.round(rettangolo.width / zoom) || 400;
      let altezza = Math.round(rettangolo.height / zoom) || 300;
      const scala = Math.min(1, 620 / larghezza, 780 / altezza);
      larghezza = Math.max(20, Math.round(larghezza * scala));
      altezza = Math.max(20, Math.round(altezza * scala));
      const corsa = {
        type: "png",
        data: dati,
        transformation: { width: larghezza, height: altezza },
      };
      const modo = figura.dataset.allinea || "sinistra";
      if (modo === "libera") {
        corsa.floating = {
          horizontalPosition: {
            relative: docx.HorizontalPositionRelativeFrom.COLUMN,
            offset: Math.round(parseFloat(figura.dataset.x || "0") * 9525),
          },
          verticalPosition: {
            relative: docx.VerticalPositionRelativeFrom.PARAGRAPH,
            offset: Math.round(parseFloat(figura.dataset.y || "0") * 9525),
          },
          allowOverlap: true,
          wrap: { type: docx.TextWrappingType.NONE },
          zIndex: Number(figura.dataset.piano) || 10,
        };
      }
      const allineamento = modo === "destra" ? docx.AlignmentType.RIGHT : modo === "centro" ? docx.AlignmentType.CENTER : docx.AlignmentType.LEFT;
      blocchi.push(
        new docx.Paragraph({
          alignment: allineamento,
          spacing: { before: 120, after: 80 },
          children: [new docx.ImageRun(corsa)],
        }),
      );
    } catch (errore) {
      console.error(errore);
    }
  }
  const didascalia = figura.querySelector("figcaption")?.textContent?.trim();
  if (didascalia) {
    const modoDidascalia = figura.dataset.allinea || "sinistra";
    const allineaDidascalia = modoDidascalia === "destra" ? docx.AlignmentType.RIGHT : modoDidascalia === "centro" ? docx.AlignmentType.CENTER : docx.AlignmentType.LEFT;
    blocchi.push(
      new docx.Paragraph({
        alignment: allineaDidascalia,
        spacing: { after: 160 },
        children: [new docx.TextRun({ text: didascalia, italics: true, font: "Calibri", size: 20 })],
      }),
    );
  }
  return blocchi;
}

function pngDi(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width || 1;
  canvas.height = img.naturalHeight || img.height || 1;
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("png"));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

let commentiWord = [];
const idCommento = new Map();

function azzeraCommenti() {
  commentiWord = [];
  idCommento.clear();
}

function idDelCommento(elemento) {
  const span = elemento?.closest?.(".commento");
  const testo = span?.dataset.commento?.trim();
  if (!testo) return null;
  if (idCommento.has(span)) return idCommento.get(span);
  const id = commentiWord.length;
  commentiWord.push({ id, testo });
  idCommento.set(span, id);
  return id;
}

function commentiPerWord(docx) {
  if (!commentiWord.length) return null;
  return {
    children: commentiWord.map((commento) => new docx.Comment({
      id: commento.id,
      author: "Lord",
      initials: "L",
      date: new Date(),
      children: [new docx.Paragraph({ children: [new docx.TextRun(commento.testo)] })],
    })),
  };
}

function leggiRun(elemento) {
  const runs = [];
  function visita(nodo, collegamento) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      const testo = nodo.textContent.replace(/\u200B/g, "").replace(/\u00A0/g, " ");
      if (testo) runs.push({ testo, stile: stileDi(nodo.parentElement), collegamento, commentoId: idDelCommento(nodo.parentElement) });
      return;
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;
    if (nodo.tagName === "UL" || nodo.tagName === "OL") return;
    if (nodo.classList.contains("tabulazione")) {
      runs.push({ tabulazione: true, collegamento, commentoId: idDelCommento(nodo) });
      return;
    }
    if (nodo.tagName === "BR") {
      runs.push({ interruzione: true, collegamento, commentoId: idDelCommento(nodo) });
      return;
    }
    const indirizzo = nodo.tagName === "A" && /^(https?:\/\/|mailto:)/i.test(nodo.getAttribute("href") || "") ? nodo.getAttribute("href") : collegamento;
    nodo.childNodes.forEach((figlio) => visita(figlio, indirizzo));
  }
  visita(elemento, null);
  return runs;
}

// I pezzi di testo uno dopo l'altro con lo stesso indirizzo diventano un solo collegamento di Word.
function runsDocx(runs, docx) {
  if (!runs.length) return [new docx.TextRun({ text: "", font: "Calibri", size: 24 })];
  const risultato = [];
  let gruppo = null;
  let aperto = null;

  const chiudiGruppo = () => {
    if (!gruppo) return;
    risultato.push(new docx.ExternalHyperlink(gruppo));
    gruppo = null;
  };
  const apriCommento = (id) => {
    if (id === aperto) return;
    chiudiGruppo();
    if (aperto != null) {
      risultato.push(new docx.CommentRangeEnd(aperto));
      risultato.push(new docx.CommentReference(aperto));
      aperto = null;
    }
    if (id == null) return;
    risultato.push(new docx.CommentRangeStart(id));
    aperto = id;
  };

  for (const run of runs) {
    apriCommento(run.commentoId ?? null);
    const pezzo = runDocx(run, docx);
    if (!run.collegamento) {
      chiudiGruppo();
      risultato.push(pezzo);
      continue;
    }
    if (!gruppo || gruppo.link !== run.collegamento) {
      chiudiGruppo();
      gruppo = { link: run.collegamento, children: [] };
    }
    gruppo.children.push(pezzo);
  }
  chiudiGruppo();
  apriCommento(null);
  return risultato;
}

function runDocx(run, docx) {
  if (run.interruzione) return new docx.TextRun({ break: 1 });
  if (run.tabulazione) return new docx.TextRun({ children: [new docx.Tab()] });
  const opzioni = {
    text: run.testo,
    bold: run.stile.grassetto,
    italics: run.stile.corsivo,
    strike: run.stile.barrato,
    size: Math.max(8, Math.round(run.stile.punti * 2)),
    font: run.stile.font || "Calibri",
    color: run.stile.colore,
  };
  if (run.stile.sottolineato || run.collegamento) opzioni.underline = { type: docx.UnderlineType.SINGLE };
  if (run.stile.sfondo) opzioni.shading = { type: docx.ShadingType.CLEAR, fill: run.stile.sfondo };
  return new docx.TextRun(opzioni);
}

function stileDi(elemento) {
  const stile = getComputedStyle(elemento);
  const decorazione = `${stile.textDecorationLine || ""} ${stile.textDecoration || ""}`;
  return {
    grassetto: Number(stile.fontWeight) >= 600 || stile.fontWeight === "bold",
    corsivo: stile.fontStyle === "italic",
    sottolineato: decorazione.includes("underline"),
    barrato: decorazione.includes("line-through"),
    punti: (parseFloat(stile.fontSize) || 16) * 0.75,
    font: stile.fontFamily.split(",")[0].replace(/['"]/g, "").trim() || "Calibri",
    colore: coloreHex(stile.color),
    sfondo: sfondoHex(stile.backgroundColor),
  };
}

function allineamentoCella(td, docx) {
  if (td.classList.contains("allinea-centro")) return docx.AlignmentType.CENTER;
  if (td.classList.contains("allinea-destra")) return docx.AlignmentType.RIGHT;
  if (td.classList.contains("allinea-sinistra")) return docx.AlignmentType.LEFT;
  if (td.classList.contains("cella-numero")) return docx.AlignmentType.RIGHT;
  return docx.AlignmentType.LEFT;
}

function allineamento(elemento, docx) {
  const valore = getComputedStyle(elemento).textAlign;
  if (valore === "center") return docx.AlignmentType.CENTER;
  if (valore === "right" || valore === "end") return docx.AlignmentType.RIGHT;
  if (valore === "justify") return docx.AlignmentType.JUSTIFIED;
  return docx.AlignmentType.LEFT;
}

// Spazio sotto il paragrafo in ventesimi di punto (l'unità di Word): 1 px = 15.
function spazioDopo(elemento) {
  const pixel = parseFloat(getComputedStyle(elemento).marginBottom);
  return Number.isFinite(pixel) ? Math.round(pixel * 15) : 160;
}

// Nel browser lo spazio sotto il blocco precedente e quello sopra questo si sovrappongono
// (vale il più grande); in Word si sommano. Quindi a Word si passa solo la parte che manca.
function spazioSopra(elemento) {
  const sopra = parseFloat(getComputedStyle(elemento).marginTop) || 0;
  const precedente = elemento.previousElementSibling;
  const giaSotto = precedente ? parseFloat(getComputedStyle(precedente).marginBottom) || 0 : 0;
  return Math.round(Math.max(0, sopra - giaSotto) * 15);
}

function interlinea(elemento) {
  const stile = getComputedStyle(elemento);
  const fontPx = parseFloat(stile.fontSize) || 16;
  if (stile.lineHeight === "normal") return 276;
  const linePx = parseFloat(stile.lineHeight);
  if (!linePx) return 276;
  return Math.max(240, Math.round((linePx / fontPx) * 240));
}

function bordiCella(docx, td) {
  const linea = { style: docx.BorderStyle.SINGLE, size: 4, color: "1C1915" };
  const vuoto = { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const lati = latiDaClassi(td);
  return {
    top: lati.su ? { ...linea } : { ...vuoto },
    bottom: lati.giu ? { ...linea } : { ...vuoto },
    left: lati.sx ? { ...linea } : { ...vuoto },
    right: lati.dx ? { ...linea } : { ...vuoto },
  };
}

function coloreHex(colore) {
  const trovato = String(colore).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!trovato) return "1C1915";
  return [trovato[1], trovato[2], trovato[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function sfondoHex(colore) {
  const trovato = String(colore).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!trovato) return null;
  if (trovato[4] != null && Number(trovato[4]) === 0) return null;
  const hex = [trovato[1], trovato[2], trovato[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  if (hex === "FFFFFF" || hex === "FFFDF8") return null;
  return hex;
}
