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

      const iconSrc = item.icon_base64 || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>';

      card.innerHTML = `
        <img class="shortcut-icon-img" src="${iconSrc}" alt="${item.name}" />
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

    const dragHandle = document.querySelector('.drag-handle');
    if (dragHandle) {
      dragHandle.addEventListener('dblclick', async () => {
        await invoke('snap_window_to_zone', { zone: 'bottom-center' });
      });
    }
  } catch (err) {
    console.error('Failed to scan shortcuts:', err);
  }
}

document.addEventListener('DOMContentLoaded', initDock);