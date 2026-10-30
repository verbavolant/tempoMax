const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Elemento #app non trovato in index.html');
}
appRoot.textContent = 'TempoMax';
