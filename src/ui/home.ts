import { formatElapsed } from '../model/time';
import type { VisitSession, VisitSessionView } from '../visits/visitSession';
import { requireElement } from './dom';

// Un secondo tap involontario subito dopo il primo chiuderebbe la visita appena aperta.
const DOUBLE_TAP_GUARD_MS = 2_000;

/** Monta la schermata principale; restituisce la funzione che la smonta (ferma il timer). */
export function mountHomeScreen(container: HTMLElement, session: VisitSession, onOpenClients: () => void): () => void {
  container.innerHTML = `
    <section class="home">
      <button id="visit-toggle" type="button" class="big-button">
        <span class="big-button-label"></span>
        <span class="big-button-elapsed"></span>
      </button>
      <p id="visit-client" class="home-client"></p>
      <p id="visit-notice" class="home-notice" role="status"></p>
      <button id="open-clients" type="button" class="link-button">Clienti ›</button>
    </section>
  `;

  const toggleButton = requireElement<HTMLButtonElement>(container, '#visit-toggle');
  const label = requireElement<HTMLSpanElement>(toggleButton, '.big-button-label');
  const elapsed = requireElement<HTMLSpanElement>(toggleButton, '.big-button-elapsed');
  const clientText = requireElement<HTMLParagraphElement>(container, '#visit-client');
  const noticeText = requireElement<HTMLParagraphElement>(container, '#visit-notice');

  const render = (view: VisitSessionView) => {
    const open = view.openVisit;
    toggleButton.classList.toggle('running', open !== null);
    label.textContent = open ? 'FINE' : 'INIZIA';
    elapsed.textContent = open ? formatElapsed(Date.now() - Date.parse(open.checkIn.at)) : '';
    clientText.textContent = open ? (view.clientName ?? '') : '';
    const pending = view.unsyncedCount > 0 ? `Visite da salvare su Drive: ${view.unsyncedCount}` : '';
    noticeText.textContent = [view.notice, pending].filter(Boolean).join(' · ');
  };

  const unsubscribe = session.subscribe(render);
  const timer = window.setInterval(() => render(session.view()), 1_000);
  render(session.view());

  toggleButton.addEventListener('click', () => {
    toggleButton.disabled = true;
    window.setTimeout(() => {
      toggleButton.disabled = false;
    }, DOUBLE_TAP_GUARD_MS);
    try {
      void session.toggle();
    } catch (error) {
      noticeText.textContent = error instanceof Error ? error.message : String(error);
    }
  });
  requireElement<HTMLButtonElement>(container, '#open-clients').addEventListener('click', onOpenClients);

  return () => {
    unsubscribe();
    window.clearInterval(timer);
  };
}
