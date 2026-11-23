/* =====================================================================
   scene.js — Monta o cenário 3D usando só geometrias do Three.js
   (mesa, paleta de madeira, poças de tinta, pote, pincel, mascote e
   efeitos). Nenhum modelo ou imagem externa: as texturas de madeira e
   a superfície da tinta são desenhadas em <canvas>.

   Coordenadas: a mesa é o plano XZ (y = 0). A câmera olha de +Z, de
   cima. Então "-Z" é o topo da tela e "+Z" é a parte de baixo.
   ===================================================================== */
(function (global) {
  'use strict';

  const PALETTE_TOP = 0.41; // altura da face de cima da paleta

  // Posições dos elementos sobre a paleta
  const LAYOUT = {
    paletteCenter: { x: 0, z: 0.7 },
    pot: { x: 0, z: 0.9, scale: 0.92, inner: 1.5 }, // inner = raio útil para pincel/mistura
    puddles: [
      { key: 'r', x: 0.0, z: -2.5 },
      { key: 'y', x: -3.1, z: 1.15 },
      { key: 'b', x: 3.1, z: 1.15 },
    ],
    hole: { x: 2.25, z: 3.75, r: 0.6 },
    mascot: { x: -3.9, z: -3.3 },
    park: { x: 3.3, z: 3.0 }, // onde o pincel descansa antes do primeiro toque
  };

  const rgbColor = rgb => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2]);

  /** Material "tinta brilhante" usado nas poças, no pincel e no mascote. */
  function glossy(color) {
    return new THREE.MeshPhysicalMaterial({
      color, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12,
    });
  }

  // ------------------------------------------------------------------
  // Texturas procedurais
  // ------------------------------------------------------------------
  function woodTexture(base, grain, opts = {}) {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    // veios da madeira: linhas onduladas suaves
    for (let i = 0; i < 110; i++) {
      const y0 = Math.random() * S;
      const amp = 3 + Math.random() * 9;
      const freq = (Math.PI * 2 * (1 + Math.floor(Math.random() * 4))) / S; // repete sem emenda
      g.strokeStyle = grain;
      g.globalAlpha = 0.04 + Math.random() * 0.1;
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath();
      for (let x = 0; x <= S; x += 8) {
        const y = y0 + Math.sin(x * freq + i) * amp;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    if (opts.planks) { // tábuas da mesa
      g.globalAlpha = 0.35;
      g.fillStyle = grain;
      for (let y = 0; y < S; y += S / 4) g.fillRect(0, y, S, 3);
    }
    if (opts.splats) { // respingos de tinta na mesa
      const cols = ['#ee2126', '#ffd81a', '#2166e6', '#2bb34a', '#ff8a1a', '#a24be0', '#ff5fa2'];
      for (let i = 0; i < 26; i++) {
        g.globalAlpha = 0.35 + Math.random() * 0.3;
        g.fillStyle = cols[i % cols.length];
        const x = Math.random() * S, y = Math.random() * S, r = 3 + Math.random() * 9;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          g.arc(x + (Math.random() - 0.5) * r * 5, y + (Math.random() - 0.5) * r * 5, r * (0.2 + Math.random() * 0.35), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  // ------------------------------------------------------------------
  // Mesa e luzes
  // ------------------------------------------------------------------
  function buildTable(scene) {
    const tex = woodTexture('#c98d55', '#7a4a22', { planks: true, splats: true });
    tex.repeat.set(4, 4);
    const geo = new THREE.PlaneGeometry(80, 80);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    mesh.position.y = -0.001;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  function buildLights(scene) {
    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x8a6040, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 0.62);
    sun.position.set(-5, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = sun.shadow.camera;
    s.left = -8; s.right = 8; s.top = 8; s.bottom = -8; s.near = 1; s.far = 30;
    sun.shadow.bias = -0.0015;
    sun.shadow.radius = 4;
    scene.add(sun);
  }

  // ------------------------------------------------------------------
  // Paleta de madeira (forma orgânica + furo do dedão)
  // ------------------------------------------------------------------
  function paletteOutlinePoint(a) {
    const rx = 4.65, rz = 4.75;
    const mod = 1 + 0.045 * Math.sin(3 * a + 0.6) + 0.03 * Math.cos(2 * a);
    return { x: Math.cos(a) * rx * mod, z: LAYOUT.paletteCenter.z + Math.sin(a) * rz * mod };
  }

  function buildPalette(scene) {
    // A forma é desenhada no plano XY e depois deitada; shape.y = -mundo.z
    const shape = new THREE.Shape();
    const N = 96;
    for (let i = 0; i < N; i++) {
      const p = paletteOutlinePoint((i / N) * Math.PI * 2);
      if (i === 0) shape.moveTo(p.x, -p.z); else shape.lineTo(p.x, -p.z);
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(LAYOUT.hole.x, -LAYOUT.hole.z, LAYOUT.hole.r, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.12,
      bevelSegments: 4, curveSegments: 40,
    });
    geo.rotateX(-Math.PI / 2); // deita a forma: extrusão vira altura (+Y)
    geo.translate(0, 0.08, 0); // base em y = 0, topo em PALETTE_TOP

    const tex = woodTexture('#e7ab68', '#a5652c');
    tex.repeat.set(0.11, 0.11);
    tex.offset.set(0.5, 0.5); // tira a emenda da textura do meio da paleta
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // ------------------------------------------------------------------
  // Poças de tinta base (bolhas achatadas + "chantilly" no meio)
  // ------------------------------------------------------------------
  function buildPuddle(scene, def) {
    const rgb = global.MixLogic.BASE_PAINTS[def.key].rgb;
    const mat = glossy(rgbColor(rgb));
    const group = new THREE.Group();
    group.position.set(def.x, PALETTE_TOP, def.z);
    const inner = new THREE.Group(); // é ele que "balança" ao ser tocado
    group.add(inner);

    const sph = new THREE.SphereGeometry(1, 40, 20);
    const add = (x, y, z, sx, sy, sz) => {
      const m = new THREE.Mesh(sph, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      m.receiveShadow = true;
      inner.add(m);
      return m;
    };
    // base irregular
    add(0, 0, 0, 0.95, 0.2, 0.88);
    add(0.42, 0, 0.22, 0.55, 0.19, 0.52);
    add(-0.46, 0, 0.18, 0.52, 0.19, 0.52);
    add(0.15, 0, -0.46, 0.55, 0.18, 0.48);
    add(-0.32, 0, -0.38, 0.5, 0.18, 0.46);
    // montinho com pontinha enroladinha
    add(0.04, 0.14, 0, 0.6, 0.3, 0.56);
    add(0.0, 0.36, 0.02, 0.4, 0.24, 0.38);
    add(-0.03, 0.53, 0.03, 0.23, 0.18, 0.22);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 16), mat);
    tip.position.set(-0.08, 0.68, 0.03);
    tip.rotation.z = 0.7;
    inner.add(tip);

    group.userData = { key: def.key, inner, wobbleT: 99 };
    scene.add(group);
    return group;
  }

  // ------------------------------------------------------------------
  // Pote de mistura (cerâmica) + superfície de tinta animada (canvas)
  // ------------------------------------------------------------------
  // Perfil do pote: (raio, altura) — de fora para dentro
  const POT_PROFILE = [
    [0, 0], [1.55, 0], [1.8, 0.07], [1.95, 0.28], [2.02, 0.52], [1.98, 0.62],
    [1.88, 0.63], [1.82, 0.5], [1.72, 0.26], [1.56, 0.14], [0, 0.13],
  ];

  /** Raio interno do pote numa altura h (coordenadas locais do pote). */
  function potInnerRadius(h) {
    if (h <= 0.26) return 1.56 + Math.max(0, h - 0.14) / 0.12 * 0.16 - 0.01;
    return 1.72 + Math.min(1, (h - 0.26) / 0.24) * 0.1 - 0.01;
  }

  function buildPot(scene) {
    const group = new THREE.Group();
    group.position.set(LAYOUT.pot.x, PALETTE_TOP - 0.02, LAYOUT.pot.z);
    group.scale.setScalar(LAYOUT.pot.scale);

    const bowl = new THREE.Mesh(
      new THREE.LatheGeometry(POT_PROFILE.map(p => new THREE.Vector2(p[0], p[1])), 72),
      new THREE.MeshPhysicalMaterial({ color: 0xfbf7ff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide })
    );
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    group.add(bowl);

    // Superfície da tinta: um disco com textura de canvas redesenhada a cada quadro
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const texture = new THREE.CanvasTexture(canvas);
    const discGeo = new THREE.CircleGeometry(1, 64);
    discGeo.rotateX(-Math.PI / 2);
    const surface = new THREE.Mesh(discGeo, new THREE.MeshPhysicalMaterial({
      map: texture, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08,
    }));
    surface.receiveShadow = true;
    surface.visible = false;
    group.add(surface);

    // Setas circulares que pedem "gire!" (aparecem quando há tinta para misturar)
    const ac = document.createElement('canvas');
    ac.width = ac.height = 256;
    const g = ac.getContext('2d');
    g.translate(128, 128);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const a0 = i * (Math.PI * 2 / 3) + 0.25, a1 = a0 + 1.45, R = 108;
      g.shadowColor = 'rgba(0,0,0,0.25)';
      g.shadowBlur = 6;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 13;
      g.beginPath(); g.arc(0, 0, R, a0, a1); g.stroke();
      // ponta da seta
      const tx = Math.cos(a1) * R, ty = Math.sin(a1) * R;
      const dx = -Math.sin(a1), dy = Math.cos(a1); // tangente (sentido horário na tela)
      const nx = Math.cos(a1), ny = Math.sin(a1);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(tx + dx * 20, ty + dy * 20);
      g.lineTo(tx + nx * 17 - dx * 6, ty + ny * 17 - dy * 6);
      g.lineTo(tx - nx * 17 - dx * 6, ty - ny * 17 - dy * 6);
      g.closePath(); g.fill();
    }
    const arrowTex = new THREE.CanvasTexture(ac);
    const arrowGeo = new THREE.PlaneGeometry(4.7, 4.7);
    arrowGeo.rotateX(-Math.PI / 2);
    const arrows = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({
      map: arrowTex, transparent: true, opacity: 0, depthWrite: false,
    }));
    arrows.position.y = 0.68;
    arrows.renderOrder = 2;
    group.add(arrows);

    scene.add(group);
    return { group, bowl, surface, canvas, texture, arrows };
  }

  // ------------------------------------------------------------------
  // Pincel: cerdas + "tinta na ponta" + virola de metal + cabo amarelo.
  // A origem do grupo é a PONTA do pincel; o cabo sobe pelo eixo +Y
  // do subgrupo "tilt", que é inclinado no jogo.
  // ------------------------------------------------------------------
  function buildBrush(scene) {
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.scale.setScalar(0.92);
    root.add(tilt);

    const lathe = pts => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 32);

    const bristleMat = new THREE.MeshStandardMaterial({ color: 0xd9a35b, roughness: 0.85 });
    const bristles = new THREE.Mesh(lathe([[0, 0], [0.1, 0.04], [0.2, 0.16], [0.26, 0.38], [0.27, 0.62], [0.24, 0.82], [0.22, 0.92]]), bristleMat);
    tilt.add(bristles);

    // Camada de tinta que cobre a ponta quando o pincel está carregado
    const coatMat = glossy(new THREE.Color(0xffffff));
    const coating = new THREE.Mesh(lathe([[0, -0.03], [0.125, 0.02], [0.235, 0.16], [0.295, 0.38], [0.3, 0.5], [0.0, 0.53]]), coatMat);
    coating.visible = false;
    coating.scale.setScalar(0.001);
    tilt.add(coating);

    const metal = new THREE.MeshStandardMaterial({ color: 0xcfd6e0, metalness: 0.35, roughness: 0.25 });
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.225, 0.62, 32), metal);
    ferrule.position.y = 1.18;
    tilt.add(ferrule);
    for (const y of [0.92, 1.44]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.035, 10, 32), metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      tilt.add(ring);
    }

    const handleMat = new THREE.MeshPhysicalMaterial({ color: 0xffc91f, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.235, 4.0, 32), handleMat);
    handle.position.y = 3.49;
    tilt.add(handle);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 12), handleMat);
    cap.position.y = 5.49;
    tilt.add(cap);

    tilt.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(root);
    return { root, tilt, bristleMat, coating, coatMat };
  }

  // ------------------------------------------------------------------
  // Mascote: uma gotinha de tinta com a cor da meta
  // ------------------------------------------------------------------
  function buildMascot(scene) {
    const root = new THREE.Group();
    root.position.set(LAYOUT.mascot.x, 0, LAYOUT.mascot.z);
    root.scale.setScalar(1.25);
    const body = new THREE.Group(); // gira/pula sem mudar para onde o rosto aponta
    root.add(body);

    const mat = glossy(new THREE.Color(0x8b3fd9));

    // Perfil de gota: x = sen(t)·sen(t/2), y = cos(t), de baixo para cima
    const pts = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const t = Math.PI - (i / N) * Math.PI;
      const x = Math.sin(t) * Math.sin(t / 2) * 0.8;
      const y = (Math.cos(t) + 1) * 0.72;
      pts.push(new THREE.Vector2(Math.max(0, x), y));
    }
    const drop = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat);
    drop.position.y = 0.18;
    drop.castShadow = true;
    body.add(drop);

    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1c1030, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), white);
      eye.scale.set(1, 1.15, 0.6);
      eye.position.set(0.2 * s, 0.82, 0.5);
      body.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), black);
      pupil.scale.set(1, 1.1, 0.6);
      pupil.position.set(0.2 * s, 0.8, 0.585);
      body.add(pupil);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), white);
      shine.position.set(0.2 * s + 0.035, 0.85, 0.65);
      body.add(shine);
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16),
        new THREE.MeshBasicMaterial({ color: 0xff7fb0, transparent: true, opacity: 0.55 }));
      cheek.position.set(0.37 * s, 0.6, 0.5);
      cheek.rotation.y = 0.55 * s;
      body.add(cheek);
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mat);
      arm.scale.set(1, 0.8, 0.9);
      arm.position.set(0.66 * s, 0.55, 0.1);
      body.add(arm);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mat);
      foot.scale.set(1, 0.6, 1.3);
      foot.position.set(0.22 * s, 0.09, 0.08);
      foot.castShadow = true;
      body.add(foot);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 8, 20, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x7a1030, roughness: 0.4 }));
    mouth.rotation.z = Math.PI; // meia-lua para baixo = sorriso
    mouth.position.set(0, 0.6, 0.57);
    body.add(mouth);

    scene.add(root);
    return { root, body, mat };
  }

  // ------------------------------------------------------------------
  // Efeitos: gotas caindo, ondinhas, confete e estrelas
  // ------------------------------------------------------------------
  function starShape(R, r) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 ? r : R;
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    s.closePath();
    return s;
  }

  function buildEffects(scene) {
    const drops = [], ripples = [], confetti = [], stars = [];

    const dropGeo = new THREE.SphereGeometry(0.1, 12, 8);
    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(dropGeo, glossy(new THREE.Color(0xffffff)));
      mesh.visible = false;
      scene.add(mesh);
      drops.push({ mesh, vel: new THREE.Vector3(), alive: false, floorY: 0, delay: 0 });
    }

    const ringGeo = new THREE.RingGeometry(0.72, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
      mesh.visible = false;
      mesh.renderOrder = 3;
      scene.add(mesh);
      ripples.push({ mesh, t: 0, alive: false });
    }

    const confGeo = new THREE.PlaneGeometry(0.22, 0.13);
    const confColors = [0xee2126, 0xffd81a, 0x2166e6, 0x2bb34a, 0xff8a1a, 0xa24be0, 0xff5fa2, 0x29c5d6];
    for (let i = 0; i < 160; i++) {
      const mesh = new THREE.Mesh(confGeo, new THREE.MeshBasicMaterial({ color: confColors[i % confColors.length], side: THREE.DoubleSide }));
      mesh.visible = false;
      scene.add(mesh);
      confetti.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, alive: false });
    }

    const starGeo = new THREE.ExtrudeGeometry(starShape(0.5, 0.22), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
    starGeo.center();
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffa000, emissiveIntensity: 0.45, roughness: 0.3 });
    for (let i = 0; i < 9; i++) {
      const mesh = new THREE.Mesh(starGeo, starMat);
      mesh.visible = false;
      scene.add(mesh);
      stars.push({ mesh, vel: new THREE.Vector3(), life: 0, alive: false });
    }

    const rnd = (a, b) => a + Math.random() * (b - a);

    const fx = {
      /** Gotas saem da ponta do pincel e caem na tinta do pote. */
      spawnDrops(from, rgb, floorY, count = 7) {
        let n = 0;
        for (const d of drops) {
          if (d.alive) continue;
          d.alive = true;
          d.mesh.visible = true;
          d.mesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
          d.mesh.position.set(from.x + rnd(-0.15, 0.15), from.y + rnd(0.0, 0.25), from.z + rnd(-0.15, 0.15));
          d.vel.set(rnd(-1.4, 1.4), rnd(1.5, 3.2), rnd(-1.4, 1.4));
          d.mesh.scale.setScalar(rnd(0.7, 1.4));
          d.floorY = floorY;
          if (++n >= count) break;
        }
        this.spawnRipple(from.x, floorY, from.z, rgb, 1.0);
      },
      spawnRipple(x, y, z, rgb, size = 0.6) {
        const r = ripples.find(p => !p.alive);
        if (!r) return;
        r.alive = true; r.t = 0; r.size = size;
        r.mesh.visible = true;
        r.mesh.position.set(x, y + 0.02, z);
        const c = global.MixLogic.lerp(rgb, [1, 1, 1], 0.35);
        r.mesh.material.color.setRGB(c[0], c[1], c[2]);
      },
      /** Explosão de confete + estrelas para a vitória. */
      burst(center) {
        for (const c of confetti) {
          c.alive = true; c.life = rnd(2.2, 3.4);
          c.mesh.visible = true;
          c.mesh.position.set(center.x + rnd(-0.6, 0.6), center.y + 0.5, center.z + rnd(-0.6, 0.6));
          const a = Math.random() * Math.PI * 2, s = rnd(2, 6.5);
          c.vel.set(Math.cos(a) * s, rnd(7, 13), Math.sin(a) * s);
          c.spin.set(rnd(-10, 10), rnd(-10, 10), rnd(-10, 10));
        }
        stars.forEach((s, i) => {
          s.alive = true; s.life = 0;
          s.mesh.visible = true;
          s.mesh.position.set(center.x, center.y + 0.8, center.z);
          const a = (i / stars.length) * Math.PI * 2;
          s.vel.set(Math.cos(a) * 3.2, rnd(5, 7.5), Math.sin(a) * 2.4);
          s.mesh.scale.setScalar(0.01);
        });
      },
      update(dt, camera) {
        for (const d of drops) {
          if (!d.alive) continue;
          d.vel.y -= 16 * dt;
          d.mesh.position.addScaledVector(d.vel, dt);
          if (d.mesh.position.y <= d.floorY && d.vel.y < 0) {
            d.alive = false;
            d.mesh.visible = false;
            this.spawnRipple(d.mesh.position.x, d.floorY, d.mesh.position.z, [d.mesh.material.color.r, d.mesh.material.color.g, d.mesh.material.color.b], 0.45);
          }
        }
        for (const r of ripples) {
          if (!r.alive) continue;
          r.t += dt / 0.55;
          if (r.t >= 1) { r.alive = false; r.mesh.visible = false; continue; }
          r.mesh.scale.setScalar(r.size * (0.15 + r.t * 0.85));
          r.mesh.material.opacity = 0.85 * (1 - r.t);
        }
        for (const c of confetti) {
          if (!c.alive) continue;
          c.life -= dt;
          c.vel.y -= 11 * dt;
          c.vel.multiplyScalar(1 - 1.6 * dt); // resistência do ar
          c.mesh.position.addScaledVector(c.vel, dt);
          c.mesh.rotation.x += c.spin.x * dt;
          c.mesh.rotation.y += c.spin.y * dt;
          c.mesh.rotation.z += c.spin.z * dt;
          if (c.life <= 0 || c.mesh.position.y < 0.05) { c.alive = false; c.mesh.visible = false; }
        }
        for (const s of stars) {
          if (!s.alive) continue;
          s.life += dt;
          s.vel.y -= 7 * dt;
          s.mesh.position.addScaledVector(s.vel, dt);
          s.mesh.quaternion.copy(camera.quaternion); // estrela sempre de frente para a câmera
          s.mesh.rotateZ(s.life * 4);
          const k = s.life < 0.25 ? s.life / 0.25 : Math.max(0, 1 - (s.life - 1.2) / 0.6);
          s.mesh.scale.setScalar(Math.max(0.001, k * 0.62));
          if (s.life > 1.8) { s.alive = false; s.mesh.visible = false; }
        }
      },
    };
    return fx;
  }

  // ------------------------------------------------------------------
  /** Pontos que a câmera precisa enquadrar (usado no ajuste de tela). */
  function getFitPoints() {
    const pts = [];
    for (let i = 0; i < 32; i++) {
      const p = paletteOutlinePoint((i / 32) * Math.PI * 2);
      pts.push(new THREE.Vector3(p.x * 1.03, PALETTE_TOP, p.z + (p.z > 0 ? 0.15 : 0)));
    }
    pts.push(new THREE.Vector3(LAYOUT.mascot.x, 2.1, LAYOUT.mascot.z));
    pts.push(new THREE.Vector3(LAYOUT.mascot.x - 0.9, 0, LAYOUT.mascot.z));
    for (const p of LAYOUT.puddles) pts.push(new THREE.Vector3(p.x, PALETTE_TOP + 0.85, p.z));
    return pts;
  }

  function build(scene) {
    buildLights(scene);
    buildTable(scene);
    const palette = buildPalette(scene);
    const puddles = LAYOUT.puddles.map(def => buildPuddle(scene, def));
    const pot = buildPot(scene);
    const brush = buildBrush(scene);
    const mascot = buildMascot(scene);
    const fx = buildEffects(scene);
    return { palette, puddles, pot, brush, mascot, fx };
  }

  global.World = { build, getFitPoints, potInnerRadius, PALETTE_TOP, LAYOUT };
})(window);
