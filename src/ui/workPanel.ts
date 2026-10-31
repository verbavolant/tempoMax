import { formatHoursMinutes } from '../model/time';
import type { WorkSession, WorkSessionView } from '../work/workSession';
import { requireElement } from './dom';

// Il riquadro mostra ore e minuti: aggiornarlo ogni 15 secondi basta.
const REFRESH_MS = 15_000;

function describe(view: WorkSessionView, now: number): string {
  const today = `oggi ${formatHoursMinutes(view.todayMilliseconds)}`;
  if (view.currentPeriod) {
    return `Al lavoro da ${formatHoursMinutes(now - Date.parse(view.currentPeriod.start))} · ${today}`;
  }
  return view.periodsToday > 0 ? `In pausa · ${today}` : 'Lavoro non iniziato';
}

/** Pulsanti "Inizio lavoro" / "Fine lavoro" con il riepilogo del giorno; restituisce la funzione che lo smonta. */
export function mountWorkPanel(container: HTMLElement, work: WorkSession): () => void {
  container.innerHTML = `
    <div class="work-panel">
      <div class="work-buttons">
        <button id="work-start" type="button" class="work-button work-start">▶ Inizio lavoro</button>
        <button id="work-stop" type="button" class="work-button work-stop">⏸ Fine lavoro</button>
      </div>
      <p id="work-status" class="work-status" role="status"></p>
    </div>
  `;
  const startButton = requireElement<HTMLButtonElement>(container, '#work-start');
  const stopButton = requireElement<HTMLButtonElement>(container, '#work-stop');
  const status = requireElement<HTMLParagraphElement>(container, '#work-status');

  const render = (view: WorkSessionView) => {
    const working = view.currentPeriod !== null;
    // Solo il pulsante sensato è attivo: niente doppio inizio o fine senza inizio.
    startButton.disabled = working;
    stopButton.disabled = !working;
    const pending = view.unsyncedCount > 0 ? `orari da salvare su Drive: ${view.unsyncedCount}` : '';
    status.textContent = [describe(view, Date.now()), view.notice, pending].filter(Boolean).join(' · ');
  };

  // start()/stop() chiedono il token in modo sincrono, dentro il tocco.
  startButton.addEventListener('click', () => void work.start());
  stopButton.addEventListener('click', () => void work.stop());

  const unsubscribe = work.subscribe(render);
  const timer = window.setInterval(() => render(work.view()), REFRESH_MS);
  render(work.view());

  return () => {
    unsubscribe();
    window.clearInterval(timer);
  };
}
