const ICON_MAP = {
  app: '⚡',
  folder: '📁',
  document: '📄',
  image: '🖼️',
  video: '🎬',
  archive: '📦',
  generic: '🖥️'
};

async function initDock() {
  const gridContainer = document.getElementById('gridContainer');
  if (!gridContainer) return;

  try {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) return;

    const shortcuts = await invoke('scan_shortcuts');

    gridContainer.innerHTML = '';
    shortcuts.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'shortcut-card';
      const iconSymbol = ICON_MAP[item.icon_type] || ICON_MAP.generic;

      card.innerHTML = `
        <div class="shortcut-icon-wrapper">${iconSymbol}</div>
        <span class="shortcut-title" title="${item.name}">${item.name}</span>
      `;

      card.addEventListener('dblclick', async () => {
        try {
          await invoke('launch_item', { path: item.path });
        } catch (err) {
          console.error('Failed to launch item:', err);
        }
      });

      gridContainer.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to scan shortcuts:', err);
  }
}

document.addEventListener('DOMContentLoaded', initDock);