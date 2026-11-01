import { drawSprite, sprites, type Art } from "./art";
import { drawCell, softEdgeSheet, nodeKey, shelterKey, fireBeside, storeKey, hearthKey, gardenKey, regionOf, drawDressing, castShadow, stableHash, type Stage } from "./storybook";
import { residentPose, residentSprite, carried, constructionStage } from "./appearance";
export { residentPose } from "./appearance";
import { resourceGroups, type ResourceGroup, type ResourceHit } from './resources';
import { scale, type Size, type Point } from "./projection";
import { GroundCache, WATER } from "./ground";
import { projectSurface, pickSurface } from "./surface";
import { settlementWear, WornPaths, type WornSegment } from "./paths";
import type { Camera, Resident, WorldFrame } from "./types";
export const TILE_NAMES = [
  "Grass",
  "Freshwater lake",
  "Open sea",
  "Shallows",
  "Sand",
  "Rock",
  "Snow",
  "Cliff",
  "Forest floor",
  "Dune",
  "Freshwater stream",
];
export const hash = (x: number, y = 0) =>
  ((x * 374761393 + y * 668265263) ^ ((x + 19) * (y + 37) * 1274126177)) >>> 0;
export function biomeAt(f: WorldFrame, x: number, y: number) {
  const v=f.view;
  if(v.biomes && x>=v.x0 && y>=v.y0 && x<v.x0+v.w && y<v.y0+v.h) return v.biomes[(y-v.y0)*v.w+x-v.x0];
  const cx = Math.floor(x / 28),
    cy = Math.floor(y / 28);
  return (
    f.minimap.biomes.find(([bx, by]) => bx === cx && by === cy)?.[2] ??
    f.view.biome
  );
}
type Track = {
  from: { x: number; y: number };
  to: Resident;
  since: number;
  duration: number;
  direction: string;
  moving: boolean;
};
export class WorldRenderer {
  private ground: GroundCache;
  private paths: WornPaths;
  private travelled = new Map<string, WornSegment>();
  private wear: WornSegment[] = [];
  private tracks = new Map<number, Track>();
  private frame: WorldFrame | null = null;
  private received = 0;
  private tick: number | undefined;
  hits: { id: number; x: number; y: number; r: number; depth: number; tileX: number; tileY: number }[] = [];
  resourceHits:ResourceHit[]=[];
  resources:ResourceGroup[]=[];
  private resourceFrame:WorldFrame|null=null;
  private resourceScale=0;
  private picking: {f:WorldFrame;c:Camera;size:Size}|null=null;
  stats = {
    drawn: 0,
    culled: 0,
    terrainBuilds: 0,
    terrainChunks: 0,
    frames: 0,
    drawTimes: [] as number[],
  };
  private edged?: Record<string, CanvasImageSource>;
  /** Character sheet with the shared soft umber rim (see softEdgeSheet). */
  private residentArt() {
    if (!this.edged) {
      const sheet = this.art.characters;
      this.edged = sheet ? {...this.art, characters: softEdgeSheet(sheet, Object.values(sprites).filter(q=>q.sheet==='characters').map(q=>q.rect))} : this.art;
    }
    return this.edged;
  }
  constructor(private art: Art) {
    this.ground = new GroundCache(art);
    this.paths = new WornPaths(art);
  }
  update(f: WorldFrame, now: number, recorded: boolean) {
    if (this.frame === f) return;
    if (
      this.frame?.worldId !== f.worldId ||
      this.frame?.seed !== f.seed ||
      f.tick < (this.tick ?? 0)
    ) {
      this.tracks.clear();
      this.travelled.clear();
    }
    const duration = Math.max(100, Math.min(1100, now - this.received || 500));
    if (f.tick !== this.tick) {
      for (const r of f.residents) {
        const old = this.tracks.get(r.id),
          dx = r.x - (old?.to.x ?? r.x),
          dy = r.y - (old?.to.y ?? r.y);
        const adjacent = Math.max(Math.abs(dx), Math.abs(dy)) <= 1;
        const moving = !!old && f.tick - (this.tick ?? f.tick) === 1 && (dx !== 0 || dy !== 0) && adjacent && !recorded;
        if (moving) {
          const from = { x: old!.to.x, y: old!.to.y }, to = { x: r.x, y: r.y };
          const key = [`${from.x},${from.y}`, `${to.x},${to.y}`].sort().join(":");
          this.travelled.delete(key);
          this.travelled.set(key, { from, to });
          if (this.travelled.size > 256) this.travelled.delete(this.travelled.keys().next().value!);
        }
        let direction =
          old?.direction ?? ["se", "sw", "ne", "nw"][hash(r.id) % 4];
        if (dx || dy) {
          const sx = dx - dy,
            sy = dx + dy;
          direction = sx >= 0 ? (sy >= 0 ? "se" : "ne") : sy >= 0 ? "sw" : "nw";
        }
        this.tracks.set(r.id, {
          from: moving ? { x: old!.to.x, y: old!.to.y } : { x: r.x, y: r.y },
          to: r,
          since: now,
          duration,
          direction,
          moving,
        });
      }
      const alive = new Set(f.residents.map((r) => r.id));
      for (const id of this.tracks.keys())
        if (!alive.has(id)) this.tracks.delete(id);
      this.received = now;
      this.tick = f.tick;
    }
    this.wear = settlementWear(f, this.travelled.values());
    this.frame = f;
  }
  draw(
    ctx: CanvasRenderingContext2D,
    f: WorldFrame,
    c: Camera,
    size: Size,
    now: number,
    opts: {
      selected: number | null;
      knowledge: boolean;
      borders: boolean;
      motion: boolean;
      recorded: boolean;
    },
    dpr: number,
  ) {
    const start = performance.now();
    const project=(p:Point,cam:Camera,sz:Size)=>projectSurface(p,f,cam,sz);
    this.update(f, now, opts.recorded);
    this.picking={f,c,size};
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    this.ground.draw(ctx, f, c, size, dpr);
    this.stats.terrainBuilds = this.ground.builds;
    this.stats.terrainChunks = this.ground.size;
    this.paths.draw(ctx, this.wear, c, size, f);
    const s = scale(c, size),
      v = f.view;
    if (opts.borders) {
      ctx.strokeStyle = "#304f5470";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      for (let x = f.bounds.x0; x <= f.bounds.x1; x += 28) {
        const a = project({ x, y: f.bounds.y0 }, c, size),
          b = project({ x, y: f.bounds.y1 }, c, size);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (let y = f.bounds.y0; y <= f.bounds.y1; y += 28) {
        const a = project({ x: f.bounds.x0, y }, c, size),
          b = project({ x: f.bounds.x1, y }, c, size);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if (opts.motion) {
      ctx.strokeStyle = "#d9fff08a";
      ctx.lineWidth = 1;
      for (let j = 0; j < v.h; j++)
        for (let i = 0; i < v.w; i++)
          if (
            WATER.has(v.tiles[j * v.w + i]) &&
            hash(i + v.x0, j + v.y0) % 7 === 0
          ) {
            const p = project(
              { x: v.x0 + i + 0.5, y: v.y0 + j + 0.5 },
              c,
              size,
            );
            if (p.x < 0 || p.y < 0 || p.x > size.w || p.y > size.h) continue;
            const shift = Math.sin(now / 1800 + hash(i, j)) * s * 0.09;
            ctx.globalAlpha = 0.35 + 0.2 * Math.sin(now / 1500 + i);
            ctx.beginPath();
            ctx.ellipse(p.x + shift, p.y, s * 0.3, s * 0.06, 0, 0, Math.PI);
            ctx.stroke();
          }
      ctx.globalAlpha = 1;
    }
    const objects: { depth: number; draw: () => void }[] = [];
    const occupied = new Set<string>();
    for (const [,x,y] of v.shelters) occupied.add(`${x},${y}`);
    for (const q of [...(v.sites ?? []), ...(v.ruins ?? []), ...(v.crops ?? [])]) occupied.add(`${q.x},${q.y}`);
    for (const [,x,y] of v.fires) occupied.add(`${x},${y}`);
    // Redraw raised cliffs in the same depth queue as actors. A resident behind
    // a connected face is occluded instead of floating over the cached terrain.
    for(let y=v.y0;y<v.y0+v.h;y++)for(let x=v.x0;x<v.x0+v.w;x++)if(v.tiles[(y-v.y0)*v.w+x-v.x0]===7){
      const p=project({x:x+.5,y:y+.5},c,size);
      if(p.x>-s&&p.x<size.w+s&&p.y>-s*2&&p.y<size.h+s*2)objects.push({depth:p.depth,draw:()=>this.ground.drawOccluder(ctx,f,x,y,c,size)});
    }
    let drawn = 0,
      culled = 0;
    this.hits = [];
    const visible = (p: { x: number; y: number }, r: number) =>
      p.x > -r && p.x < size.w + r && p.y > -r && p.y < size.h + r;
    for (const [node, kind, x, y, units] of v.nodes) {
      if (units < 0) continue;
      const p = project({ x: x + 0.5, y: y + 0.5 }, c, size);
      if (!visible(p, s * 4)) {
        culled++;
        continue;
      }
      const region = regionOf(biomeAt(f, x, y));
      // One storybook pipeline for every node kind; legacy atlas only as a
      // visually compatible fallback when a kind has no painted cell.
      const cellKey = nodeKey(region, kind, node, units);
      let sprite: string | null = null, width = 3.2;
      if (!cellKey && kind === 'tree' && units > 0) sprite = `${region}.tree.${{forest:'oak',desert:'palm',cold:'spruce',coast:'pine'}[region]}`;
      if(kind==='fish') {
        // A quiet underwater stock marker, never a resident fishing animation.
        if(units>0) objects.push({depth:p.depth,draw:()=>{
          ctx.strokeStyle='#174d5d99';ctx.lineWidth=Math.max(1,s*.035);
          ctx.beginPath();ctx.ellipse(p.x,p.y,s*.18,s*.07,-.2,0,Math.PI*2);ctx.stroke();
          ctx.beginPath();ctx.moveTo(p.x-s*.17,p.y);ctx.lineTo(p.x-s*.28,p.y-s*.09);ctx.lineTo(p.x-s*.28,p.y+s*.08);ctx.closePath();ctx.stroke();
        }});
      } else if(kind==='shellfish'&&units>0) {
        objects.push({depth:p.depth,draw:()=>{ctx.fillStyle='#e1d1b9';ctx.strokeStyle='#3a2a1e';ctx.lineWidth=1;for(let n=0;n<Math.min(3,units);n++){ctx.beginPath();ctx.ellipse(p.x+s*(n-1)*.16,p.y,s*.11,s*.07,-.5,0,Math.PI*2);ctx.fill();ctx.stroke();}}});
      }
      if (cellKey) { occupied.add(`${x},${y}`); drawn++; objects.push({ depth: p.depth, draw: () => {
        const sway = opts.motion && kind === "tree" ? Math.sin(now / 2400 + hash(x, y)) * s * 0.012 : 0;
        drawCell(ctx, cellKey.key, p.x + sway, p.y, cellKey.width * s);
      } }); continue; }
      if (!sprite) continue;
      drawn++;
      objects.push({
        depth: p.depth,
        draw: () => {
          const sway =
            opts.motion && kind === "tree"
              ? Math.sin(now / 2400 + hash(x, y)) * s * 0.012
              : 0;
          drawSprite(ctx, this.art, sprite!, p.x + sway, p.y, width * s);
        },
      });
    }
    const structure = (x:number,y:number,stage:Stage,id?:number) => {
      const p=project({x:x+.5,y:y+.5},c,size);
      if(!visible(p,s*5)){culled++;return;}
      drawn++;
      // Shelter appearance: variant from the stable shelter id (shape AND
      // material), state from the authoritative stage/integrity only.
      // Chimney smoke only with a real burning fire on or beside the shelter.
      const lit=stage==='complete'&&fireBeside(v.fires,v.fireState,x,y);
      objects.push({depth:p.depth,draw:()=>drawCell(ctx,shelterKey(regionOf(biomeAt(f,x,y)),id,stage,lit),p.x,p.y,s*4.6)});
    };
    for (const [id,x,y,,integrity=100] of v.shelters) structure(x,y,integrity<=0?'ruin':integrity<40?'damaged':'complete',id);
    for (const ruin of v.ruins ?? []) structure(ruin.x,ruin.y,'ruin',ruin.id);
    for (const site of v.sites ?? []) {
      const p=project({x:site.x+.5,y:site.y+.5},c,size);
      const stage=constructionStage(site);
      if(stage!=='marker') structure(site.x,site.y,stage,site.id);
      else objects.push({depth:p.depth,draw:()=>{ctx.strokeStyle='#e8c36e99';ctx.lineWidth=1.5;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(p.x,p.y-s*.45);ctx.lineTo(p.x+s*.9,p.y);ctx.lineTo(p.x,p.y+s*.45);ctx.lineTo(p.x-s*.9,p.y);ctx.closePath();ctx.stroke();ctx.setLineDash([]);}});
      const n=Object.values(site.need).reduce((a,b)=>a+b,0), delivered=Object.values(site.materials).reduce((a,b)=>a+b,0);
      if(delivered>0) objects.push({depth:p.depth+.2,draw:()=>{ctx.fillStyle='#25332d';ctx.fillRect(p.x-s*.65,p.y+s*.2,s*1.3,Math.max(3,s*.1));ctx.fillStyle='#e8c36e';ctx.fillRect(p.x-s*.65,p.y+s*.2,s*1.3*Math.min(delivered/n,site.work/site.workNeed),Math.max(3,s*.1));}});
    }
    if(this.resourceFrame!==f||this.resourceScale!==s){this.resources=resourceGroups(f,c,size);this.resourceFrame=f;this.resourceScale=s;}
    this.resourceHits=[];
    for(const stock of this.resources) {
      const p=project({x:stock.x+.85,y:stock.y+1},c,size);
      if(!visible(p,s*2))continue;
      const grouped=stock.members.length>1;
      // Quantities change volume discretely; all exact item counts are disclosed
      // on selection. Overview groups use low compact silhouettes, not repeated
      // copies of the single log bundle or overlapping numeric badges.
      const radius=s*(.28+stock.size*.1);
      this.resourceHits.push({key:stock.key,x:p.x,y:p.y-radius*.3,r:Math.max(12,radius),depth:p.depth});
      drawn++;
      objects.push({depth:p.depth+.1,draw:()=>{
        if(stock.kind==='store'){
          // Storage zone of a real shelter store: a covered rack when timber
          // dominates, baskets/crates otherwise; fill follows the size class.
          drawCell(ctx,storeKey(regionOf(biomeAt(f,stock.x,stock.y)),stock.items,stock.size,stock.members.every(m=>m.ruined)),p.x,p.y,s*(1.7+.15*stock.size));
        }else{
          castShadow(ctx,p.x,p.y,radius*1.1,radius*.42);
          const outline='#3a2a1e';ctx.strokeStyle=outline;ctx.lineWidth=Math.max(.7,s*.03);
          if(stock.items.wood>0){
            // A quantity-aware stacked cross-section (1–4 tiers) of timber.
            const log=Math.max(1.6,radius*.22);
            for(let row=0;row<stock.size;row++)for(let col=0;col<stock.size-row;col++){
              const x=p.x+(col-(stock.size-row-1)/2)*log*1.75,y=p.y-row*log*1.35-log;
              ctx.fillStyle='#8a6040';ctx.beginPath();ctx.ellipse(x,y,log,log*.75,-.15,0,7);ctx.fill();ctx.stroke();
              ctx.fillStyle='#e8d8b4';ctx.beginPath();ctx.ellipse(x+log*.12,y-log*.1,log*.55,log*.42,-.15,0,7);ctx.fill();
            }
          }else{
            const tone=stock.items.stone>0?['#9c9a8c','#c3c0ae']:['#c9a55a','#e2c47a'];
            for(let k=0;k<stock.size;k++){const x=p.x+(k-(stock.size-1)/2)*radius*.4,y=p.y-radius*(.15+(k%2)*.2);ctx.fillStyle=tone[0];ctx.beginPath();ctx.ellipse(x,y,radius*.4,radius*.3,-.4,0,7);ctx.fill();ctx.stroke();ctx.fillStyle=tone[1];ctx.beginPath();ctx.ellipse(x-radius*.1,y-radius*.1,radius*.18,radius*.1,-.4,0,7);ctx.fill();}
          }
          if(stock.items.wood>0&&Object.keys(stock.items).some(k=>k!=='wood'&&stock.items[k]>0)){ctx.fillStyle='#c9a55a';ctx.beginPath();ctx.ellipse(p.x+radius*.7,p.y-radius*.15,radius*.3,radius*.22,0,0,7);ctx.fill();ctx.stroke();}
          // A small linked pair marks aggregation without inventing a building.
          if(grouped){ctx.strokeStyle='#f4e4ba';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(p.x+radius*.65,p.y-radius*.95,2.2,0,7);ctx.arc(p.x+radius*.9,p.y-radius*.95,2.2,0,7);ctx.stroke();}
        }
      }});
    }
    for (const [id,x,y] of v.fires) {
      const p=project({x:x+.5,y:y+.5},c,size);if(!visible(p,s*3))continue;
      drawn++;
      // Work area: the real fire. Hearth variant from the fire id; flame height
      // from its actual fuel when the frame reports it.
      const fuel=v.fireState?.find(q=>q.id===id)?.fuel,heat=fuel===undefined?1:Math.max(.35,Math.min(1.25,fuel/3));
      objects.push({depth:p.depth,draw:()=>{
        drawCell(ctx,hearthKey(regionOf(biomeAt(f,x,y)),id),p.x,p.y,s*2.4);
        const flicker=(opts.motion?1+.1*Math.sin(now/160+x):1)*heat;
        const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,s*1.3);glow.addColorStop(0,'#ffd46e55');glow.addColorStop(1,'#ffd46e00');ctx.fillStyle=glow;ctx.fillRect(p.x-s*1.3,p.y-s*1.3,s*2.6,s*2.6);
        ctx.strokeStyle='#3a2a1e';ctx.lineWidth=s*.16;ctx.beginPath();ctx.moveTo(p.x-s*.3,p.y);ctx.lineTo(p.x+s*.3,p.y-s*.15);ctx.moveTo(p.x-s*.3,p.y-s*.15);ctx.lineTo(p.x+s*.3,p.y);ctx.stroke();
        ctx.strokeStyle='#8a6040';ctx.lineWidth=s*.09;ctx.stroke();
        ctx.fillStyle='#c8522a';ctx.beginPath();ctx.moveTo(p.x-s*.28,p.y-s*.08);ctx.quadraticCurveTo(p.x-s*.34,p.y-s*.55*flicker,p.x+s*.06,p.y-s*.95*flicker);ctx.quadraticCurveTo(p.x+s*.52,p.y-s*.22,p.x+s*.18,p.y);ctx.fill();
        ctx.fillStyle='#ef9a3c';ctx.beginPath();ctx.moveTo(p.x-s*.17,p.y-s*.08);ctx.quadraticCurveTo(p.x-s*.2,p.y-s*.4*flicker,p.x+s*.04,p.y-s*.7*flicker);ctx.quadraticCurveTo(p.x+s*.34,p.y-s*.2,p.x+s*.1,p.y-s*.02);ctx.fill();
        ctx.fillStyle='#ffe39b';ctx.beginPath();ctx.ellipse(p.x,p.y-s*.22,s*.08,s*.2*flicker,0,0,Math.PI*2);ctx.fill();
      }});
    }
    for(const crop of v.crops ?? []){
      const p=project({x:crop.x+.5,y:crop.y+.5},c,size);if(!visible(p,s*2))continue;
      objects.push({depth:p.depth+.05,draw:()=>{
        // Exact crop species and stage: never use the supplied wheat illustration
        // for berry/cactus plants. Soil is a planted tile, not a free resource.
        drawCell(ctx,gardenKey(crop.id,crop.dry),p.x,p.y,s*2.3);
        const growth=Math.min(1,(crop.growth+1)/6),green=crop.dry?'#8a9a4a':'#5f8f3a';
        ctx.strokeStyle='#3a2a1e';ctx.lineWidth=Math.max(.7,s*.03);ctx.fillStyle=green;for(const dx of [-.22,.22]){ctx.beginPath();ctx.ellipse(p.x+s*dx,p.y-s*.22*growth,s*.2*growth,s*.27*growth,0,0,7);ctx.fill();ctx.stroke();}ctx.fillStyle=crop.dry?'#b7c46e':'#9cc25a';ctx.beginPath();ctx.ellipse(p.x-s*.04,p.y-s*.32*growth,s*.12*growth,s*.12*growth,0,0,7);ctx.fill();
        if(crop.kind==='cactus_fruit'){ctx.strokeStyle='#d5cd90';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-s*.5*growth);ctx.stroke();}
        if(crop.ripe){ctx.fillStyle=crop.kind==='berry'?'#ae3d3c':'#cf9759';for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(p.x+(k-1)*s*.12,p.y-s*(.2+(k%2)*.15),Math.max(1.5,s*.07),0,7);ctx.fill();}}
      }});
    }
    for (const r of f.residents) {
      const tr = this.tracks.get(r.id)!;
      if (!tr) continue;
      const t =
        opts.motion && !opts.recorded
          ? Math.max(0, Math.min(1, (now - tr.since) / tr.duration))
          : 1;
      const x = tr.from.x + (tr.to.x - tr.from.x) * t,
        y = tr.from.y + (tr.to.y - tr.from.y) * t,
        p = project({ x: x + 0.5, y: y + 0.5 }, c, size);
      // Global roster is for navigation. Only residents in the confirmed viewport are rendered.
      if (
        r.x < v.x0 ||
        r.y < v.y0 ||
        r.x >= v.x0 + v.w ||
        r.y >= v.y0 + v.h ||
        !visible(p, s * 3)
      ) {
        culled++;
        continue;
      }
      drawn++;
      const pose = residentPose(r, f, tr.moving && t < 1);
      const phase = opts.motion && !opts.recorded ? Math.floor(now/(pose==='walk'||pose==='carry'?145:pose==='sleep'?900:300)) : 0;
      const sprite = residentSprite(r,f,tr.moving && t<1,tr.direction,phase);
      const h = s * 2.65;
      this.hits.push({
        id: r.id,
        x: p.x,
        y: p.y - h * 0.28,
        r: Math.max(12, h * 0.28),
        depth:p.depth, tileX:r.x, tileY:r.y,
      });
      objects.push({
        depth: p.depth + 0.1,
        draw: () => {
          // Same cast-shadow rule as every structure and tree.
          castShadow(ctx, p.x, p.y + 1, s * 0.5, s * 0.21);
          if (r.id === opts.selected || r.health < 30) {
            ctx.strokeStyle = r.id === opts.selected ? "#fff1b0" : "#943e2d";
            ctx.lineWidth = r.id === opts.selected ? 2.5 : 2;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, s * 0.8, s * 0.4, 0, 0, 7);
            ctx.stroke();
          }
          const mirror = (pose==='fish' && r.target ? r.target.x-r.target.y < r.x-r.y : tr.direction === 'sw') && !sprite.startsWith('idle.');
          ctx.save();
          if(mirror) {ctx.translate(p.x*2,0);ctx.scale(-1,1);}
          const farming=['plant','tend','harvest'].includes(pose);
          // One registered kneeling actor; the reusable gestures contain no
          // wheat, kettle, spare tools or extra resident from the art sheet.
          drawSprite(ctx,this.residentArt(),sprite,p.x,p.y,farming?s*1.5:h);
          if(farming&&opts.motion){
            const pulse=Math.sin(now/220)*s*.035;
            ctx.strokeStyle='#e9c363';ctx.lineWidth=s*.07;ctx.beginPath();ctx.moveTo(p.x+s*.2,p.y-s*.25);ctx.lineTo(p.x+s*.38,p.y-s*.12+pulse);ctx.stroke();
          }
          if(pose==='cook'&&r.target){
            const q=project({x:r.target.x+.5,y:r.target.y+.5},c,size);
            const lift=opts.motion?Math.sin(now/350)*s*.03:0;
            ctx.strokeStyle='#cba64e';ctx.lineWidth=s*.09;ctx.beginPath();ctx.moveTo(p.x,p.y-s*.5);ctx.lineTo((p.x+q.x)/2,(p.y+q.y)/2-s*.45+lift);ctx.stroke();
            ctx.fillStyle=r.item==='lichen'?'#9caa72':'#a4b9b0';ctx.beginPath();ctx.ellipse((p.x+q.x)/2,(p.y+q.y)/2-s*.45+lift,s*.13,s*.07,-.2,0,7);ctx.fill();
          }
          ctx.restore();
          const load=carried(r,f);
          if(pose==='work'&&r.target){
            // Bare-hand work at the actual node (stone, flint, reeds…): a reach
            // toward the target, paced by the frame clock, with no invented prop.
            const q=project({x:r.target.x+.5,y:r.target.y+.5},c,size),reach=opts.motion?.55+.25*Math.sin(now/180):.7;
            ctx.strokeStyle='#e9b93c';ctx.lineWidth=Math.max(1.5,s*.12);ctx.lineCap='round';
            ctx.beginPath();ctx.moveTo(p.x,p.y-s*.55);ctx.lineTo(p.x+(q.x-p.x)*reach*.5,p.y-s*.55+(q.y-p.y)*reach*.5+s*.15);ctx.stroke();ctx.lineCap='butt';
          }
          // The held inventory stays visible separately from the depicted action.
          if(Object.values(load).some(n=>n>0)&&!sprite.startsWith('carry.')){
            // Small neutral pouch for loads without a matching supplied pose; no false wood/fish.
            ctx.fillStyle='#9b7750';ctx.beginPath();ctx.ellipse(p.x+s*.38,p.y-s*.48,s*.14,s*.19,-.3,0,Math.PI*2);ctx.fill();
          }
          if(pose==='fish'&&r.target){
            const q=project({x:r.target.x+.5,y:r.target.y+.5},c,size);
            ctx.strokeStyle='#e8d9abbb';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x+s*.48*(mirror?-1:1),p.y-s*.8);ctx.quadraticCurveTo((p.x+q.x)/2,Math.min(p.y,q.y)-s*.6,q.x,q.y);ctx.stroke();
            ctx.fillStyle='#db7954';ctx.beginPath();ctx.arc(q.x,q.y,Math.max(1.4,s*.06),0,Math.PI*2);ctx.fill();
          }
          if(r.helping!==undefined){
            ctx.strokeStyle='#fff3c3';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(p.x+s*.65,p.y-s*.9,s*.13,0,7);ctx.arc(p.x+s*.84,p.y-s*.9,s*.13,0,7);ctx.stroke();
          }
          if (r.id === opts.selected) {
            ctx.fillStyle = "#fff3c3";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - h * 0.58 - 8);
            ctx.lineTo(p.x - 4, p.y - h * 0.58 - 14);
            ctx.lineTo(p.x + 4, p.y - h * 0.58 - 14);
            ctx.fill();
          }
        },
      });
    }
    // Ground dressing: derived from real tiles, non-interactive, never on an
    // occupied tile, at most one item per tile and only on ~1 tile in 9.
    if (s >= 14) for (let j = 0; j < v.h; j++) for (let i = 0; i < v.w; i++) {
      const x = v.x0 + i, y = v.y0 + j, t = v.tiles[j * v.w + i], h = hash(x * 3 + 1, y * 5 + 2);
      if (WATER.has(t) || t === 7 || occupied.has(`${x},${y}`)) continue;
      const wet = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => { const xx=i+dx, yy=j+dy; return xx>=0&&yy>=0&&xx<v.w&&yy<v.h&&WATER.has(v.tiles[yy*v.w+xx]); });
      const kind = wet ? (h % 3 === 0 ? "shore" : null) : h % 9 !== 0 ? null : t === 6 ? "snowdrift" : t === 4 || t === 9 || t === 5 ? "pebbles" : (t === 0 || t === 8) ? (h % 2 ? "tuft" : "flowers") : null;
      if (!kind) continue;
      const p = project({ x: x + .3 + (h % 40) / 100, y: y + .3 + ((h >> 6) % 40) / 100 }, c, size);
      if (!visible(p, s)) continue;
      drawDressing(ctx, kind, p.x, p.y, s, h);
    }
    objects.sort((a, b) => a.depth - b.depth);
    for (const o of objects) o.draw();
    // Neutral glyphs from actual emissions only. No translation or fictional
    // dialogue; at most the newest twelve in view, fading by authoritative tick.
    for(const signal of (v.signals??[]).filter(g=>f.tick-g.tick<=12).slice(-12)){
      const p=project({x:signal.x+.5,y:signal.y+.5},c,size);
      if(!visible(p,s*2))continue;
      ctx.globalAlpha=Math.max(.25,1-(f.tick-signal.tick)/16);
      ctx.fillStyle='#28362d';ctx.beginPath();ctx.arc(p.x,p.y-s*1.7,Math.max(10,s*.42),0,7);ctx.fill();
      ctx.fillStyle='#f5efd9';ctx.font=`${Math.max(12,s*.55)}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(signal.glyph,p.x,p.y-s*1.7);ctx.globalAlpha=1;
    }
    // Weather follows the frame's actual climate and biome: rain streaks, or
    // snowfall when the viewed biome is cold. Static frames show it unanimated.
    if (v.climate?.rain) {
      const cold = regionOf(v.biome) === "cold" || v.climate.temperature <= 0, t = opts.motion ? now : 0;
      ctx.strokeStyle = "rgba(214,232,240,.45)"; ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1;
      for (let n = 0; n < 90; n++) {
        const h = stableHash(n), x = ((h % 1000) / 1000 * size.w + (cold ? Math.sin(t / 900 + n) * 8 : -t * .05)) % size.w, y = ((h >>> 10) % 1000 / 1000 * size.h + t * (cold ? .03 : .45)) % size.h;
        if (cold) { ctx.beginPath(); ctx.arc((x + size.w) % size.w, y, 1.6, 0, 7); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo((x + size.w) % size.w, y); ctx.lineTo((x + size.w) % size.w - 3, y + 11); ctx.stroke(); }
      }
    }
    if (opts.knowledge && f.inspector?.observation) {
      const o = f.inspector.observation,
        pts = [
          { x: o.self.x - o.radius, y: o.self.y - o.radius },
          { x: o.self.x + o.radius + 1, y: o.self.y - o.radius },
          { x: o.self.x + o.radius + 1, y: o.self.y + o.radius + 1 },
          { x: o.self.x - o.radius, y: o.self.y + o.radius + 1 },
        ].map((p) => project(p, c, size));
      ctx.fillStyle = "#112c3866";
      ctx.beginPath();
      ctx.rect(0, 0, size.w, size.h);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill("evenodd");
      ctx.strokeStyle = "#fff1b0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.stroke();
    }
    this.stats.drawn = drawn;
    this.stats.culled = culled;
    this.stats.frames++;
    this.stats.drawTimes.push(performance.now() - start);
    if (this.stats.drawTimes.length > 300) this.stats.drawTimes.shift();
  }
  pickResource(x:number,y:number):ResourceGroup|null {
    const context=this.picking,terrain=context?pickSurface({x,y},context.f,context.c,context.size):null;
    for(const hit of this.resourceHits.filter(h=>Math.hypot(h.x-x,h.y-y)<=h.r).sort((a,b)=>b.depth-a.depth)){
      const group=this.resources.find(g=>g.key===hit.key)!;
      const blocked=terrain&&context&&context.f.view.tiles[(terrain.y-context.f.view.y0)*context.f.view.w+terrain.x-context.f.view.x0]===7&&terrain.x+terrain.y>group.x+group.y;
      if(!blocked)return group;
    }
    return null;
  }
  pick(x: number, y: number): number | null {
    let best: number | null = null, depth=-Infinity;
    const context=this.picking;
    const terrain=context?pickSurface({x,y},context.f,context.c,context.size):null;
    for (const hit of this.hits) {
      const d = Math.hypot(hit.x - x, hit.y - y);
      // A foreground cliff blocks resident hits, matching its render order.
      const blocked=terrain&&context&&context.f.view.tiles[(terrain.y-context.f.view.y0)*context.f.view.w+terrain.x-context.f.view.x0]===7&&terrain.x+terrain.y>hit.tileX+hit.tileY;
      if (d < hit.r && hit.depth>=depth && !blocked) { depth=hit.depth;best=hit.id; }
    }
    return best;
  }
}
