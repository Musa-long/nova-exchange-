const es = new EventSource('/api/ticker');

es.onmessage = (e) => {
  for (const t of JSON.parse(e.data)) {
    for (const el of document.querySelectorAll(`[data-sym="${t.sym}"]`)) {
      el.textContent = `$${
        t.price >= 1000
          ? t.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
          : t.price.toFixed(4)
      }`;
    }
  }
};

function tick() {
  for (const el of document.querySelectorAll('[data-unlock]')) {
    const left = Number(el.dataset.unlock) - Date.now();
    if (left <= 0) {
      el.textContent = 'unlocked — refresh';
      continue;
    }
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    el.textContent = `unlocks in ${h}h ${m}m ${s}s`;
  }
}

setInterval(tick, 1000);
tick();
