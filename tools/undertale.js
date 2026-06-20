(function () {
  if (window.__utBattle) return;
  window.__utBattle = true;

  // Load pixel font
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
  document.head.appendChild(fontLink);
  const F = '"Press Start 2P", monospace';

  // Canvas dimensions
  const W = 600, H = 520;
  // Battle box (dodge arena) position inside canvas
  const BOX = { x: 175, y: 175, w: 250, h: 140 };

  // ── State ──────────────────────────────────────────────────────
  let state = 'selecting';
  let targetEl = null;
  let elementDeleted = false;

  let enemyName = '', enemyTag = '';
  let enemyHP = 20, enemyMaxHP = 20;
  let playerHP = 20;
  const playerMaxHP = 20;
  let itemsLeft = 3;
  let turnCount = 0;
  let selectedBtn = 0; // 0=FIGHT 1=ACT 2=ITEM 3=MERCY

  // Dialog
  let dialogLines = [];
  let dialogCurrent = '';
  let dialogTyped = 0;
  let dialogTimer = 0;
  let dialogCallback = null;

  // Fight bar
  let barPos = 0, barDir = 1, barSpeed = 0.5;

  // Soul (dodge phase)
  const soul = { x: 0, y: 0 };
  const keys = {};

  // Bullets
  let bullets = [];
  let bulletIntervals = [];
  let enemyTurnTimer = 0;
  let enemyTurnDuration = 5;

  // Render
  let canvas, ctx;
  let raf = null;
  let lastTime = 0;

  // ── Selecting Phase ────────────────────────────────────────────
  function enterSelecting() {
    const sty = document.createElement('style');
    sty.id = '__uts';
    sty.textContent = '.__uth { outline: 2px dashed #ff0000 !important; cursor: crosshair !important; }';
    document.head.appendChild(sty);

    const banner = document.createElement('div');
    banner.id = '__utb';
    Object.assign(banner.style, {
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 2147483647, background: '#000',
      color: '#fff', fontFamily: F, fontSize: '11px',
      padding: '10px 16px', textAlign: 'center',
      borderBottom: '2px solid #fff', letterSpacing: '1px',
    });
    banner.textContent = '* Click any element to challenge it to battle!';
    document.body.appendChild(banner);

    let hov = null;

    const onOver = e => {
      if (e.target.id === '__utb') return;
      if (hov) hov.classList.remove('__uth');
      hov = e.target;
      hov.classList.add('__uth');
    };
    const onOut = () => { if (hov) { hov.classList.remove('__uth'); hov = null; } };
    const onClick = e => {
      if (e.target.id === '__utb') return;
      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('mouseout', onOut, true);
      document.removeEventListener('click', onClick, true);
      if (hov) hov.classList.remove('__uth');
      document.getElementById('__uts')?.remove();
      banner.remove();
      initBattle(e.target);
    };

    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout', onOut, true);
    document.addEventListener('click', onClick, true);
  }

  // ── Battle Init ────────────────────────────────────────────────
  function initBattle(el) {
    targetEl = el;
    enemyTag = el.tagName.toLowerCase();
    enemyName = getName(el);
    enemyMaxHP = getBaseHP(el);
    enemyHP = enemyMaxHP;
    playerHP = playerMaxHP;
    itemsLeft = 3;
    turnCount = 0;
    elementDeleted = false;
    bullets = [];
    bulletIntervals = [];
    soul.x = BOX.x + BOX.w / 2;
    soul.y = BOX.y + BOX.h / 2;

    const overlay = document.createElement('div');
    overlay.id = '__utov';
    Object.assign(overlay.style, {
      position: 'fixed', inset: 0, background: '#000',
      zIndex: 2147483646, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    });

    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    Object.assign(canvas.style, {
      display: 'block',
      imageRendering: 'pixelated',
      maxWidth: '100vmin',
      maxHeight: '100vmin',
    });

    overlay.appendChild(canvas);
    document.body.appendChild(overlay);
    ctx = canvas.getContext('2d');

    canvas.addEventListener('click', onCanvasClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', e => { keys[e.key] = false; });

    showDialog(
      [`* ${enemyName.toUpperCase().slice(0, 16)} blocks your path!`, `* Its ${enemyTag} aura sends chills down your spine.`],
      enterPlayerTurn
    );

    lastTime = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function getName(el) {
    const txt = el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 16);
    if (txt && txt.length >= 2 && txt.length <= 16) return txt;
    const id = el.id ? `#${el.id}` : '';
    const cl = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/)[0]}` : '';
    return `${el.tagName.toLowerCase()}${id || cl || ''}`;
  }

  function getBaseHP(el) {
    return {
      html: 99, body: 80, main: 65, header: 55, nav: 52,
      section: 48, form: 42, table: 40, article: 35, div: 30,
      footer: 38, button: 20, a: 18, input: 22, textarea: 26,
      p: 18, span: 15, img: 20, h1: 28, h2: 24, h3: 22,
      li: 14, ul: 30, ol: 30, select: 24,
    }[el.tagName.toLowerCase()] || 25;
  }

  // ── Dialog System ──────────────────────────────────────────────
  function showDialog(lines, cb) {
    state = 'dialog';
    dialogLines = [...lines];
    dialogCurrent = dialogLines.shift() || '';
    dialogTyped = 0;
    dialogTimer = 0;
    dialogCallback = cb || null;
  }

  function advanceDialog() {
    if (dialogTyped < dialogCurrent.length) {
      dialogTyped = dialogCurrent.length;
      return;
    }
    if (dialogLines.length > 0) {
      dialogCurrent = dialogLines.shift();
      dialogTyped = 0;
      dialogTimer = 0;
    } else {
      const cb = dialogCallback;
      dialogCallback = null;
      if (cb) cb();
    }
  }

  // ── Player Turn ────────────────────────────────────────────────
  function enterPlayerTurn() {
    state = 'playerTurn';
    bullets = [];
    clearBIs();
  }

  function handleAction() {
    switch (selectedBtn) {
      case 0: // FIGHT
        state = 'fightBar';
        barPos = 0;
        barDir = 1;
        barSpeed = Math.min(0.38 + turnCount * 0.045, 0.9);
        break;
      case 1: // ACT
        showDialog(
          [`* You speak to the ${enemyTag}...`, `* ${enemyName.slice(0, 14)} remains completely silent.`],
          enterEnemyTurn
        );
        break;
      case 2: // ITEM
        if (itemsLeft > 0) {
          const h = 6 + Math.floor(Math.random() * 5);
          playerHP = Math.min(playerMaxHP, playerHP + h);
          itemsLeft--;
          showDialog([`* Monster Candy consumed!`, `* HP restored by ${h}!`], enterEnemyTurn);
        } else {
          showDialog([`* Your bag is completely empty.`], enterEnemyTurn);
        }
        break;
      case 3: // MERCY
        showDialog(
          [`* You offer mercy to the ${enemyTag}...`, `* ${enemyName.slice(0, 14)} ignores you completely!`],
          enterEnemyTurn
        );
        break;
    }
  }

  // ── Fight Bar ──────────────────────────────────────────────────
  function confirmBar() {
    const dist = Math.abs(barPos - 0.5);
    let dmg, msg;
    if      (dist < 0.10) { dmg = 12; msg = '* CRITICAL HIT!!'; }
    else if (dist < 0.32) { dmg = 8;  msg = '* A solid hit!'; }
    else if (dist < 0.46) { dmg = 4;  msg = '* A weak hit.'; }
    else                  { dmg = 0;  msg = '* MISS!'; }

    enemyHP = Math.max(0, enemyHP - dmg);

    if (enemyHP <= 0) {
      showDialog(
        [msg, `* ${enemyName.slice(0, 14)} has been defeated!`],
        enterVictory
      );
    } else {
      showDialog([msg], enterEnemyTurn);
    }
  }

  // ── Enemy Turn ─────────────────────────────────────────────────
  function enterEnemyTurn() {
    state = 'enemyTurn';
    clearBIs();
    bullets = [];
    turnCount++;
    enemyTurnDuration = Math.min(4 + turnCount * 0.35, 9);
    enemyTurnTimer = enemyTurnDuration;
    soul.x = BOX.x + BOX.w / 2;
    soul.y = BOX.y + BOX.h / 2;
    spawnPattern(turnCount % 5);
  }

  function clearBIs() {
    bulletIntervals.forEach(clearInterval);
    bulletIntervals = [];
  }

  // ── Bullet Patterns ────────────────────────────────────────────
  function spawnPattern(p) {
    [patWave, patRain, patSides, patBurst, patChase][p]();
  }

  function B(x, y, vx, vy, sz, col, dmg) {
    bullets.push({ x, y, vx, vy, sz, col, dmg, hit: false });
  }

  function patWave() {
    let n = 0;
    const iv = setInterval(() => {
      if (state !== 'enemyTurn') return;
      n++;
      const fromL = n % 2 === 0;
      const y = BOX.y + 18 + (n % 5) * 24;
      B(fromL ? BOX.x - 10 : BOX.x + BOX.w + 10, y, fromL ? 200 : -200, 0, 6, '#ffffff', 3);
    }, 240);
    bulletIntervals.push(iv);
  }

  function patRain() {
    const iv = setInterval(() => {
      if (state !== 'enemyTurn') return;
      B(
        BOX.x + Math.random() * BOX.w,
        BOX.y - 10,
        (Math.random() - 0.5) * 30,
        105 + Math.random() * 55,
        5, '#88ccff', 3
      );
    }, 110);
    bulletIntervals.push(iv);
  }

  function patSides() {
    let t = 0;
    const iv = setInterval(() => {
      if (state !== 'enemyTurn') return;
      t += 0.35;
      const cy = BOX.y + BOX.h / 2;
      for (let i = -1; i <= 1; i++) {
        B(BOX.x - 10, cy + i * 38 + Math.sin(t + i) * 22, 175, 0, 7, '#ff8800', 4);
      }
    }, 440);
    bulletIntervals.push(iv);
  }

  function patBurst() {
    const blast = () => {
      if (state !== 'enemyTurn') return;
      const cx = BOX.x + BOX.w * (0.2 + Math.random() * 0.6);
      const cy = BOX.y + BOX.h * (0.2 + Math.random() * 0.6);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        B(cx, cy, Math.cos(a) * 105, Math.sin(a) * 105, 6, '#ff4455', 4);
      }
    };
    blast();
    const iv = setInterval(blast, 1050);
    bulletIntervals.push(iv);
  }

  function patChase() {
    const iv = setInterval(() => {
      if (state !== 'enemyTurn') return;
      const ang = Math.atan2(
        soul.y - (BOX.y - 10),
        soul.x - (BOX.x + BOX.w / 2)
      ) + (Math.random() - 0.5) * 0.45;
      const spd = 85 + turnCount * 10;
      B(BOX.x + BOX.w / 2, BOX.y - 10, Math.cos(ang) * spd, Math.sin(ang) * spd, 8, '#ff00ff', 5);
    }, 850);
    bulletIntervals.push(iv);
  }

  // ── Victory / Defeat ───────────────────────────────────────────
  function enterVictory() {
    state = 'victory';
    clearBIs();
    if (targetEl && !elementDeleted) {
      elementDeleted = true;
      Object.assign(targetEl.style, {
        transition: 'opacity 0.7s ease, transform 0.7s ease',
        opacity: '0',
        transform: 'scale(0.1)',
      });
      setTimeout(() => { targetEl?.remove(); targetEl = null; }, 750);
    }
  }

  function endBattle() {
    clearBIs();
    document.removeEventListener('keydown', onKeyDown);
    canvas?.removeEventListener('click', onCanvasClick);
    cancelAnimationFrame(raf);
    document.getElementById('__utov')?.remove();
    delete window.__utBattle;
  }

  // ── Game Loop ──────────────────────────────────────────────────
  function loop(t) {
    const dt = Math.min((t - lastTime) / 1000, 0.05);
    lastTime = t;
    update(dt);
    draw();
    if (state !== 'victory' && state !== 'defeat') {
      raf = requestAnimationFrame(loop);
    } else {
      setTimeout(endBattle, 3500);
    }
  }

  function update(dt) {
    if (state === 'dialog') {
      dialogTimer += dt;
      dialogTyped = Math.min(Math.floor(dialogTimer * 36), dialogCurrent.length);
    }

    if (state === 'enemyTurn') {
      let dx = 0, dy = 0;
      if (keys['ArrowLeft']  || keys['a']) dx--;
      if (keys['ArrowRight'] || keys['d']) dx++;
      if (keys['ArrowUp']    || keys['w']) dy--;
      if (keys['ArrowDown']  || keys['s']) dy++;
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        soul.x += (dx / len) * 120 * dt;
        soul.y += (dy / len) * 120 * dt;
      }
      soul.x = Math.max(BOX.x + 9, Math.min(BOX.x + BOX.w - 9, soul.x));
      soul.y = Math.max(BOX.y + 9, Math.min(BOX.y + BOX.h - 9, soul.y));

      for (const b of bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (!b.hit && Math.hypot(b.x - soul.x, b.y - soul.y) < 10) {
          b.hit = true;
          playerHP = Math.max(0, playerHP - b.dmg);
          if (playerHP <= 0) { clearBIs(); state = 'defeat'; return; }
        }
      }
      bullets = bullets.filter(b =>
        b.x > BOX.x - 32 && b.x < BOX.x + BOX.w + 32 &&
        b.y > BOX.y - 32 && b.y < BOX.y + BOX.h + 32
      );

      enemyTurnTimer -= dt;
      if (enemyTurnTimer <= 0) enterPlayerTurn();
    }

    if (state === 'fightBar') {
      barPos += barDir * barSpeed * dt;
      if (barPos >= 1) { barPos = 1; barDir = -1; }
      if (barPos <= 0) { barPos = 0; barDir = 1; }
    }
  }

  // ── Draw ───────────────────────────────────────────────────────
  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (state === 'victory') { drawEndScreen(true);  return; }
    if (state === 'defeat')  { drawEndScreen(false); return; }

    drawEnemySprite();
    drawBattleBox();
    drawPlayerHP();

    if      (state === 'enemyTurn')  { drawEnemyTurnIndicator(); drawBullets(); drawSoul(); }
    else if (state === 'playerTurn') { drawButtons(); }
    else if (state === 'fightBar')   { drawFightBar(); }
    else if (state === 'dialog')     { drawDialog(); }
  }

  // Enemy sprite colors per element type
  const ECOLS = {
    button: '#aaffaa', a: '#aaaaff', input: '#ffaaff',
    img: '#ffff88', div: '#ccccff', span: '#ddddff',
    form: '#ffcc88', nav: '#88ccff', header: '#ff88cc',
    footer: '#cc88ff', table: '#88ffcc', h1: '#ffaa88',
    h2: '#ffaa88', h3: '#ffaa88', body: '#ff8888',
  };

  function drawEnemySprite() {
    const cx = 300, cy = 76;
    const col = ECOLS[enemyTag] || '#cccccc';
    const flash = enemyHP < enemyMaxHP * 0.3
      ? 0.3 + 0.3 * Math.sin(Date.now() / 140)
      : 0;

    ctx.save();
    ctx.translate(cx, cy);

    // Body
    ctx.fillStyle = col;
    ctx.fillRect(-30, -24, 60, 48);

    // Tag label stripe on body
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-30, -24, 60, 14);
    ctx.fillStyle = '#000';
    ctx.font = `5px ${F}`;
    ctx.textAlign = 'center';
    ctx.fillText(`<${enemyTag.slice(0, 7)}>`, 0, -13);

    // Angry eyebrows
    ctx.fillStyle = '#333';
    ctx.fillRect(-20, -10, 15, 3);
    ctx.fillRect(5,   -10, 15, 3);

    // Eyes
    ctx.fillStyle = '#111';
    ctx.fillRect(-20, -6, 13, 13);
    ctx.fillRect(7,   -6, 13, 13);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-18, -4, 9, 9);
    ctx.fillRect(9,   -4, 9, 9);

    // Mouth (toothy grin)
    ctx.fillStyle = '#111';
    ctx.fillRect(-16, 14, 32, 7);
    ctx.fillStyle = col;
    for (let t = -14; t <= 12; t += 8)
      ctx.fillRect(t, 15, 4, 5);

    // Low-HP red flash overlay
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,0,0,${flash})`;
      ctx.fillRect(-30, -24, 60, 48);
    }

    ctx.restore();

    // Name
    ctx.fillStyle = '#fff';
    ctx.font = `10px ${F}`;
    ctx.textAlign = 'center';
    ctx.fillText(enemyName.toUpperCase().slice(0, 18), cx, cy + 42);

    // Enemy HP bar
    const bx = 220, by = cy + 50, bw = 160, bh = 10;
    ctx.fillStyle = '#550000';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ff3311';
    ctx.fillRect(bx, by, bw * Math.max(0, enemyHP / enemyMaxHP), bh);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#aaa';
    ctx.font = `7px ${F}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${enemyHP} / ${enemyMaxHP}`, cx, by + 22);
  }

  function drawBattleBox() {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(BOX.x, BOX.y, BOX.w, BOX.h);
  }

  function drawPlayerHP() {
    const y = BOX.y + BOX.h + 18;
    ctx.fillStyle = '#fff';
    ctx.font = `8px ${F}`;
    ctx.textAlign = 'left';
    ctx.fillText('HP', 180, y + 11);

    const bx = 207, bw = 140, bh = 14;
    ctx.fillStyle = '#551100';
    ctx.fillRect(bx, y, bw, bh);
    ctx.fillStyle = playerHP > playerMaxHP * 0.4 ? '#ffff00' : '#ff4444';
    ctx.fillRect(bx, y, bw * (playerHP / playerMaxHP), bh);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, y, bw, bh);

    ctx.fillStyle = '#fff';
    ctx.font = `8px ${F}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${playerHP} / ${playerMaxHP}`, bx + bw + 8, y + 11);
  }

  function drawSoul() {
    ctx.fillStyle = '#ff0000';
    const hx = soul.x, hy = soul.y, s = 4;
    // 5×5 pixel heart grid
    [
      [0,1,0,1,0],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
    ].forEach((row, r) =>
      row.forEach((on, c) => {
        if (on) ctx.fillRect(hx - 10 + c * s, hy - 10 + r * s, s, s);
      })
    );
  }

  function drawBullets() {
    for (const b of bullets) {
      if (b.hit) continue;
      ctx.fillStyle = b.col;
      ctx.fillRect(b.x - b.sz / 2, b.y - b.sz / 2, b.sz, b.sz);
      ctx.fillStyle = b.col + '44';
      ctx.fillRect(b.x - b.sz, b.y - b.sz, b.sz * 2, b.sz * 2);
    }
  }

  function drawEnemyTurnIndicator() {
    // Timer bar above battle box
    const pct = Math.max(0, enemyTurnTimer / enemyTurnDuration);
    ctx.fillStyle = '#003300';
    ctx.fillRect(BOX.x, BOX.y - 9, BOX.w, 5);
    ctx.fillStyle = '#00ff55';
    ctx.fillRect(BOX.x, BOX.y - 9, BOX.w * pct, 5);

    ctx.fillStyle = '#555';
    ctx.font = `6px ${F}`;
    ctx.textAlign = 'center';
    ctx.fillText('USE ARROW KEYS OR WASD TO DODGE', 300, BOX.y - 14);
  }

  function drawButtons() {
    const LABELS = ['FIGHT', 'ACT', 'ITEM', 'MERCY'];
    const COLS   = ['#ff5555', '#ffff55', '#55ff55', '#55ffff'];
    const bw = 106, bh = 32, gap = 8;
    const total = LABELS.length * bw + (LABELS.length - 1) * gap;
    const sx = 300 - total / 2;
    const by = BOX.y + BOX.h + 54;

    LABELS.forEach((lbl, i) => {
      const x = sx + i * (bw + gap);
      const sel = i === selectedBtn;
      ctx.fillStyle = sel ? '#111' : '#000';
      ctx.fillRect(x, by, bw, bh);
      ctx.strokeStyle = sel ? '#fff' : '#444';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(x, by, bw, bh);
      if (sel) {
        ctx.fillStyle = '#ffffff18';
        ctx.fillRect(x, by, bw, bh);
      }
      ctx.fillStyle = sel ? COLS[i] : '#555';
      ctx.font = `9px ${F}`;
      ctx.textAlign = 'center';
      ctx.fillText(lbl, x + bw / 2, by + 21);
    });

    ctx.fillStyle = '#444';
    ctx.font = `6px ${F}`;
    ctx.textAlign = 'center';
    ctx.fillText('← → to select   Z / Enter / Click to confirm', 300, by + 46);
    ctx.fillStyle = '#666';
    ctx.fillText(`CANDY ×${itemsLeft}   [ restores 6-10 HP ]`, 300, by + 60);
  }

  function drawFightBar() {
    const bx = 175, bw = 250, bh = 26;
    const by = BOX.y + BOX.h + 56;

    // Background
    ctx.fillStyle = '#1a0000';
    ctx.fillRect(bx, by, bw, bh);

    // Sweet-spot zone (yellow)
    const zw = 50;
    ctx.fillStyle = '#ffff0030';
    ctx.fillRect(bx + bw / 2 - zw / 2, by, zw, bh);

    // Moving bar
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + barPos * bw - 3, by, 6, bh);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = '#fff';
    ctx.font = `8px ${F}`;
    ctx.textAlign = 'center';
    ctx.fillText('* Stop in the yellow zone!', 300, by - 10);
    ctx.fillStyle = '#555';
    ctx.font = `6px ${F}`;
    ctx.fillText('Z / Enter / Click', 300, by + bh + 16);
  }

  function drawDialog() {
    const bx = 158, bw = 284, bh = 68;
    const by = BOX.y + BOX.h + 46;

    ctx.fillStyle = '#000';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    const shown = dialogCurrent.slice(0, dialogTyped);
    ctx.fillStyle = '#fff';
    ctx.font = `9px ${F}`;
    ctx.textAlign = 'left';
    // Split into lines of ~32 chars each
    const line1 = shown.slice(0, 32);
    const line2 = shown.slice(32, 64);
    const line3 = shown.slice(64, 92);
    ctx.fillText(line1, bx + 10, by + 22);
    if (line2) ctx.fillText(line2, bx + 10, by + 38);
    if (line3) ctx.fillText(line3, bx + 10, by + 54);

    // Blinking advance arrow
    if (dialogTyped >= dialogCurrent.length && Math.floor(Date.now() / 480) % 2) {
      ctx.fillStyle = '#fff';
      ctx.fillText('▼', bx + bw - 16, by + bh - 6);
    }

    ctx.fillStyle = '#444';
    ctx.font = `6px ${F}`;
    ctx.textAlign = 'center';
    ctx.fillText('[Z / Enter / click to advance]', 300, by + bh + 16);
  }

  function drawEndScreen(won) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (won) {
      const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 280);
      ctx.fillStyle = `rgba(255, 255, 0, ${pulse})`;
      ctx.font = `20px ${F}`;
      ctx.textAlign = 'center';
      ctx.fillText('* YOU WON!', 300, 210);

      ctx.fillStyle = '#fff';
      ctx.font = `9px ${F}`;
      ctx.fillText(`${enemyName.toUpperCase().slice(0, 18)} was defeated!`, 300, 258);
      ctx.fillText('* The element has been erased.', 300, 282);
      ctx.fillStyle = '#ffff55';
      ctx.font = `8px ${F}`;
      ctx.fillText('* EXP gained!', 300, 322);
      ctx.fillText('* LOVE increased.', 300, 342);
    } else {
      ctx.fillStyle = '#ff4444';
      ctx.font = `20px ${F}`;
      ctx.textAlign = 'center';
      ctx.fillText('* GAME OVER', 300, 210);

      ctx.fillStyle = '#fff';
      ctx.font = `9px ${F}`;
      ctx.fillText(`${enemyName.toUpperCase().slice(0, 18)} remains.`, 300, 258);
      ctx.fillText('* It was a tough fight.', 300, 282);
      ctx.fillStyle = '#888';
      ctx.font = `8px ${F}`;
      ctx.fillText('* But you can always try again...', 300, 326);
    }
  }

  // ── Input ──────────────────────────────────────────────────────
  function onKeyDown(e) {
    keys[e.key] = true;

    if (state === 'enemyTurn' && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      e.preventDefault();
    } else if (state === 'playerTurn') {
      if (e.key === 'ArrowLeft')  selectedBtn = (selectedBtn + 3) % 4;
      if (e.key === 'ArrowRight') selectedBtn = (selectedBtn + 1) % 4;
      if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter') handleAction();
      e.preventDefault();
    } else if (state === 'fightBar' && (e.key === 'z' || e.key === 'Z' || e.key === 'Enter')) {
      confirmBar();
      e.preventDefault();
    } else if (state === 'dialog' && (e.key === 'z' || e.key === 'Z' || e.key === 'Enter')) {
      advanceDialog();
      e.preventDefault();
    }

    e.stopPropagation();
  }

  function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top)  * (H / rect.height);

    if (state === 'playerTurn') {
      const bw = 106, bh = 32, gap = 8;
      const total = 4 * bw + 3 * gap;
      const sx = 300 - total / 2;
      const by = BOX.y + BOX.h + 54;
      for (let i = 0; i < 4; i++) {
        const bx = sx + i * (bw + gap);
        if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) {
          selectedBtn = i;
          handleAction();
          return;
        }
      }
    }
    if (state === 'fightBar') { confirmBar(); return; }
    if (state === 'dialog')   { advanceDialog(); }
  }

  // ── Kick off ──────────────────────────────────────────────────
  enterSelecting();
})();
