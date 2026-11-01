import { useEffect, useRef } from "react";
import "./living.css";
import { catalogue, cellFor, PALETTE } from "./storybook";
// Contact sheet of every storybook cell the world can draw (#art-sheet).
// Labels are the cell keys, i.e. the source-to-render mapping.
export default function ArtSheet() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current!;
    host.replaceChildren();
    let group = "";
    for (const { group: g, key } of catalogue()) {
      if (g !== group) { const h = document.createElement("h2"); h.textContent = g; host.append(h); group = g; }
      const fig = document.createElement("figure"), c = cellFor(key), cap = document.createElement("figcaption");
      c.setAttribute("role", "img"); c.setAttribute("aria-label", key);
      cap.textContent = key; fig.append(c, cap); host.append(fig);
    }
  }, []);
  return (
    <main className="exp-art-sheet">
      <h1>Storybook art sheet</h1>
      <p>Every environment cell, painted live by <code>web/src/expanse/storybook.ts</code>. Ground line at y 280, light from the upper left.</p>
      <ul className="exp-art-swatches" aria-label="Palette">{Object.entries(PALETTE).flatMap(([k, v]) => ((typeof v === "string" ? [v] : [...v]) as string[]).map((c, i) => <li key={k + i} style={{ background: c }} title={`${k} ${c}`} />))}</ul>
      <div ref={ref} className="exp-art-grid" />
      <a href="#">Back to the Expanse</a>
    </main>
  );
}
