export function renderPalette(container, registry, onAdd) {
  container.innerHTML = "";
  const byCat = registry.pluginsByCategory();
  for (const [category, plugins] of byCat) {
    const catEl = document.createElement("div");
    catEl.className = "palette-category";
    const title = document.createElement("h3");
    title.textContent = category;
    catEl.appendChild(title);
    for (const p of plugins) {
      const btn = document.createElement("button");
      btn.className = "palette-item";
      const displayName = p.plainName || p.name;
      const techName = p.plainName ? p.name : "";
      btn.innerHTML = `
        <div class="palette-item-name">${displayName}</div>
        ${techName ? `<div class="palette-item-tech">${techName}</div>` : ""}
      `;
      btn.onclick = () => onAdd(p);
      catEl.appendChild(btn);
    }
    container.appendChild(catEl);
  }
}
