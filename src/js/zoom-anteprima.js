// Zoom dell'anteprima con Ctrl + rotellina, oltre che con la tendina Zoom.
// Lo zoom scelto resta uguale anche quando si riapre l'anteprima.

const MINIMO = 0.3;
const MASSIMO = 2;
const PASSO = 0.1;

let livello = 0.85;

export function avviaZoomAnteprima(pila, tendina) {
  applica(pila, tendina, livello);

  tendina.addEventListener("change", () => applica(pila, tendina, Number(tendina.value)));

  pila.addEventListener("wheel", (evento) => {
    if (!evento.ctrlKey) return;
    evento.preventDefault();
    const nuovo = livello + (evento.deltaY < 0 ? PASSO : -PASSO);
    applica(pila, tendina, nuovo, evento.clientY);
  }, { passive: false });
}

// Il punto della pagina sotto il mouse resta sotto il mouse anche dopo lo zoom.
function applica(pila, tendina, valore, mouseY) {
  const nuovo = Math.round(Math.min(MASSIMO, Math.max(MINIMO, valore)) * 100) / 100;
  const vecchio = Number(pila.style.zoom) || 1;
  // Le misure della pila sono anch'esse "zoomate": il suo bordo alto si prende dalla barra sopra.
  const alto = pila.previousElementSibling?.getBoundingClientRect().bottom ?? 0;
  const dentro = mouseY === undefined ? (pila.clientHeight * vecchio) / 2 : mouseY - alto;
  const punto = pila.scrollTop + dentro / vecchio;

  livello = nuovo;
  pila.style.zoom = String(nuovo);
  pila.scrollTop = punto - dentro / nuovo;
  mostraNellaTendina(tendina, nuovo);
}

// Se il valore non c'è tra le voci (per esempio 95%), si aggiunge al posto giusto.
function mostraNellaTendina(tendina, valore) {
  const testo = String(valore);
  const voci = [...tendina.options];
  if (!voci.some((voce) => Number(voce.value) === valore)) {
    const nuova = new Option(`${Math.round(valore * 100)}%`, testo);
    tendina.insertBefore(nuova, voci.find((voce) => Number(voce.value) > valore) || null);
  }
  tendina.value = [...tendina.options].find((voce) => Number(voce.value) === valore).value;
}
