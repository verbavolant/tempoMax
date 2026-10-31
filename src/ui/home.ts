import { AudioRecording } from '../audio/recorder';
import { formatElapsed, formatLocalIsoDateTime } from '../model/time';
import type { AudioNote, Visit } from '../model/visit';
import type { AudioStore } from '../storage/audioStore';
import type { VisitSession, VisitSessionView } from '../visits/visitSession';
import { errorMessage, requireElement } from './dom';

// Un secondo tap involontario subito dopo il primo chiuderebbe la visita appena aperta.
const DOUBLE_TAP_GUARD_MS = 2_000;

interface ActiveRecording {
  visitId: string;
  recording: AudioRecording;
  startedAt: string;
}

/** Monta la schermata principale; restituisce la funzione che la smonta (ferma timer e registrazione). */
export function mountHomeScreen(
  container: HTMLElement,
  session: VisitSession,
  audioStore: AudioStore,
  navigation: { openClients: () => void; openVisits: () => void },
): () => void {
  container.innerHTML = `
    <section class="home">
      <button id="visit-toggle" type="button" class="big-button">
        <span class="big-button-label"></span>
        <span class="big-button-elapsed"></span>
      </button>
      <p id="visit-client" class="home-client"></p>
      <div id="audio-panel" class="audio-panel" hidden>
        <button id="audio-toggle" type="button" class="secondary-button"></button>
        <ul id="audio-list" class="audio-list"></ul>
        <p id="audio-message" class="home-notice" role="status"></p>
      </div>
      <p id="visit-notice" class="home-notice" role="status"></p>
      <button id="open-clients" type="button" class="secondary-button">👥 Clienti</button>
      <button id="open-visits" type="button" class="secondary-button">🕘 Visite</button>
    </section>
  `;

  const toggleButton = requireElement<HTMLButtonElement>(container, '#visit-toggle');
  const label = requireElement<HTMLSpanElement>(toggleButton, '.big-button-label');
  const elapsed = requireElement<HTMLSpanElement>(toggleButton, '.big-button-elapsed');
  const clientText = requireElement<HTMLParagraphElement>(container, '#visit-client');
  const noticeText = requireElement<HTMLParagraphElement>(container, '#visit-notice');
  const audioPanel = requireElement<HTMLDivElement>(container, '#audio-panel');
  const audioButton = requireElement<HTMLButtonElement>(container, '#audio-toggle');
  const audioList = requireElement<HTMLUListElement>(container, '#audio-list');
  const audioMessage = requireElement<HTMLParagraphElement>(container, '#audio-message');

  let active: ActiveRecording | null = null;
  let audioBusy = false;
  let player: HTMLAudioElement | null = null;
  let renderedAudioKey = '';

  const renderClock = (view: VisitSessionView) => {
    const open = view.openVisit;
    elapsed.textContent = open ? formatElapsed(Date.now() - Date.parse(open.checkIn.at)) : '';
    audioButton.textContent = active
      ? `⏹ Ferma · ${formatElapsed(active.recording.elapsedSeconds() * 1000)}`
      : '🎤 Nota vocale';
    audioButton.classList.toggle('recording', active !== null);
    audioButton.disabled = audioBusy;
  };

  const playNote = async (note: AudioNote) => {
    player?.pause();
    const audio = await audioStore.get(note.id);
    if (!audio) {
      audioMessage.textContent = 'File audio non presente sul telefono';
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
    audioPanel.hidden = open === null && active === null;
    renderAudioList(open);
    const pending = view.unsyncedCount > 0 ? `Visite da salvare su Drive: ${view.unsyncedCount}` : '';
    noticeText.textContent = [view.notice, pending].filter(Boolean).join(' · ');
    renderClock(view);
  };

  const finishRecording = async () => {
    const current = active;
    if (!current) {
      return;
    }
    active = null;
    audioBusy = true;
    render(session.view());
    try {
      const { audio, durationSeconds } = await current.recording.stop();
      const note: AudioNote = {
        id: crypto.randomUUID(),
        recordedAt: current.startedAt,
        mimeType: audio.type,
        durationSeconds,
        driveFileId: null,
      };
      // Prima il file sul telefono, poi il riferimento nella visita: mai un riferimento senza file.
      await audioStore.put(note.id, audio);
      session.addAudio(current.visitId, note);
      audioMessage.textContent = '';
    } catch (error) {
      audioMessage.textContent = `Nota non salvata: ${errorMessage(error)}`;
    } finally {
      audioBusy = false;
      render(session.view());
    }
  };

  const startRecording = async (visitId: string) => {
    audioBusy = true;
    audioMessage.textContent = '';
    render(session.view());
    try {
      const startedAt = formatLocalIsoDateTime(new Date());
      active = { visitId, recording: await AudioRecording.start(), startedAt };
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
      void finishRecording();
    } catch (error) {
      noticeText.textContent = errorMessage(error);
    }
  });

  audioButton.addEventListener('click', () => {
    if (active) {
      void finishRecording();
      return;
    }
    const open = session.view().openVisit;
    if (open) {
      void startRecording(open.id);
    }
  });

  requireElement<HTMLButtonElement>(container, '#open-clients').addEventListener('click', navigation.openClients);
  requireElement<HTMLButtonElement>(container, '#open-visits').addEventListener('click', navigation.openVisits);

  return () => {
    unsubscribe();
    window.clearInterval(timer);
    player?.pause();
    void finishRecording();
  };
}
