import { useEffect, useRef, useState } from "react";
import "./living.css";
import { catalogue, renderCell, PALETTE } from "./storybook";
// Contact sheet of every reachable storybook cell (#art-sheet), enumerated by
// the same key functions the world renderer uses. Labels are the cell keys,
// i.e. the source-to-render mapping. Cells are painted in small batches into
// 160 px thumbnails and are not kept in the runtime cache.
const THUMB = 160;
export default function ArtSheet() {
  const ref = useRef<HTMLDivElement>(null);
  const [cells] = useState(catalogue);
  const [done, setDone] = useState(0);
  useEffect(() => {
    const host = ref.current!;
    host.replaceChildren();
    let group = "", i = 0, raf = 0;
    const batch = () => {
      for (const end = Math.min(cells.length, i + 12); i < end; i++) {
        const { group: g, key } = cells[i];
        if (g !== group) { const h = document.createElement("h2"); h.textContent = g; host.append(h); group = g; }
        const fig = document.createElement("figure"), c = document.createElement("canvas"), cap = document.createElement("figcaption");
        c.width = c.height = THUMB; c.getContext("2d")!.drawImage(renderCell(key), 0, 0, THUMB, THUMB);
        c.setAttribute("role", "img"); c.setAttribute("aria-label", key);
        cap.textContent = key; fig.append(c, cap); host.append(fig);
      }
      setDone(i);
      if (i < cells.length) raf = requestAnimationFrame(batch);
    };
    raf = requestAnimationFrame(batch);
    return () => cancelAnimationFrame(raf);
  }, [cells]);
  return (
    <main className="exp-art-sheet">
      <h1>Storybook art sheet</h1>
      <p>All {cells.length} reachable environment cells, painted live by <code>web/src/expanse/storybook.ts</code>{done < cells.length ? ` (painting ${done}/${cells.length})` : ""}. Ground line at y 280, light from the upper left.</p>
      <ul className="exp-art-swatches" aria-label="Palette">{Object.entries(PALETTE).flatMap(([k, v]) => ((typeof v === "string" ? [v] : [...v]) as string[]).map((c, i) => <li key={k + i} style={{ background: c }} title={`${k} ${c}`} />))}</ul>
      <div ref={ref} className="exp-art-grid" />
      <a href="#">Back to the Expanse</a>
    </main>
  );
}
