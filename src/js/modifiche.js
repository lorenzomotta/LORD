// Dice al resto dell'app che la relazione è cambiata.

export function segnaModifica() {
  document.dispatchEvent(new CustomEvent("relazione-modificata"));
}

export function messaggio(testo) {
  const el = document.getElementById("stato");
  if (el) el.textContent = testo;
}
