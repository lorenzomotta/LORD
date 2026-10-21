// Zoom della pagina con Ctrl + rotellina (solo il foglio, non le barre).

const MINIMO = 0.5;
const MASSIMO = 2;
const PASSO = 0.1;
const CHIAVE = "relaziolore-zoom";

let livello = 1;

// Quanti pixel dello schermo vale un pixel della pagina. Serve a chi trascina col mouse.
export function zoomPagina() {
  const cornice = document.getElementById("cornice-foglio");
  const larghezza = cornice?.offsetWidth;
  if (!larghezza) return 1;
  return cornice.getBoundingClientRect().width / larghezza || 1;
}

export function avviaZoomPagina() {
  const scrivania = document.getElementById("scrivania");
  applica(leggiSalvato());
  new ResizeObserver(aggiornaContenitore).observe(document.getElementById("cornice-foglio"));

  scrivania.addEventListener("wheel", (evento) => {
    if (!evento.ctrlKey) return;
    evento.preventDefault();
    const quanto = Math.abs(evento.deltaY) >= 50 ? PASSO : Math.abs(evento.deltaY) / 500;
    cambia(livello + (evento.deltaY < 0 ? quanto : -quanto), evento.clientX, evento.clientY);
  }, { passive: false });

  document.addEventListener("keydown", (evento) => {
    if (!(evento.ctrlKey || evento.metaKey) || evento.altKey) return;
    if (evento.key === "0") cambia(1);
    else if (evento.key === "+" || evento.key === "=") cambia(livello + PASSO);
    else if (evento.key === "-") cambia(livello - PASSO);
    else return;
    evento.preventDefault();
  });

  document.getElementById("zoom-meno").addEventListener("click", () => cambia(livello - PASSO));
  document.getElementById("zoom-piu").addEventListener("click", () => cambia(livello + PASSO));
  document.getElementById("zoom-valore").addEventListener("click", () => cambia(1));
}

function cambia(nuovo, x, y) {
  const scrivania = document.getElementById("scrivania");
  const valore = Math.round(Math.min(MASSIMO, Math.max(MINIMO, nuovo)) * 100) / 100;
  if (valore === livello) return;
  const box = scrivania.getBoundingClientRect();
  const puntoX = (x ?? box.left + box.width / 2) - box.left;
  const puntoY = (y ?? box.top + box.height / 2) - box.top;
  const rapporto = valore / livello;
  const sottoX = scrivania.scrollLeft + puntoX;
  const sottoY = scrivania.scrollTop + puntoY;
  applica(valore);
  scrivania.scrollLeft = sottoX * rapporto - puntoX;
  scrivania.scrollTop = sottoY * rapporto - puntoY;
}

// Si usa transform e non la proprietà CSS zoom: con zoom alcune versioni del motore
// danno misure non ingrandite, e i trascinamenti col mouse andrebbero fuori posto.
function applica(valore) {
  livello = valore;
  const cornice = document.getElementById("cornice-foglio");
  const contenitore = document.getElementById("zoom-contenitore");
  const zoomata = valore !== 1;
  contenitore.classList.toggle("zoomata", zoomata);
  cornice.style.transform = zoomata ? `scale(${valore})` : "";
  aggiornaContenitore();
  document.getElementById("zoom-valore").textContent = `${Math.round(valore * 100)}%`;
  document.dispatchEvent(new CustomEvent("zoom-pagina"));
  try {
    localStorage.setItem(CHIAVE, String(valore));
  } catch {
    // Se il salvataggio non è permesso, lo zoom vale solo fino alla chiusura.
  }
}

// Il contenitore occupa lo spazio della pagina ingrandita, così le barre di scorrimento sono giuste.
function aggiornaContenitore() {
  const cornice = document.getElementById("cornice-foglio");
  const contenitore = document.getElementById("zoom-contenitore");
  if (livello === 1) {
    contenitore.style.width = "";
    contenitore.style.height = "";
    return;
  }
  contenitore.style.width = `${Math.ceil(cornice.offsetWidth * livello)}px`;
  contenitore.style.height = `${Math.ceil(cornice.offsetHeight * livello)}px`;
}

function leggiSalvato() {
  try {
    const numero = Number(localStorage.getItem(CHIAVE));
    if (numero >= MINIMO && numero <= MASSIMO) return numero;
  } catch {
    // Nessun salvataggio disponibile.
  }
  return 1;
}
