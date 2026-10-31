import { type DeviceSettings, MAX_DEVICE_NAME_LENGTH } from '../device';
import { errorMessage, requireElement } from './dom';

export interface OptionsScreenDependencies {
  deviceSettings: Pick<DeviceSettings, 'get' | 'set'>;
  /** Proposta quando il nome non è ancora impostato (es. "iPhone"). */
  suggestedDeviceName: string;
}

/** Schermata Opzioni: per ora il nome di questo telefono (qui arriverà anche il GPS disattivabile, T-026). */
export function mountOptionsScreen(container: HTMLElement, dependencies: OptionsScreenDependencies): Promise<void> {
  container.innerHTML = `
    <section class="options">
      <h2>Opzioni</h2>
      <form id="device-form" class="card">
        <label>Nome di questo telefono
          <input name="device" autocomplete="off" maxlength="${MAX_DEVICE_NAME_LENGTH}" />
        </label>
        <p class="muted">Viene registrato con visite, note vocali e orari, e compare nella colonna "Dispositivo" dei fogli. Esempio: "iPhone di Mario".</p>
        <p id="device-message" role="status"></p>
        <button type="submit" class="primary">Salva</button>
      </form>
    </section>
  `;
  const form = requireElement<HTMLFormElement>(container, '#device-form');
  const input = requireElement<HTMLInputElement>(form, '[name="device"]');
  const message = requireElement<HTMLParagraphElement>(form, '#device-message');
  const current = dependencies.deviceSettings.get();
  input.value = current ?? dependencies.suggestedDeviceName;
  if (!current) {
    message.textContent = 'Nome non ancora salvato: controlla la proposta e tocca Salva.';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const saved = dependencies.deviceSettings.set(input.value);
      input.value = saved ?? '';
      message.textContent = saved ? `Salvato: "${saved}".` : 'Nome cancellato: i nuovi dati non avranno il dispositivo.';
    } catch (error) {
      message.textContent = errorMessage(error);
    }
  });
  return Promise.resolve();
}
