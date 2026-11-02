import { addDaysToDate, daysBetweenDates } from '../model/time';

export interface DueChoice {
  icon: string;
  label: string;
  /** Giorni da oggi; null = nessuna scadenza. */
  days: number | null;
}

// Richiesta dell'utente (2026-11-02): scadenza predefinita +1 giorno, scelta a icone grandi.
export const DUE_CHOICES: readonly DueChoice[] = [
  { icon: '📌', label: 'Oggi', days: 0 },
  { icon: '➡️', label: 'Domani', days: 1 },
  { icon: '⏩', label: 'Dopodomani', days: 2 },
  // 7️⃣ e non 📅: l'emoji del calendario mostra una data fissa ("JUL 17") che confonde.
  { icon: '7️⃣', label: 'Tra una settimana', days: 7 },
  { icon: '🚫', label: 'Nessuna', days: null },
];

export const DEFAULT_DUE_DAYS = 1;
export const DUE_PICKER_TIMEOUT_SECONDS = 30;

export function dueDateForChoice(today: string, days: number | null): string | null {
  return days === null ? null : addDaysToDate(today, days);
}

export interface DuePickerOptions {
  title: string;
  today: string;
  /**
   * Scelta evidenziata e mantenuta se il tempo scade (giorni da oggi; null = "Nessuna").
   * undefined se la scadenza attuale non corrisponde a nessuna scelta.
   */
  highlightedDays: number | null | undefined;
  /** Chiamata solo se l'utente sceglie; allo scadere del tempo non cambia nulla. */
  onChoose: (dueDate: string | null) => void;
}

/** Selettore della scadenza a tutto schermo, con pulsanti grandi; si chiude da solo dopo 30 secondi. */
export function showDuePicker(options: DuePickerOptions): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'due-picker';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const title = document.createElement('h2');
  title.textContent = options.title;
  const countdown = document.createElement('p');
  countdown.className = 'due-countdown';
  const grid = document.createElement('div');
  grid.className = 'due-grid';
  overlay.append(title, grid, countdown);

  let remaining = DUE_PICKER_TIMEOUT_SECONDS;
  const close = () => {
    window.clearInterval(timer);
    overlay.remove();
  };
  const highlighted =
    options.highlightedDays === undefined ? undefined : DUE_CHOICES.find((choice) => choice.days === options.highlightedDays);
  const renderCountdown = () => {
    countdown.textContent = `Senza scelta resta "${highlighted?.label ?? 'invariata'}" tra ${remaining} s`;
  };

  for (const choice of DUE_CHOICES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'due-choice';
    button.classList.toggle('highlighted', choice === highlighted);
    const icon = document.createElement('span');
    icon.className = 'due-icon';
    icon.textContent = choice.icon;
    const label = document.createElement('span');
    label.textContent = choice.label;
    button.append(icon, label);
    button.addEventListener('click', () => {
      close();
      options.onChoose(dueDateForChoice(options.today, choice.days));
    });
    grid.append(button);
  }

  const timer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      close();
      return;
    }
    renderCountdown();
  }, 1_000);
  renderCountdown();
  document.body.append(overlay);
  return close;
}

/** Giorni della scadenza attuale da oggi, se corrisponde a una scelta del selettore (per evidenziarla). */
export function highlightedDaysFor(today: string, dueDate: string | null): number | null | undefined {
  if (dueDate === null) {
    return null;
  }
  const days = daysBetweenDates(today, dueDate);
  return DUE_CHOICES.some((choice) => choice.days === days) ? days : undefined;
}
