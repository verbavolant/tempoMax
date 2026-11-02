import { AudioRecording } from '../audio/recorder';
import { formatElapsed, formatLocalIsoDateTime } from '../model/time';
import type { MeasuredPosition } from '../model/position';
import type { AudioNote, Visit } from '../model/visit';
import type { AudioStore } from '../storage/audioStore';
import type { TaskSession } from '../tasks/taskSession';
import type { VisitSession, VisitSessionView } from '../visits/visitSession';
import type { WorkSession } from '../work/workSession';
import { mountWorkPanel } from './workPanel';
import { errorMessage, requireElement } from './dom';
import { DEFAULT_DUE_DAYS, dueDateForChoice, showDuePicker } from './duePicker';

// Un secondo tap involontario subito dopo il primo chiuderebbe la visita appena aperta.
const DOUBLE_TAP_GUARD_MS = 2_000;

interface ActiveRecording {
  /** Nota vocale (della visita o libera) oppure attività "da fare" (T-034). */
  purpose: 'note' | 'todo';
  /** Visita in corso all'inizio; null per una nota libera o un "da fare" fuori visita. */
  visitId: string | null;
  clientId: string | null;
  /** Lettura GPS avviata all'inizio della registrazione (T-033). */
  position: Promise<MeasuredPosition | null>;
  recording: AudioRecording;
  startedAt: string;
}

/** Monta la schermata principale; restituisce la funzione che la smonta (ferma timer e registrazione). */
export function mountHomeScreen(
  container: HTMLElement,
  session: VisitSession,
  work: WorkSession,
  tasks: TaskSession,
  audioStore: AudioStore,
  navigation: { openClients: () => void; openVisits: () => void; openNotes: () => void; openOptions: () => void },
): () => void {
  container.innerHTML = `
    <section class="home">
      <button id="device-banner" type="button" class="device-banner" hidden>📱 Dai un nome a questo telefono</button>
      <div id="work-panel-slot"></div>
      <button id="visit-toggle" type="button" class="big-button">
        <span class="big-button-label"></span>
        <span class="big-button-elapsed"></span>
      </button>
      <p id="visit-client" class="home-client"></p>
      <div id="audio-panel" class="audio-panel">
        <button id="audio-toggle" type="button" class="secondary-button"></button>
        <button id="todo-toggle" type="button" class="secondary-button"></button>
        <ul id="audio-list" class="audio-list"></ul>
        <p id="audio-message" class="home-notice" role="status"></p>
      </div>
      <p id="visit-notice" class="home-notice" role="status"></p>
      <nav class="home-nav">
        <button id="open-clients" type="button" class="nav-button"><span>👥</span>Clienti</button>
        <button id="open-visits" type="button" class="nav-button"><span>🕘</span>Visite</button>
        <button id="open-notes" type="button" class="nav-button"><span>🎧</span>Note</button>
        <button id="open-options" type="button" class="nav-button"><span>⚙️</span>Opzioni</button>
      </nav>
    </section>
  `;

  const unmountWorkPanel = mountWorkPanel(requireElement<HTMLDivElement>(container, '#work-panel-slot'), work);
  const toggleButton = requireElement<HTMLButtonElement>(container, '#visit-toggle');
  const label = requireElement<HTMLSpanElement>(toggleButton, '.big-button-label');
  const elapsed = requireElement<HTMLSpanElement>(toggleButton, '.big-button-elapsed');
  const clientText = requireElement<HTMLParagraphElement>(container, '#visit-client');
  const noticeText = requireElement<HTMLParagraphElement>(container, '#visit-notice');
  const audioButton = requireElement<HTMLButtonElement>(container, '#audio-toggle');
  const todoButton = requireElement<HTMLButtonElement>(container, '#todo-toggle');
  const audioList = requireElement<HTMLUListElement>(container, '#audio-list');
  const audioMessage = requireElement<HTMLParagraphElement>(container, '#audio-message');

  let active: ActiveRecording | null = null;
  let audioBusy = false;
  let player: HTMLAudioElement | null = null;
  let renderedAudioKey = '';
  let closeDuePicker: (() => void) | null = null;

  const renderClock = (view: VisitSessionView) => {
    const open = view.openVisit;
    elapsed.textContent = open ? formatElapsed(Date.now() - Date.parse(open.checkIn.at)) : '';
    const stopLabel = active ? `⏹ Ferma · ${formatElapsed(active.recording.elapsedSeconds() * 1000)}` : '';
    // Una registrazione alla volta: il pulsante in uso diventa "Ferma", l'altro si disattiva.
    audioButton.textContent = active?.purpose === 'note' ? stopLabel : '🎤 Nota vocale';
    audioButton.classList.toggle('recording', active?.purpose === 'note');
    audioButton.disabled = audioBusy || active?.purpose === 'todo';
    todoButton.textContent = active?.purpose === 'todo' ? stopLabel : '✅ Da fare';
    todoButton.classList.toggle('recording', active?.purpose === 'todo');
    todoButton.disabled = audioBusy || active?.purpose === 'note';
  };

  const playNote = async (note: AudioNote) => {
    player?.pause();
    const audio = await audioStore.get(note.id);
    if (!audio) {
      // Dopo il caricamento la copia locale viene eliminata: la nota si ascolta da Drive.
      if (note.driveLink) {
        window.open(note.driveLink, '_blank', 'noopener');
      } else {
        audioMessage.textContent = 'File audio non presente sul telefono';
      }
      return;
    }
    const url = URL.createObjectURL(audio);
    player = new Audio(url);
    player.addEventListener('ended', () => URL.revokeObjectURL(url));
    await player.play();
  };

  const deleteNote = async (visit: Visit, note: AudioNote) => {
    if (!window.confirm('Eliminare questa nota vocale?')) {
      return;
    }
    session.removeAudio(visit.id, note.id);
    await audioStore.delete(note.id);
  };

  // L'elenco si ridisegna solo quando cambia: ricrearlo a ogni secondo farebbe perdere i tocchi.
  const renderAudioList = (open: Visit | null) => {
    const notes = open?.audio ?? [];
    const key = notes.map((note) => note.id).join(',');
    if (key === renderedAudioKey) {
      return;
    }
    renderedAudioKey = key;
    audioList.replaceChildren(
      ...notes.map((note, index) => {
        const item = document.createElement('li');
        const description = document.createElement('span');
        description.textContent = `🎧 Nota ${index + 1} · ${formatElapsed(note.durationSeconds * 1000)}`;
        const play = document.createElement('button');
        play.type = 'button';
        play.textContent = '▶';
        play.setAttribute('aria-label', `Ascolta la nota ${index + 1}`);
        play.addEventListener('click', () => {
          playNote(note).catch((error: unknown) => {
            audioMessage.textContent = errorMessage(error);
          });
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '🗑';
        remove.setAttribute('aria-label', `Elimina la nota ${index + 1}`);
        remove.addEventListener('click', () => {
          if (open) {
            deleteNote(open, note).catch((error: unknown) => {
              audioMessage.textContent = errorMessage(error);
            });
          }
        });
        item.append(description, play, remove);
        return item;
      }),
    );
  };

  const render = (view: VisitSessionView) => {
    const open = view.openVisit;
    toggleButton.classList.toggle('running', open !== null);
    label.textContent = open ? 'FINE' : 'INIZIA';
    clientText.textContent = open ? (view.clientName ?? '') : '';
    renderAudioList(open);
    const pending = view.unsyncedCount > 0 ? `Visite da salvare su Drive: ${view.unsyncedCount}` : '';
    noticeText.textContent = [view.notice, pending].filter(Boolean).join(' · ');
    renderClock(view);
  };

  const finishRecording = async (completionMessage = '') => {
    const current = active;
    if (!current) {
      return;
    }
    active = null;
    audioBusy = true;
    render(session.view());
    let savedNoteId: string | null = null;
    let savedTaskId: string | null = null;
    try {
      const { audio, durationSeconds } = await current.recording.stop();
      const note: AudioNote = {
        id: crypto.randomUUID(),
        recordedAt: current.startedAt,
        mimeType: audio.type,
        durationSeconds,
        driveFileId: null,
        driveLink: null,
        device: session.currentDeviceName(),
        position: null,
      };
      // Prima il file sul telefono, poi il riferimento: mai un riferimento senza file.
      await audioStore.put(note.id, audio);
      if (current.purpose === 'todo') {
        // Salvato subito con la scadenza predefinita: se il selettore scade o l'app si chiude, non si perde.
        const today = tasks.today();
        const task = tasks.addVoiceTask({
          audio: note,
          dueDate: dueDateForChoice(today, DEFAULT_DUE_DAYS),
          visitId: current.visitId,
          clientId: current.clientId,
        });
        savedTaskId = task.id;
        audioMessage.textContent = completionMessage || 'Da fare salvato.';
        closeDuePicker = showDuePicker({
          title: 'Scadenza del "da fare"?',
          today,
          highlightedDays: DEFAULT_DUE_DAYS,
          // Il tocco sulla scelta avvia anche il salvataggio su Drive (token nel gesto).
          onChoose: (dueDate) => void tasks.setDueDate(task.id, dueDate),
        });
      } else {
        if (current.visitId) {
          session.addAudio(current.visitId, note);
        } else {
          session.addFreeNote(note);
        }
        savedNoteId = note.id;
        audioMessage.textContent = completionMessage || (current.visitId ? '' : 'Nota libera salvata.');
      }
    } catch (error) {
      audioMessage.textContent = `Nota non salvata: ${errorMessage(error)}`;
    } finally {
      audioBusy = false;
      render(session.view());
    }
    // La nota è già salvata; la posizione si aggiunge quando il GPS risponde. Chi attende questa promessa
    // (il salvataggio su Drive) parte così con la posizione inclusa.
    const position = await current.position;
    if (position && savedNoteId) {
      session.setNotePosition(savedNoteId, position);
    }
    if (position && savedTaskId) {
      tasks.setAudioPosition(savedTaskId, position);
    }
  };

  /** Ferma la registrazione e avvia il salvataggio su Drive giusto; da chiamare nel tocco. */
  const finishAndSync = () => {
    const purpose = active?.purpose;
    const finished = finishRecording();
    void (purpose === 'todo' ? tasks.syncAfter(finished) : session.syncAfter(finished));
  };

  const startRecording = async (purpose: ActiveRecording['purpose']) => {
    const open = session.view().openVisit;
    const visitId = open?.id ?? null;
    const clientId = open?.clientId ?? null;
    audioBusy = true;
    audioMessage.textContent = '';
    render(session.view());
    // GPS avviato al tocco, prima di attendere il microfono: è la posizione in cui inizia la nota.
    const position = session.readNotePosition();
    try {
      const startedAt = formatLocalIsoDateTime(new Date());
      const recording = await AudioRecording.start(() => {
        void finishRecording('Nota fermata: lunghezza massima raggiunta.');
      });
      active = { purpose, visitId, clientId, recording, startedAt, position };
    } catch (error) {
      audioMessage.textContent = `Microfono non disponibile: ${errorMessage(error)}`;
    } finally {
      audioBusy = false;
      render(session.view());
    }
  };

  const unsubscribe = session.subscribe(render);
  const timer = window.setInterval(() => renderClock(session.view()), 1_000);
  render(session.view());

  toggleButton.addEventListener('click', () => {
    toggleButton.disabled = true;
    window.setTimeout(() => {
      toggleButton.disabled = false;
    }, DOUBLE_TAP_GUARD_MS);
    try {
      // Prima il check-in/out (orario del tap, token nel gesto), poi l'eventuale nota in corso.
      void session.toggle();
      if (active) {
        finishAndSync();
      }
    } catch (error) {
      noticeText.textContent = errorMessage(error);
    }
  });

  // Il tocco su "Ferma" avvia il salvataggio su Drive (token senza popup bloccati), eseguito a nota salvata.
  audioButton.addEventListener('click', () => (active ? finishAndSync() : void startRecording('note')));
  todoButton.addEventListener('click', () => (active ? finishAndSync() : void startRecording('todo')));

  requireElement<HTMLButtonElement>(container, '#open-clients').addEventListener('click', navigation.openClients);
  requireElement<HTMLButtonElement>(container, '#open-visits').addEventListener('click', navigation.openVisits);
  requireElement<HTMLButtonElement>(container, '#open-notes').addEventListener('click', navigation.openNotes);
  requireElement<HTMLButtonElement>(container, '#open-options').addEventListener('click', navigation.openOptions);
  // Finché il telefono non ha un nome, i dati registrati non dicono da quale dispositivo arrivano (T-032).
  const deviceBanner = requireElement<HTMLButtonElement>(container, '#device-banner');
  deviceBanner.hidden = session.currentDeviceName() !== null;
  deviceBanner.addEventListener('click', navigation.openOptions);

  return () => {
    closeDuePicker?.();
    unmountWorkPanel();
    unsubscribe();
    window.clearInterval(timer);
    player?.pause();
    void finishRecording();
  };
}
