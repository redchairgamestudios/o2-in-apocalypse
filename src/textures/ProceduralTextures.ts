import * as THREE from 'three';
import { GraphicsSettings } from '../core/GraphicsSettings';

// Texture resolution scales with the texture quality preset: LOW renders
// every procedural surface texture at 256² instead of 512² — a quarter of
// the fill bandwidth on tiled ground/wall materials. Read once at module
// load, before any texture is generated and cached (changing it needs a
// page reload to take effect; the settings UI says so).
const LOW_TEX_TIER = GraphicsSettings.get().textureQuality === 'LOW';
const TEX_SIZE = LOW_TEX_TIER ? 256 : 512;

/**
 * High-performance procedural canvas texture generator for Three.js.
 * Guarantees zero network load failures and immediate visual fidelity.
 */
export class ProceduralTextures {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  public static getAsphalt(): THREE.CanvasTexture {
    if (this.cache.has('asphalt')) return this.cache.get('asphalt')!;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Dark asphalt base
    ctx.fillStyle = '#222428';
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    // Grain noise
    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * TEX_SIZE;
      const y = Math.random() * TEX_SIZE;
      const shade = Math.floor(Math.random() * 40 + 20);
      ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 4})`;
      ctx.fillRect(x, y, 2.4, 2.4);
    }

    // Dirt patches
    for (let i = 0; i < 15; i++) {
      const cx = Math.random() * TEX_SIZE;
      const cy = Math.random() * TEX_SIZE;
      const r = Math.random() * 60 + 20;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(15, 12, 10, 0.45)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Asphalt cracks
    ctx.strokeStyle = '#111215';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      let x = Math.random() * TEX_SIZE;
      let y = Math.random() * TEX_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 40;
        y += (Math.random() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Double yellow center divider line
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.75)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(250, 0);
    ctx.lineTo(250, TEX_SIZE);
    ctx.moveTo(262, 0);
    ctx.lineTo(262, TEX_SIZE);
    ctx.stroke();

    // White dashed lane guidelines
    ctx.strokeStyle = 'rgba(240, 240, 245, 0.65)';
    ctx.lineWidth = 4;
    ctx.setLineDash([28, 24]);
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, TEX_SIZE);
    ctx.moveTo(384, 0);
    ctx.lineTo(384, TEX_SIZE);
    ctx.stroke();
    ctx.setLineDash([]);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('asphalt', tex);
    return tex;
  }

  public static getBrickWall(): THREE.CanvasTexture {
    if (this.cache.has('brick')) return this.cache.get('brick')!;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Mortar background
    ctx.fillStyle = '#9c9589';
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const rows = 16;
    const rowH = TEX_SIZE / rows;
    const brickW = 64;

    for (let r = 0; r < rows; r++) {
      const y = r * rowH + 2;
      const h = rowH - 4;
      const offsetX = (r % 2 === 0) ? 0 : -brickW / 2;

      for (let x = offsetX; x < TEX_SIZE + brickW; x += brickW) {
        // Natural brick color variation (reddish-terracotta to brownish charcoal)
        const redTone = Math.floor(Math.random() * 45 + 130);
        const greenTone = Math.floor(Math.random() * 30 + 55);
        const blueTone = Math.floor(Math.random() * 25 + 40);
        ctx.fillStyle = `rgb(${redTone},${greenTone},${blueTone})`;
        ctx.fillRect(x + 2, y, brickW - 4, h);

        // Brick surface grain
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let g = 0; g < 4; g++) {
          ctx.fillRect(x + 4 + Math.random() * (brickW - 12), y + Math.random() * (h - 4), 3, 2);
        }
      }
    }

    // Weathering grime & water stains
    ctx.fillStyle = 'rgba(25, 20, 15, 0.25)';
    for (let i = 0; i < 6; i++) {
      const sx = Math.random() * TEX_SIZE;
      ctx.fillRect(sx, 0, Math.random() * 30 + 15, TEX_SIZE);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('brick', tex);
    return tex;
  }

  public static getBuildingWindows(): THREE.CanvasTexture {
    if (this.cache.has('windows')) return this.cache.get('windows')!;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Concrete facade base
    ctx.fillStyle = '#3a3e47';
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    // Grid of windows
    const cols = 4;
    const rows = 4;
    const padX = TEX_SIZE / cols;
    const padY = TEX_SIZE / rows;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const wx = c * padX + 24;
        const wy = r * padY + 20;
        const ww = padX - 48;
        const wh = padY - 40;

        // Window ledge / sill
        ctx.fillStyle = '#22252a';
        ctx.fillRect(wx - 4, wy + wh, ww + 8, 8);

        // Window Frame
        ctx.fillStyle = '#1c1e22';
        ctx.fillRect(wx, wy, ww, wh);

        // Window Glass: some illuminated, some dark reflective
        const isLit = Math.random() > 0.45;
        if (isLit) {
          // Warm amber room light or office fluorescent
          const warm = Math.random() > 0.35;
          const glassGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
          if (warm) {
            glassGrad.addColorStop(0, '#fef08a');
            glassGrad.addColorStop(0.6, '#f59e0b');
            glassGrad.addColorStop(1, '#b45309');
          } else {
            glassGrad.addColorStop(0, '#93c5fd');
            glassGrad.addColorStop(0.7, '#3b82f6');
            glassGrad.addColorStop(1, '#1d4ed8');
          }
          ctx.fillStyle = glassGrad;
          ctx.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);

          // Interior blinds silhouette
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          for (let b = wy + 6; b < wy + wh - 6; b += 7) {
            ctx.fillRect(wx + 4, b, ww - 8, 2);
          }
        } else {
          // Dark reflective glass
          const darkGrad = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
          darkGrad.addColorStop(0, '#1e293b');
          darkGrad.addColorStop(0.5, '#0f172a');
          darkGrad.addColorStop(1, '#020617');
          ctx.fillStyle = darkGrad;
          ctx.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);
        }

        // Window mullions / crossbars
        ctx.fillStyle = '#111317';
        ctx.fillRect(wx + ww / 2 - 2, wy + 4, 4, wh - 8);
        ctx.fillRect(wx + 4, wy + wh * 0.45 - 2, ww - 8, 4);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('windows', tex);
    return tex;
  }

  public static getStorefront(): THREE.CanvasTexture {
    if (this.cache.has('storefront')) return this.cache.get('storefront')!;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Brick/Granite lower base
    ctx.fillStyle = '#262930';
    ctx.fillRect(0, 0, TEX_SIZE, 256);

    // Signboard banner at top
    const signType = Math.random();
    let signBg = '#7f1d1d';
    let signText = 'PHARMACY';
    if (signType > 0.66) {
      signBg = '#14532d';
      signText = 'QUARANTINE AID';
    } else if (signType > 0.33) {
      signBg = '#1e3a8a';
      signText = 'METRO SURPLUS';
    }

    ctx.fillStyle = signBg;
    ctx.fillRect(16, 12, 480, 52);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 12, 480, 52);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(signText, 256, 38);

    // Display windows & metal roll-up security gates
    // Left display window
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(24, 76, 210, 160);
    // Security grate pattern
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    for (let y = 84; y < 230; y += 12) {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(234, y);
      ctx.stroke();
    }

    // Doorway / Entrance
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(250, 76, 100, 160);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.strokeRect(250, 76, 100, 160);
    // Door handle
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(330, 150, 6, 24);

    // Right display window
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(366, 76, 122, 160);
    for (let y = 84; y < 230; y += 12) {
      ctx.beginPath();
      ctx.moveTo(366, y);
      ctx.lineTo(488, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('storefront', tex);
    return tex;
  }

  public static getWoodPlanks(): THREE.CanvasTexture {
    if (this.cache.has('wood')) return this.cache.get('wood')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#6b4f35';
    ctx.fillRect(0, 0, 256, 256);

    // Planks
    const plankH = 32;
    for (let y = 0; y < 256; y += plankH) {
      ctx.fillStyle = Math.random() > 0.5 ? '#785b3e' : '#5e432c';
      ctx.fillRect(0, y + 2, 256, plankH - 4);

      // Wood grain lines
      ctx.strokeStyle = 'rgba(40, 25, 15, 0.35)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 5; g++) {
        ctx.beginPath();
        const gy = y + 4 + Math.random() * (plankH - 8);
        ctx.moveTo(0, gy);
        ctx.lineTo(256, gy + (Math.random() - 0.5) * 4);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('wood', tex);
    return tex;
  }

  public static getConcreteWall(): THREE.CanvasTexture {
    if (this.cache.has('concrete')) return this.cache.get('concrete')!;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#4a4d52';
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    // Weathered cement speckles
    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * TEX_SIZE;
      const y = Math.random() * TEX_SIZE;
      const c = Math.floor(Math.random() * 50 + 60);
      ctx.fillStyle = `rgb(${c},${c},${c})`;
      ctx.fillRect(x, y, 2.5, 2.5);
    }

    // Water stains / grime streaks
    ctx.fillStyle = 'rgba(20, 20, 18, 0.35)';
    for (let i = 0; i < 8; i++) {
      const sx = Math.random() * TEX_SIZE;
      const width = Math.random() * 40 + 10;
      ctx.fillRect(sx, 0, width, TEX_SIZE);
    }

    // Block seams / mortar lines
    ctx.strokeStyle = 'rgba(20, 20, 20, 0.7)';
    ctx.lineWidth = 2;
    for (let y = 64; y < TEX_SIZE; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(TEX_SIZE, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('concrete', tex);
    return tex;
  }

  public static getHazardStripes(): THREE.CanvasTexture {
    if (this.cache.has('hazard')) return this.cache.get('hazard')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#d97706'; // Warning amber
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#18181b'; // Black
    const stripeWidth = 32;
    ctx.beginPath();
    for (let x = -256; x < TEX_SIZE; x += stripeWidth * 2) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth + 256, 256);
      ctx.lineTo(x + 256, 256);
      ctx.closePath();
    }
    ctx.fill();

    // Scratches and weathering
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      const sx = Math.random() * 256;
      const sy = Math.random() * 256;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (Math.random() - 0.5) * 30, sy + (Math.random() - 0.5) * 30);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('hazard', tex);
    return tex;
  }

  public static getRustedMetal(): THREE.CanvasTexture {
    if (this.cache.has('rust')) return this.cache.get('rust')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(0, 0, 256, 256);

    // Rust specks
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillStyle = Math.random() > 0.4 ? 'rgba(154, 52, 18, 0.4)' : 'rgba(120, 53, 15, 0.3)';
      ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('rust', tex);
    return tex;
  }

  public static getZombieFlesh(): THREE.CanvasTexture {
    if (this.cache.has('flesh')) return this.cache.get('flesh')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#4d5c48'; // sickly greenish grey
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = Math.floor(Math.random() * 40 + 40);
      const g = Math.floor(Math.random() * 40 + 60);
      const b = Math.floor(Math.random() * 30 + 40);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Veins
    ctx.strokeStyle = 'rgba(70, 20, 25, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      let x = Math.random() * 256;
      let y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (Math.random() - 0.5) * 30;
        y += (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('flesh', tex);
    return tex;
  }

  public static getIndustrialTransformer(): THREE.CanvasTexture {
    if (this.cache.has('transformer')) return this.cache.get('transformer')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Industrial dark steel casing
    ctx.fillStyle = '#272b30';
    ctx.fillRect(0, 0, 256, 256);

    // Heat sink horizontal cooling fins
    ctx.fillStyle = '#1e2226';
    for (let y = 16; y < 240; y += 8) {
      ctx.fillRect(16, y, 224, 4);
    }

    // High-voltage caution yellow accents
    ctx.fillStyle = '#eab308';
    ctx.fillRect(16, 8, 224, 4);
    ctx.fillRect(16, 244, 224, 4);

    // Rivet bolts along borders
    ctx.fillStyle = '#64748b';
    for (let x = 20; x <= 236; x += 24) {
      ctx.beginPath();
      ctx.arc(x, 10, 2.5, 0, Math.PI * 2);
      ctx.arc(x, 246, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('transformer', tex);
    return tex;
  }

  public static getMarbleTile(): THREE.CanvasTexture {
    if (this.cache.has('marble')) return this.cache.get('marble')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Civic monument polished marble base
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 256, 256);

    // Tile border groove
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 254);

    // Organic marble veins
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
    ctx.lineWidth = 1.8;
    for (let v = 0; v < 5; v++) {
      let vx = Math.random() * 256;
      let vy = 0;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      while (vy < 256) {
        vx += (Math.random() - 0.45) * 16;
        vy += Math.random() * 20 + 8;
        ctx.lineTo(vx, vy);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('marble', tex);
    return tex;
  }

  // Realistic Decaying Zombie Skin with mottled necrosis, lesions & veins
  public static getRealisticZombieSkin(): THREE.CanvasTexture {
    if (this.cache.has('realistic_flesh')) return this.cache.get('realistic_flesh')!;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Pale mottled cadaverous base
    ctx.fillStyle = '#5c6454';
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    // Organic noise grain
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * TEX_SIZE;
      const y = Math.random() * TEX_SIZE;
      const r = Math.floor(Math.random() * 50 + 60);
      const g = Math.floor(Math.random() * 50 + 75);
      const b = Math.floor(Math.random() * 40 + 55);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 2.5, 2.5);
    }

    // Bruised purple & dark necrosis patches
    for (let i = 0; i < 22; i++) {
      const cx = Math.random() * TEX_SIZE;
      const cy = Math.random() * TEX_SIZE;
      const r = Math.random() * 45 + 15;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, Math.random() > 0.5 ? 'rgba(70, 25, 40, 0.65)' : 'rgba(30, 45, 25, 0.7)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Branching necrotic vascular networks (varicose veins)
    ctx.strokeStyle = 'rgba(55, 15, 25, 0.7)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) {
      let vx = Math.random() * TEX_SIZE;
      let vy = Math.random() * TEX_SIZE;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      for (let s = 0; s < 7; s++) {
        vx += (Math.random() - 0.5) * 45;
        vy += (Math.random() - 0.5) * 45;
        ctx.lineTo(vx, vy);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('realistic_flesh', tex);
    return tex;
  }

  // Realistic Expanding Blood Pool Decal
  public static getBloodPool(): THREE.CanvasTexture {
    if (this.cache.has('blood_pool')) return this.cache.get('blood_pool')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 256, 256);

    // Dark coagulated center
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 115);
    grad.addColorStop(0, '#4a0000');
    grad.addColorStop(0.5, '#7a0505');
    grad.addColorStop(0.85, '#990000');
    grad.addColorStop(1, 'transparent');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(128, 128, 110, 0, Math.PI * 2);
    ctx.fill();

    // Irregular splatter arms
    ctx.fillStyle = '#6b0404';
    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 95 + 20;
      const rad = Math.random() * 12 + 3;
      const px = 128 + Math.cos(angle) * dist;
      const py = 128 + Math.sin(angle) * dist;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('blood_pool', tex);
    return tex;
  }

  // Charred Explosive Scorch Mark (blast residue — never blood-colored)
  public static getScorchMark(): THREE.CanvasTexture {
    if (this.cache.has('scorch_mark')) return this.cache.get('scorch_mark')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 256);

    // Sooty blast center
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 116);
    grad.addColorStop(0, 'rgba(10,9,8,0.95)');
    grad.addColorStop(0.4, 'rgba(22,19,16,0.82)');
    grad.addColorStop(0.72, 'rgba(36,31,26,0.45)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(128, 128, 112, 0, Math.PI * 2);
    ctx.fill();

    // Radial soot streaks blasted outward
    for (let i = 0; i < 55; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 98 + 22;
      const rad = Math.random() * 9 + 2;
      ctx.fillStyle = `rgba(18,15,13,${0.22 + Math.random() * 0.38})`;
      ctx.beginPath();
      ctx.arc(128 + Math.cos(angle) * dist, 128 + Math.sin(angle) * dist, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('scorch_mark', tex);
    return tex;
  }

  // High-velocity Directional Blood Splatter
  public static getBloodSplatter(): THREE.CanvasTexture {
    if (this.cache.has('blood_splatter')) return this.cache.get('blood_splatter')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 256);

    // High velocity elongated impact
    ctx.save();
    ctx.translate(128, 128);

    // Central impact splat
    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 45);
    grad.addColorStop(0, '#550000');
    grad.addColorStop(0.4, '#800202');
    grad.addColorStop(0.85, '#9f0505');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 48, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Elongated spray droplets shooting outward
    ctx.fillStyle = '#7a0505';
    for (let i = 0; i < 40; i++) {
      const angle = (Math.random() - 0.5) * 1.8 + Math.PI / 2; // directional bias
      const dist = Math.random() * 85 + 25;
      const len = Math.random() * 14 + 4;
      const w = Math.random() * 5 + 2;

      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(dist, 0, len, w, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Micro droplets
    ctx.fillStyle = '#650000';
    for (let i = 0; i < 60; i++) {
      const rx = (Math.random() - 0.5) * 200;
      const ry = (Math.random() - 0.5) * 200;
      const rad = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('blood_splatter', tex);
    return tex;
  }

  // Wall Impact Blood Splat with Dripping Runs
  public static getBloodWallDrip(): THREE.CanvasTexture {
    if (this.cache.has('blood_wall_drip')) return this.cache.get('blood_wall_drip')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 256);

    // Upper impact blob
    const grad = ctx.createRadialGradient(128, 80, 5, 128, 80, 60);
    grad.addColorStop(0, '#420000');
    grad.addColorStop(0.6, '#750404');
    grad.addColorStop(0.9, '#8f0606');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(128, 80, 55, 0, Math.PI * 2);
    ctx.fill();

    // Blood drips running down the wall
    const dripCount = 7;
    for (let i = 0; i < dripCount; i++) {
      const dx = 75 + i * 16 + (Math.random() - 0.5) * 10;
      const dripLength = Math.random() * 90 + 50;
      const dripWidth = Math.random() * 4 + 2.5;

      ctx.fillStyle = '#5c0202';
      ctx.beginPath();
      ctx.moveTo(dx - dripWidth / 2, 85);
      ctx.lineTo(dx + dripWidth / 2, 85);
      ctx.lineTo(dx + dripWidth / 3, 85 + dripLength);
      // Tear droplet at bottom
      ctx.arc(dx, 85 + dripLength, dripWidth * 1.2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }

    // Splatter flecks
    ctx.fillStyle = '#6e0404';
    for (let i = 0; i < 35; i++) {
      const fx = Math.random() * 200 + 28;
      const fy = Math.random() * 140 + 20;
      ctx.beginPath();
      ctx.arc(fx, fy, Math.random() * 3.5 + 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('blood_wall_drip', tex);
    return tex;
  }

  // Corrugated Cargo Shipping Container Steel
  public static getShippingContainer(colorHex: string = '#1e3a8a'): THREE.CanvasTexture {
    const key = `container_${colorHex}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, TEX_SIZE, 256);

    // Corrugated vertical ridges
    const ridgeWidth = 32;
    for (let x = 0; x < TEX_SIZE; x += ridgeWidth) {
      // Highlight side
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(x, 0, 6, 256);
      // Main ridge face
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(x + 6, 0, 18, 256);
      // Deep shadow side
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(x + 24, 0, 8, 256);
    }

    // Industrial stencils & serial numbers
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('CRGO-7740-BIO', 40, 50);
    ctx.font = '12px monospace';
    ctx.fillText('MAX WT 32,500 KG', 40, 72);
    ctx.fillText('CONTAINMENT HAZARD', 40, 90);

    // Grime, rust and scrapes
    for (let i = 0; i < 4000; i++) {
      const rx = Math.random() * TEX_SIZE;
      const ry = Math.random() * 256;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(80, 35, 10, 0.25)' : 'rgba(10, 10, 10, 0.3)';
      ctx.fillRect(rx, ry, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, tex);
    return tex;
  }

  // Grand Plaza Ornate Cobblestone / Pavers
  public static getPlazaCobblestone(): THREE.CanvasTexture {
    if (this.cache.has('plaza_cobble')) return this.cache.get('plaza_cobble')!;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Stone base
    ctx.fillStyle = '#2d3036';
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    // Paver grid
    const size = 64;
    for (let y = 0; y < TEX_SIZE; y += size) {
      const offsetX = (y / size) % 2 === 0 ? 0 : size / 2;
      for (let x = -size / 2; x < TEX_SIZE + size; x += size) {
        const px = x + offsetX;
        // Mortar line
        ctx.strokeStyle = '#18191d';
        ctx.lineWidth = 3;
        ctx.strokeRect(px + 1, y + 1, size - 2, size - 2);

        // Stone variation
        const shade = Math.floor(Math.random() * 30 + 40);
        ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
        ctx.fillRect(px + 2, y + 2, size - 4, size - 4);
      }
    }

    // Weathering & blood stains
    for (let i = 0; i < 8; i++) {
      const bx = Math.random() * TEX_SIZE;
      const by = Math.random() * TEX_SIZE;
      const br = Math.random() * 40 + 15;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0, 'rgba(60, 5, 5, 0.45)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('plaza_cobble', tex);
    return tex;
  }

  // Sandbag Burlap Texture
  public static getSandbagBurlap(): THREE.CanvasTexture {
    if (this.cache.has('sandbag')) return this.cache.get('sandbag')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#6b5c3e'; // Sand-khaki
    ctx.fillRect(0, 0, 256, 256);

    // Burlap cross-weave
    ctx.fillStyle = 'rgba(40, 30, 15, 0.35)';
    for (let x = 0; x < 256; x += 4) {
      ctx.fillRect(x, 0, 2, 256);
    }
    for (let y = 0; y < 256; y += 4) {
      ctx.fillRect(0, y, 256, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('sandbag', tex);
    return tex;
  }

  // Tactical Camo Uniform Fabric
  public static getCamoFabric(): THREE.CanvasTexture {
    if (this.cache.has('camo')) return this.cache.get('camo')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#3a4233'; // base olive
    ctx.fillRect(0, 0, 256, 256);

    const colors = ['#282c24', '#555e4b', '#1a1d18', '#6a6857'];
    for (let c = 0; c < colors.length; c++) {
      ctx.fillStyle = colors[c];
      for (let i = 0; i < 18; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const w = Math.random() * 60 + 20;
        const h = Math.random() * 45 + 15;
        ctx.beginPath();
        ctx.ellipse(x, y, w / 2, h / 2, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('camo', tex);
    return tex;
  }

  // Decayed Civilian Ripped Fabric (Blood-stained, dirty thread weave)
  public static getDecayedFabric(): THREE.CanvasTexture {
    if (this.cache.has('decayed_fabric')) return this.cache.get('decayed_fabric')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Grimy cloth base
    ctx.fillStyle = '#3f3c39';
    ctx.fillRect(0, 0, 256, 256);

    // Cross-weave fabric threads
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let x = 0; x < 256; x += 4) {
      ctx.fillRect(x, 0, 2, 256);
    }
    for (let y = 0; y < 256; y += 4) {
      ctx.fillRect(0, y, 256, 2);
    }

    // Dirt and grimy stains
    ctx.fillStyle = 'rgba(15, 12, 10, 0.4)';
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = Math.random() * 40 + 10;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Blood stains / spatter
    ctx.fillStyle = 'rgba(110, 8, 8, 0.55)';
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = Math.random() * 25 + 5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('decayed_fabric', tex);
    return tex;
  }

  // Tactical SWAT Kevlar Mesh & Ballistic Plate Texture
  public static getTacticalArmorPlate(): THREE.CanvasTexture {
    if (this.cache.has('tactical_armor')) return this.cache.get('tactical_armor')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Carbon tactical black
    ctx.fillStyle = '#1c1d22';
    ctx.fillRect(0, 0, 256, 256);

    // Ballistic Kevlar hexagonal / cross pattern
    ctx.strokeStyle = '#2d3139';
    ctx.lineWidth = 1.5;
    const step = 8;
    for (let x = 0; x < 256; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 256, 256);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 256, 256);
      ctx.stroke();
    }

    // Edge scuffs and scratches
    ctx.strokeStyle = 'rgba(160, 165, 175, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 15);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('tactical_armor', tex);
    return tex;
  }
}
