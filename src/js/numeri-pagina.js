// Le icone dei numeri di pagina nella barra. La tendina della posizione resta nascosta:
// è quella che il salvataggio e l'anteprima leggono, le icone la cambiano e la mostrano.

export function avviaNumeriPagina() {
  const tendina = document.getElementById("posizione-numero");
  document.querySelectorAll(".posizione-numeri [data-posizione]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      if (tendina.value === bottone.dataset.posizione) return;
      tendina.value = bottone.dataset.posizione;
      tendina.dispatchEvent(new Event("change", { bubbles: true }));
      aggiornaPosizioneNumero();
    });
  });
  aggiornaPosizioneNumero();
}

// Da chiamare anche quando la posizione cambia da programma (nuova relazione, file aperto).
export function aggiornaPosizioneNumero() {
  const valore = document.getElementById("posizione-numero").value;
  document.querySelectorAll(".posizione-numeri [data-posizione]").forEach((bottone) => {
    const scelto = bottone.dataset.posizione === valore;
    bottone.classList.toggle("premuto", scelto);
    bottone.setAttribute("aria-pressed", String(scelto));
  });
}
