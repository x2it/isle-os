// ============================================================
// 屿 IsleOS v4.1 — 应用 B 组：时钟 / 画板 / 合成器 / 图库 / 设置 / 帮助
// ============================================================
window.N = window.N || {};

(function () {
  'use strict';
  const U = N.util;

  // ============================================================
  // 备份与恢复（数据可携带：跨浏览器 / 跨设备迁移靠它）
  // exportAll：把文件 + 设置打包成 JSON 下载
  // importAll：清空后还原（真实写入，与恢复出厂走同样的清空逻辑）
  // ============================================================
  N.backup = (function () {
    function blobToDataURL(blob) {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error('读取文件失败'));
        r.readAsDataURL(blob);
      });
    }
    function dataURLToBlob(dataURL) {
      const [meta, b64] = String(dataURL).split(',');
      const mime = (meta.match(/:(.*?);/) || [null, 'application/octet-stream'])[1];
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }
    async function exportAll() {
      const files = [];
      const walkRes = await N.vfs.walk('/');
      for (const en of walkRes) {
        if (en.kind === 'file') {
          try { files.push({ path: en.path, data: await blobToDataURL(await N.vfs.readBlob(en.path)) }); } catch (e) { /* 单文件失败忽略 */ }
        }
      }
      const settings = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('nimbus.') === 0) {
          try { settings[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { settings[k] = localStorage.getItem(k); }
        }
      }
      const payload = { app: 'isle', schema: 4, createdAt: Date.now(), files, settings };
      const json = JSON.stringify(payload);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '屿-备份-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return { count: files.length, bytes: json.length };
    }
    async function importAll(file) {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || !Array.isArray(payload.files)) throw new Error('备份文件格式不正确');
      await N.vfs.wipeAll();
      for (const f of payload.files) {
        try { await N.vfs.write(f.path, dataURLToBlob(f.data)); } catch (e) { /* 单文件失败忽略 */ }
      }
      if (payload.settings) {
        Object.keys(payload.settings).forEach(k => localStorage.setItem(k, JSON.stringify(payload.settings[k])));
      }
      return { count: payload.files.length };
    }
    return { exportAll, importAll };
  })();

  // ============================================================
  // 时钟 —— 真实时间 / 秒表 / 倒计时（真实响铃）
  // ============================================================
  N.apps.register({
    id: 'clock', name: '时钟', icon: 'clock',
    bg: 'linear-gradient(135deg,#30d158,#0a8f3c)', w: 420, h: 470, minW: 340, minH: 400,
    render(body, win) {
      body.innerHTML =
        '<div class="app-clock">' +
          '<div class="clock-tabs">' +
            '<button class="clock-tab active" data-tab="clock">时钟</button>' +
            '<button class="clock-tab" data-tab="stopwatch">秒表</button>' +
            '<button class="clock-tab" data-tab="timer">倒计时</button>' +
          '</div>' +
          '<div class="clock-pane" data-pane="clock">' +
            '<svg class="clock-face" viewBox="0 0 100 100">' +
              '<circle class="cface-bg" cx="50" cy="50" r="47" stroke-width="1.5"/>' +
              '<g id="clockTicks"></g>' +
              '<line class="hand h" id="handH" x1="50" y1="50" x2="50" y2="28"/>' +
              '<line class="hand m" id="handM" x1="50" y1="50" x2="50" y2="18"/>' +
              '<line class="hand s" id="handS" x1="50" y1="56" x2="50" y2="14"/>' +
              '<circle class="c-center" cx="50" cy="50" r="2.6"/>' +
            '</svg>' +
            '<div class="clock-digital" id="clkDigital">--:--:--</div>' +
            '<div class="clock-date" id="clkDate"></div>' +
          '</div>' +
          '<div class="clock-pane" data-pane="stopwatch" hidden>' +
            '<div class="stopwatch-val" id="swVal">00:00.00</div>' +
            '<div class="btn-row">' +
              '<button class="btn" id="swToggle">开始</button>' +
              '<button class="btn ghost" id="swLap" disabled>计次</button>' +
              '<button class="btn ghost" id="swReset">重置</button>' +
            '</div>' +
            '<div class="sw-laps" id="swLaps"></div>' +
          '</div>' +
          '<div class="clock-pane" data-pane="timer" hidden>' +
            '<div class="timer-inputs">' +
              '<input id="timerMin" type="number" min="0" max="999" value="3">' +
              '<span>分</span>' +
              '<input id="timerSec" type="number" min="0" max="59" value="0">' +
              '<span>秒</span>' +
            '</div>' +
            '<div class="timer-presets">' +
              [1, 3, 5, 10, 25].map(m => '<button class="tool-btn" data-min="' + m + '">' + m + ' 分钟</button>').join('') +
            '</div>' +
            '<div class="stopwatch-val" id="timerVal">03:00</div>' +
            '<div class="timer-state" id="timerState">就绪</div>' +
            '<div class="btn-row">' +
              '<button class="btn" id="timerToggle">开始</button>' +
              '<button class="btn ghost" id="timerReset">重置</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      // ---- 时钟 tab ----
      const ticksG = body.querySelector('#clockTicks');
      for (let i = 0; i < 12; i++) {
        const a = i * 30 * Math.PI / 180;
        const x1 = 50 + 42 * Math.sin(a), y1 = 50 - 42 * Math.cos(a);
        const x2 = 50 + (i % 3 === 0 ? 37 : 40) * Math.sin(a);
        const y2 = 50 - (i % 3 === 0 ? 37 : 40) * Math.cos(a);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('class', 'c-tick');
        line.setAttribute('opacity', i % 3 === 0 ? '0.9' : '0.35');
        ticksG.appendChild(line);
      }
      const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      let clockTimer = null;
      function tickClock() {
        const d = new Date();
        const ms = d.getMilliseconds();
        const s = d.getSeconds() + ms / 1000;
        const m = d.getMinutes() + s / 60;
        const h = (d.getHours() % 12) + m / 60;
        const deg = (v) => v * 6;
        body.querySelector('#handS').setAttribute('transform', 'rotate(' + deg(s) + ' 50 50)');
        body.querySelector('#handM').setAttribute('transform', 'rotate(' + deg(m) + ' 50 50)');
        body.querySelector('#handH').setAttribute('transform', 'rotate(' + (h * 30) + ' 50 50)');
        const p2 = (n) => String(n).padStart(2, '0');
        body.querySelector('#clkDigital').textContent =
          p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
        body.querySelector('#clkDate').textContent =
          d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · ' + WEEK[d.getDay()];
      }
      tickClock();
      clockTimer = setInterval(tickClock, 200);

      // ---- 秒表 tab（performance.now 真实计时）----
      const swVal = body.querySelector('#swVal');
      const swLaps = body.querySelector('#swLaps');
      const swToggle = body.querySelector('#swToggle');
      const swLapBtn = body.querySelector('#swLap');
      const swReset = body.querySelector('#swReset');
      let swRunning = false, swBase = 0, swAcc = 0, swRaf = null, lapStart = 0;
      function swFmt(ms) {
        const p2 = (n) => String(n).padStart(2, '0');
        return p2(Math.floor(ms / 60000)) + ':' + p2(Math.floor(ms / 1000) % 60) + '.' + p2(Math.floor(ms / 10) % 100);
      }
      function swRender() {
        swVal.textContent = swFmt(swAcc + (swRunning ? performance.now() - swBase : 0));
        swRaf = requestAnimationFrame(swRender);
      }
      swToggle.addEventListener('click', () => {
        if (!swRunning) {
          swBase = performance.now();
          swRunning = true;
          swToggle.textContent = '暂停';
          swLapBtn.disabled = false;
          swRender();
        } else {
          swAcc += performance.now() - swBase;
          swRunning = false;
          cancelAnimationFrame(swRaf);
          swToggle.textContent = '继续';
        }
      });
      swLapBtn.addEventListener('click', () => {
        const total = swAcc + (swRunning ? performance.now() - swBase : 0);
        const lap = total - lapStart;
        lapStart = total;
        const div = document.createElement('div');
        div.className = 'sw-lap';
        const n = document.createElement('span');
        n.textContent = '计次 ' + swLaps.children.length;
        const v = document.createElement('span');
        v.textContent = swFmt(lap) + '  （总 ' + swFmt(total) + '）';
        div.appendChild(n); div.appendChild(v);
        swLaps.prepend(div);
      });
      swReset.addEventListener('click', () => {
        swRunning = false; cancelAnimationFrame(swRaf);
        swAcc = 0; lapStart = 0;
        swVal.textContent = '00:00.00';
        swToggle.textContent = '开始';
        swLapBtn.disabled = true;
        swLaps.innerHTML = '';
      });

      // ---- 倒计时 tab（真实倒计时 + WebAudio 真实响铃）----
      const timerMin = body.querySelector('#timerMin');
      const timerSec = body.querySelector('#timerSec');
      const timerVal = body.querySelector('#timerVal');
      const timerState = body.querySelector('#timerState');
      const timerToggle = body.querySelector('#timerToggle');
      const timerReset = body.querySelector('#timerReset');
      let timerLeft = 180, timerRunning = false, timerEnd = 0, timerInt = null, timerDone = false;
      function tFmt(s) {
        s = Math.max(0, Math.ceil(s));
        const p2 = (n) => String(n).padStart(2, '0');
        const m = Math.floor(s / 60);
        return (m >= 100 ? m : p2(m)) + ':' + p2(s % 60);
      }
      function readInputs() {
        const m = Math.max(0, Math.min(999, parseInt(timerMin.value, 10) || 0));
        const s = Math.max(0, Math.min(59, parseInt(timerSec.value, 10) || 0));
        timerLeft = m * 60 + s;
        timerVal.textContent = tFmt(timerLeft);
      }
      [timerMin, timerSec].forEach(el => el.addEventListener('input', () => { if (!timerRunning) readInputs(); }));
      body.querySelectorAll('.timer-presets .tool-btn').forEach(b => b.addEventListener('click', () => {
        if (timerRunning) return;
        timerMin.value = b.dataset.min;
        timerSec.value = '0';
        readInputs();
      }));
      timerToggle.addEventListener('click', () => {
        if (!timerRunning) {
          if (timerLeft <= 0 || timerDone) { readInputs(); timerDone = false; }
          if (timerLeft <= 0) { timerState.textContent = '请先设置时长'; return; }
          timerEnd = Date.now() + timerLeft * 1000;
          timerRunning = true;
          timerToggle.textContent = '暂停';
          timerState.textContent = '倒计时中…';
          timerInt = setInterval(() => {
            timerLeft = (timerEnd - Date.now()) / 1000;
            timerVal.textContent = tFmt(timerLeft);
            if (timerLeft <= 0) {
              clearInterval(timerInt);
              timerRunning = false;
              timerToggle.textContent = '开始';
              timerDone = true;
              timerState.textContent = '⏰ 时间到！';
              N.sounds.alarm();
              N.notify.toast('⏰ 倒计时结束：时间到！');
            }
          }, 100);
        } else {
          clearInterval(timerInt);
          timerRunning = false;
          timerToggle.textContent = '继续';
          timerState.textContent = '已暂停';
        }
      });
      timerReset.addEventListener('click', () => {
        clearInterval(timerInt);
        timerRunning = false; timerDone = false;
        timerToggle.textContent = '开始';
        timerState.textContent = '就绪';
        readInputs();
      });
      readInputs();

      // tab 切换
      body.querySelectorAll('.clock-tab').forEach(tab => tab.addEventListener('click', () => {
        body.querySelectorAll('.clock-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        body.querySelectorAll('.clock-pane').forEach(p => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
      }));

      win._onClose = () => {
        clearInterval(clockTimer);
        clearInterval(timerInt);
        cancelAnimationFrame(swRaf);
      };
    }
  });

  // ============================================================
  // 画板 —— 真实 Canvas 绘制 / 下载 PNG / 保存到图库
  // ============================================================
  N.apps.register({
    id: 'paint', name: '画板', icon: 'paint',
    bg: 'linear-gradient(135deg,#ff6482,#ee2b70)', w: 680, h: 520, minW: 480, minH: 420,
    render(body, win) {
      body.innerHTML =
        '<div class="app-paint">' +
          '<div class="paint-tools">' +
            '<button class="tool-btn active" data-tool="brush">画笔</button>' +
            '<button class="tool-btn" data-tool="eraser">橡皮</button>' +
            '<span class="swatches" id="paintSwatches"></span>' +
            '<input type="color" id="paintColor" value="#1d1d1f" title="自定义颜色">' +
            '<input type="range" id="paintSize" min="1" max="40" value="4">' +
            '<span class="paint-size-val" id="paintSizeVal">4px</span>' +
            '<span style="flex:1"></span>' +
            '<button class="tool-btn" data-act="save">保存到图库</button>' +
            '<button class="tool-btn" data-act="download">下载 PNG</button>' +
            '<button class="tool-btn" data-act="clear">清空</button>' +
          '</div>' +
          '<div class="paint-canvas-wrap"><canvas id="paintCanvas" width="1000" height="640"></canvas></div>' +
        '</div>';

      const canvas = body.querySelector('#paintCanvas');
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let tool = 'brush';
      let color = '#1d1d1f';
      let size = 4;
      const COLORS = ['#1d1d1f', '#ffffff', '#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#5e5ce6', '#ff2d78'];
      const swWrap = body.querySelector('#paintSwatches');
      COLORS.forEach((c, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch' + (i === 0 ? ' active' : '');
        b.style.background = c;
        b.title = c;
        b.addEventListener('click', () => {
          color = c;
          body.querySelector('#paintColor').value = c === '#ffffff' ? '#ffffff' : c;
          swWrap.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
          b.classList.add('active');
          setTool('brush');
        });
        swWrap.appendChild(b);
      });
      const colorInput = body.querySelector('#paintColor');
      colorInput.addEventListener('input', () => {
        color = colorInput.value;
        swWrap.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        setTool('brush');
      });
      const sizeInput = body.querySelector('#paintSize');
      const sizeVal = body.querySelector('#paintSizeVal');
      sizeInput.addEventListener('input', () => { size = +sizeInput.value; sizeVal.textContent = size + 'px'; });

      function setTool(t) {
        tool = t;
        body.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
      }
      body.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

      // 真实指针绘制（支持鼠标 / 触摸 / 触控笔）
      let drawing = false, lastX = 0, lastY = 0;
      function pos(e) {
        const r = canvas.getBoundingClientRect();
        return {
          x: (e.clientX - r.left) * canvas.width / r.width,
          y: (e.clientY - r.top) * canvas.height / r.height
        };
      }
      canvas.addEventListener('pointerdown', (e) => {
        drawing = true;
        const p = pos(e);
        lastX = p.x; lastY = p.y;
        canvas.setPointerCapture(e.pointerId);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        // 单点也画出圆点
        ctx.lineTo(lastX + 0.01, lastY + 0.01);
        ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
        ctx.lineWidth = tool === 'eraser' ? size * 3 : size;
        ctx.stroke();
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
        ctx.lineWidth = tool === 'eraser' ? size * 3 : size;
        ctx.stroke();
        lastX = p.x; lastY = p.y;
      });
      canvas.addEventListener('pointerup', () => { drawing = false; });
      canvas.addEventListener('pointercancel', () => { drawing = false; });

      body.querySelector('[data-act="clear"]').addEventListener('click', async () => {
        const ok = await N.modal.confirm({ title: '清空画布', message: '当前未保存的内容将丢失。', okText: '清空', danger: true });
        if (!ok) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });
      body.querySelector('[data-act="download"]').addEventListener('click', () => {
        canvas.toBlob((blob) => {
          if (!blob) { N.notify.toast('导出失败'); return; }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'isle-画板-' + Date.now() + '.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 3000);
          N.notify.toast('已下载 PNG（' + U.fmtSize(blob.size) + '）');
        }, 'image/png');
      });
      body.querySelector('[data-act="save"]').addEventListener('click', () => {
        canvas.toBlob(async (blob) => {
          if (!blob) { N.notify.toast('保存失败'); return; }
          try {
            const path = await N.vfs.write('/图库/画板-' + Date.now() + '.png', blob);
            document.dispatchEvent(new CustomEvent('nimbus-fs-change', { detail: { dir: '/图库' } }));
            N.notify.toast('已保存到 ' + path);
          } catch (err) { N.notify.toast('保存失败：' + err.message); }
        }, 'image/png');
      });
    }
  });

  // ============================================================
  // 合成器 —— WebAudio 真实发声，键盘 + 鼠标可弹奏
  // ============================================================
  N.apps.register({
    id: 'synth', name: '合成器', icon: 'synth',
    bg: 'linear-gradient(135deg,#bf5af2,#7b2ff7)', w: 700, h: 380, minW: 520, minH: 330,
    render(body, win) {
      const SEMIS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
      const NAMES = ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5', 'C#5', 'D5', 'D#5', 'E5'];
      const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
      const BLACK = [1, 3, 6, 8, 10, 13, 15];

      body.innerHTML =
        '<div class="app-synth">' +
          '<div class="synth-controls">' +
            '<span>波形</span>' +
            '<select id="synthWave"><option value="sine">正弦</option><option value="triangle">三角</option><option value="square">方波</option><option value="sawtooth">锯齿</option></select>' +
            '<span>音量</span>' +
            '<input type="range" id="synthVol" min="0" max="100" value="55">' +
            '<span>八度</span>' +
            '<button class="tool-btn" id="synthOctDown">−</button>' +
            '<b id="synthOctVal" style="min-width:26px;text-align:center;color:var(--text)">0</b>' +
            '<button class="tool-btn" id="synthOctUp">＋</button>' +
          '</div>' +
          '<div class="synth-keys" id="synthKeys"></div>' +
          '<div class="synth-hint">点击琴键，或用键盘 A W S E D F T G Y H U J K O L P ; 弹奏</div>' +
        '</div>';

      const keysWrap = body.querySelector('#synthKeys');
      const waveEl = body.querySelector('#synthWave');
      const volEl = body.querySelector('#synthVol');
      const octEl = body.querySelector('#synthOctVal');
      let octave = 0;
      const active = new Map();  // semi -> {osc, gain}

      const keyEls = {};
      SEMIS.forEach((semi, i) => {
        const el = document.createElement('div');
        el.className = 'skey' + (BLACK.includes(semi) ? ' black' : '');
        el.dataset.semi = semi;
        const name = document.createElement('span');
        name.className = 'sk-name';
        name.textContent = NAMES[i];
        el.appendChild(name);
        const kb = Object.keys(KEYMAP).find(k => KEYMAP[k] === semi);
        if (kb) {
          const kk = document.createElement('span');
          kk.className = 'sk-key';
          kk.textContent = kb.toUpperCase();
          el.appendChild(kk);
        }
        keysWrap.appendChild(el);
        keyEls[semi] = el;
      });

      function freqOf(semi) {
        return 261.6255653 * Math.pow(2, (semi + octave * 12) / 12);
      }
      function noteOn(semi) {
        if (active.has(semi)) return;
        const ctx = N.audio.get();
        if (!ctx) { N.notify.toast('当前浏览器不支持 WebAudio'); return; }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = waveEl.value;
        osc.frequency.value = freqOf(semi);
        const v = (parseInt(volEl.value, 10) / 100) * 0.32;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, v), ctx.currentTime + 0.012);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        active.set(semi, { osc, gain });
        keyEls[semi] && keyEls[semi].classList.add('pressed');
      }
      function noteOff(semi) {
        const n = active.get(semi);
        if (!n) return;
        active.delete(semi);
        try {
          n.gain.gain.cancelScheduledValues(N.audio.ctx.currentTime);
          n.gain.gain.setTargetAtTime(0.0001, N.audio.ctx.currentTime, 0.07);
          n.osc.stop(N.audio.ctx.currentTime + 0.4);
        } catch (e) { /* 忽略 */ }
        keyEls[semi] && keyEls[semi].classList.remove('pressed');
      }

      keysWrap.addEventListener('pointerdown', (e) => {
        const key = e.target.closest('.skey');
        if (!key) return;
        noteOn(+key.dataset.semi);
        const release = () => noteOff(+key.dataset.semi);
        key.addEventListener('pointerup', release, { once: true });
        key.addEventListener('pointerleave', release, { once: true });
      });

      function onKeyDown(e) {
        if (win.classList.contains('minimized') || !win.classList.contains('focused')) return;
        if (e.target.closest('input, textarea, select')) return;
        if (e.repeat) return;
        const semi = KEYMAP[e.key.toLowerCase()];
        if (semi === undefined) return;
        noteOn(semi);
      }
      function onKeyUp(e) {
        const semi = KEYMAP[e.key.toLowerCase()];
        if (semi !== undefined) noteOff(semi);
      }
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      win._onClose = () => {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        Array.from(active.keys()).forEach(noteOff);
      };

      body.querySelector('#synthOctDown').addEventListener('click', () => { octave = Math.max(-2, octave - 1); octEl.textContent = octave > 0 ? '+' + octave : octave; });
      body.querySelector('#synthOctUp').addEventListener('click', () => { octave = Math.min(2, octave + 1); octEl.textContent = octave > 0 ? '+' + octave : octave; });
    }
  });

  // ============================================================
  // 图库 —— 真实生成艺术 + 上传 + 设为壁纸（存真实文件）
  // ============================================================
  N.apps.register({
    id: 'gallery', name: '图库', icon: 'gallery',
    bg: 'linear-gradient(135deg,#ff9f2e,#ff6a88)', w: 620, h: 460, minW: 460, minH: 380,
    render(body, win) {
      body.innerHTML =
        '<div class="app-gallery">' +
          '<div class="gallery-bar">' +
            '<button class="btn" id="galGen">✨ 生成新图</button>' +
            '<button class="tool-btn" id="galUpload">上传图片</button>' +
            '<span class="gcount" id="galCount"></span>' +
            '<input type="file" id="galFile" accept="image/*" multiple hidden>' +
          '</div>' +
          '<div class="gallery-grid" id="galGrid"></div>' +
        '</div>';

      const grid = body.querySelector('#galGrid');
      const countEl = body.querySelector('#galCount');
      const fileEl = body.querySelector('#galFile');
      const DIR = '/图库';

      // 程序化生成真实艺术图（真实像素数据，非占位）
      const PALETTES = [
        { base: 'rgba(10,18,48', blobs: ['rgba(10,132,255', 'rgba(94,92,230', 'rgba(100,210,255', 'rgba(255,255,255'] },
        { base: 'rgba(255,150,90', blobs: ['rgba(255,106,136', 'rgba(255,214,10', 'rgba(255,153,172', 'rgba(120,60,255'] },
        { base: 'rgba(16,60,44', blobs: ['rgba(113,178,128', 'rgba(48,209,88', 'rgba(255,214,10', 'rgba(230,255,220'] },
        { base: 'rgba(30,8,50', blobs: ['rgba(123,47,247', 'rgba(191,90,242', 'rgba(255,45,120', 'rgba(10,132,255'] },
        { base: 'rgba(15,32,39', blobs: ['rgba(44,83,100', 'rgba(100,255,218', 'rgba(255,150,90', 'rgba(30,144,255'] }
      ];

      function genArt(palette, w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = palette.base + ',1)';
        ctx.fillRect(0, 0, w, h);
        const blobCount = 7 + Math.floor(Math.random() * 5);
        for (let i = 0; i < blobCount; i++) {
          const x = Math.random() * w;
          const y = Math.random() * h;
          const r = h * (0.25 + Math.random() * 0.55);
          const col = palette.blobs[Math.floor(Math.random() * palette.blobs.length)];
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, col + ',' + (0.5 + Math.random() * 0.4) + ')');
          g.addColorStop(1, col + ',0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
        // 细碎星点
        for (let i = 0; i < 90; i++) {
          ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + Math.random() * 0.55) + ')';
          const s = Math.random() * 2 + 0.4;
          ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
        }
        // 暗角
        const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.38)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
        return c;
      }

      async function ensureSeed() {
        const entries = await N.vfs.list(DIR);
        const hasImg = entries.some(e => e.kind === 'file' && U.isImageName(e.name));
        if (hasImg) return;
        for (let i = 0; i < 4; i++) {
          const canvas = genArt(PALETTES[i % PALETTES.length], 1024, 640);
          const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          await N.vfs.write(DIR + '/生成艺术-' + (i + 1) + '.png', blob);
        }
      }

      async function refresh() {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-2);font-size:13px;padding:30px 0;">加载中…</div>';
        let entries;
        try { entries = await N.vfs.list(DIR); }
        catch (err) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-2);padding:30px 0;">读取失败：' + U.esc(err.message) + '</div>'; return; }
        const imgs = entries.filter(e => e.kind === 'file' && U.isImageName(e.name));
        countEl.textContent = imgs.length + ' 张图片 · ' + DIR;
        grid.innerHTML = '';
        if (!imgs.length) {
          grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-2);font-size:13px;padding:30px 0;">图库为空，点击上方「生成新图」或「上传图片」</div>';
        }
        imgs.forEach(en => {
          const cell = document.createElement('div');
          cell.className = 'g-cell';
          const img = document.createElement('img');
          img.alt = en.name;
          img.loading = 'lazy';
          const path = DIR + '/' + en.name;
          N.vfs.readBlob(path).then(blob => {
            const url = URL.createObjectURL(blob);
            img.onload = () => URL.revokeObjectURL(url);
            img.src = url;
          }).catch(() => { cell.remove(); });
          const name = document.createElement('span');
          name.className = 'g-name';
          name.textContent = en.name + ' · ' + U.fmtSize(en.size);
          cell.appendChild(img);
          cell.appendChild(name);
          cell.addEventListener('click', () => lightbox(path, en.name));
          grid.appendChild(cell);
        });
      }

      function lightbox(path, name) {
        const old = body.querySelector('.g-lightbox');
        if (old) old.remove();
        const box = document.createElement('div');
        box.className = 'g-lightbox';
        const img = document.createElement('img');
        N.vfs.readBlob(path).then(blob => {
          const url = URL.createObjectURL(blob);
          img.onload = () => URL.revokeObjectURL(url);
          img.src = url;
        });
        const actions = document.createElement('div');
        actions.className = 'g-actions';
        const setWp = document.createElement('button');
        setWp.className = 'btn';
        setWp.textContent = '设为壁纸';
        const dl = document.createElement('button');
        dl.className = 'btn ghost';
        dl.textContent = '下载';
        const del = document.createElement('button');
        del.className = 'btn danger';
        del.textContent = '删除';
        const close = document.createElement('button');
        close.className = 'btn ghost';
        close.textContent = '关闭';
        setWp.addEventListener('click', async () => {
          try { await N.wallpaper.applyFile(path); N.notify.toast('壁纸已更新：' + name); }
          catch (err) { N.notify.toast('失败：' + err.message); }
        });
        dl.addEventListener('click', async () => {
          try {
            const blob = await N.vfs.readBlob(path);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 3000);
            N.notify.toast('已开始下载：' + name);
          } catch (err) { N.notify.toast('失败：' + err.message); }
        });
        del.addEventListener('click', async () => {
          const ok = await N.modal.confirm({ title: '删除图片', message: '确定删除「' + name + '」？若它是当前壁纸，壁纸将恢复为渐变。', okText: '删除', danger: true });
          if (!ok) return;
          try {
            await N.vfs.remove(path);
            const wall = N.state.get('wall', {});
            if (wall.type === 'file' && wall.path === path) await N.wallpaper.restore();
            box.remove();
            N.notify.toast('已删除：' + name);
            refresh();
          } catch (err) { N.notify.toast('删除失败：' + err.message); }
        });
        close.addEventListener('click', () => box.remove());
        actions.appendChild(setWp); actions.appendChild(dl); actions.appendChild(del); actions.appendChild(close);
        box.appendChild(img); box.appendChild(actions);
        body.querySelector('.app-gallery').appendChild(box);
      }

      body.querySelector('#galGen').addEventListener('click', async () => {
        try {
          const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
          const canvas = genArt(palette, 1024, 640);
          const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          const path = await N.vfs.write(DIR + '/生成艺术-' + Date.now() + '.png', blob);
          N.notify.toast('已生成：' + path);
          refresh();
        } catch (err) { N.notify.toast('生成失败：' + err.message); }
      });
      body.querySelector('#galUpload').addEventListener('click', () => fileEl.click());
      fileEl.addEventListener('change', async () => {
        const files = Array.from(fileEl.files || []);
        fileEl.value = '';
        let ok = 0;
        for (const f of files) {
          try { await N.vfs.write(DIR + '/' + f.name, f); ok += 1; }
          catch (e) { /* 单个失败继续 */ }
        }
        N.notify.toast('上传完成：' + ok + ' 张');
        refresh();
      });

      // 其他应用（如画板）写入 /图库 时自动刷新（真实联动）
      const onFsChange = (e) => { if (e.detail && e.detail.dir === DIR) refresh(); };
      document.addEventListener('nimbus-fs-change', onFsChange);
      win._onClose = () => document.removeEventListener('nimbus-fs-change', onFsChange);

      (async () => {
        try { await ensureSeed(); } catch (e) { /* 生成失败不阻塞浏览 */ }
        refresh();
      })();
    }
  });

  // ============================================================
  // 设置 —— 全部真实生效的开关 + 真实存储管理
  // ============================================================
  N.apps.register({
    id: 'settings', name: '设置', icon: 'settings',
    bg: 'linear-gradient(135deg,#8e8e93,#48484a)', w: 540, h: 500, minW: 420, minH: 420,
    render(body) {
      body.innerHTML =
        '<div class="app-settings">' +
          '<h2>外观</h2>' +
          '<div class="set-row"><div><div>主题</div><div class="sub">跟随系统时自动切换深浅色</div></div>' +
            '<div class="seg" id="themeSeg">' +
              '<button data-v="light">浅色</button><button data-v="dark">深色</button><button data-v="auto">自动</button>' +
            '</div></div>' +
          '<div class="set-row"><div><div>毛玻璃效果</div><div class="sub">窗口与 Dock 使用半透明材质</div></div><button class="sw" id="swGlass"></button></div>' +
          '<div class="set-row"><div><div>开机动画</div><div class="sub">下次打开页面时生效</div></div><button class="sw" id="swBoot"></button></div>' +
          '<h2>声音</h2>' +
          '<div class="set-row"><div><div>系统音效</div><div class="sub">通知与开机音（不影响合成器）</div></div><button class="sw" id="swSound"></button></div>' +
          '<h2>壁纸</h2>' +
          '<div class="wp-grid" id="setWpGrid"></div>' +
          '<div style="margin-top:10px;"><button class="tool-btn" id="setGallery">从图库选择图片壁纸</button></div>' +
          '<h2>存储</h2>' +
          '<div class="set-row"><div><div>文件系统</div><div class="sub" id="fsModeSub">检测中…</div></div><span class="tag" id="fsModeTag">—</span></div>' +
          '<div class="set-row" style="display:block;"><div style="display:flex;justify-content:space-between;"><div>存储用量</div><span class="tag" id="storeTxt">—</span></div>' +
            '<div class="storage-bar"><i id="storeBar" style="width:0%"></i></div>' +
            '<div class="sub">浏览器为本站分配的配额与当前用量</div></div>' +
          '<h2>备份与迁移</h2>' +
          '<div class="set-row" style="display:block;"><div><div>把小岛打包带走</div><div class="sub">导出一个备份文件（含全部文件与设置），可存到本地或云盘；换浏览器 / 换设备后，用「恢复备份」原样还原。</div></div>' +
            '<div class="set-btns">' +
              '<button class="tool-btn" id="btnBackup">备份我的小岛</button>' +
              '<button class="tool-btn" id="btnRestore">恢复备份</button>' +
            '</div>' +
            '<input type="file" id="restoreFile" accept="application/json,.json" hidden>' +
          '</div>' +
          '<h2>账户</h2>' +
          '<div class="set-row"><div><div>锁定屏幕</div><div class="sub">离开电脑前锁一下</div></div><button class="btn" id="btnLock">锁定</button></div>' +
          '<div class="set-row"><div><div>欢迎向导</div><div class="sub">重新设置称呼、外观与壁纸</div></div><button class="btn ghost" id="btnWizard">重新运行</button></div>' +
          '<h2>重置</h2>' +
          '<div class="set-row"><div><div>恢复出厂</div><div class="sub">清除全部设置、便签与文件，回到最初的向导</div></div><button class="btn danger" id="btnReset">恢复出厂</button></div>' +
          '<h2>关于</h2>' +
          '<div class="set-row"><div><div>屿 IsleOS</div><div class="sub">一座装在浏览器里的小岛，也是一台可对话的实验性 AI 系统</div></div><span class="tag ok">v' + N.VERSION + '</span></div>' +
        '</div>';

      // 主题三态
      const themeSeg = body.querySelector('#themeSeg');
      function syncThemeSeg() {
        const cur = N.state.get('theme', 'light');
        themeSeg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === cur));
      }
      themeSeg.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        N.state.set('theme', b.dataset.v);
        N.theme.apply(b.dataset.v);
        syncThemeSeg();
        N.notify.toast('主题已切换：' + b.textContent);
      });
      syncThemeSeg();

      // 真实开关
      function bindSwitch(id, key, def, onChange, immediate) {
        const el = body.querySelector(id);
        el.classList.toggle('on', N.state.get(key, def));
        el.addEventListener('click', () => {
          const next = !N.state.get(key, def);
          N.state.set(key, next);
          el.classList.toggle('on', next);
          if (immediate) onChange(next);
        });
      }
      bindSwitch('#swGlass', 'glass', true, (v) => { N.glass.apply(v); N.notify.toast('毛玻璃效果已' + (v ? '开启' : '关闭')); }, true);
      bindSwitch('#swBoot', 'boot', true, (v) => N.notify.toast('已保存，下次打开页面时' + (v ? '播放' : '跳过') + '开机动画'));
      bindSwitch('#swSound', 'sound', true, (v) => N.notify.toast('系统音效已' + (v ? '开启' : '关闭')));

      // 壁纸
      const wpGrid = body.querySelector('#setWpGrid');
      const wall = N.state.get('wall', { type: 'gradient', index: 0 });
      N.wallpaper.GRADS.forEach((g, i) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'wp-chip ' + g + ((wall.type === 'gradient' && wall.index === i) ? ' active' : '');
        chip.title = '渐变壁纸 ' + (i + 1);
        chip.addEventListener('click', () => {
          N.wallpaper.applyGradient(i);
          N.notify.toast('壁纸已更新');
          wpGrid.querySelectorAll('.wp-chip').forEach((c, idx) => c.classList.toggle('active', idx === i));
        });
        wpGrid.appendChild(chip);
      });
      body.querySelector('#setGallery').addEventListener('click', () => N.wm.openApp('gallery'));

      // 存储
      (async () => {
        const tag = body.querySelector('#fsModeTag');
        const sub = body.querySelector('#fsModeSub');
        if (N.vfs.mode === 'opfs') {
          tag.textContent = 'OPFS';
          tag.className = 'tag ok';
          sub.textContent = '文件保存在浏览器中，刷新后依然存在';
        } else {
          tag.textContent = '内存';
          tag.className = 'tag warn';
          sub.textContent = '当前浏览器不支持持久化存储，刷新后文件会丢失';
        }
        const est = await N.vfs.usage();
        if (est && est.quota) {
          const pct = Math.max(0.4, est.usage / est.quota * 100);
          body.querySelector('#storeBar').style.width = Math.min(100, pct) + '%';
          body.querySelector('#storeTxt').textContent = U.fmtSize(est.usage) + ' / ' + U.fmtSize(est.quota) + '（' + pct.toFixed(2) + '%）';
        } else {
          body.querySelector('#storeTxt').textContent = '配额未知';
        }
      })();

      // 锁定屏幕 / 欢迎向导 / 恢复出厂
      body.querySelector('#btnLock').addEventListener('click', () => N.shell.lock());
      body.querySelector('#btnWizard').addEventListener('click', () => N.shell.showWelcome());
      body.querySelector('#btnReset').addEventListener('click', () => N.shell.factoryReset());

      // 备份与恢复（真实数据迁移）
      const restoreFile = body.querySelector('#restoreFile');
      body.querySelector('#btnBackup').addEventListener('click', async () => {
        try {
          const r = await N.backup.exportAll();
          N.notify.toast('已导出备份：' + r.count + ' 个文件（' + U.fmtSize(r.bytes) + '）');
        } catch (e) { N.notify.toast('备份失败：' + e.message); }
      });
      body.querySelector('#btnRestore').addEventListener('click', () => restoreFile.click());
      restoreFile.addEventListener('change', async () => {
        const file = restoreFile.files && restoreFile.files[0];
        if (!file) return;
        const ok = await N.modal.confirm({
          title: '恢复备份',
          message: '将清空当前小岛的全部文件与设置，再用备份文件原样还原（真实写入，不可撤销）。确定继续？',
          okText: '开始恢复', danger: true
        });
        if (!ok) { restoreFile.value = ''; return; }
        try {
          const r = await N.backup.importAll(file);
          N.notify.toast('恢复完成：' + r.count + ' 个文件，即将重新载入…');
          setTimeout(() => location.reload(), 700);
        } catch (e) {
          N.notify.toast('恢复失败：' + e.message);
          restoreFile.value = '';
        }
      });
    }
  });

  // ============================================================
  // 帮助
  // ============================================================
  N.apps.register({
    id: 'help', name: '帮助', icon: 'help',
    bg: 'linear-gradient(135deg,#64d2ff,#0a84ff)', w: 560, h: 500, minW: 420, minH: 380,
    render(body) {
      const fsMode = N.vfs.mode === 'opfs'
        ? '<span class="tag ok">持久化</span>：文件保存在本机浏览器里，刷新、关机重开都还在。'
        : '<span class="tag warn">内存</span>：当前浏览器不支持持久化存储，刷新后文件会丢失。';
      body.innerHTML =
        '<div class="app-help">' +
          '<h2>这是什么</h2>' +
          '<p class="help-lead">屿（IsleOS）是一座装在浏览器里的小岛，也是一个<span class="hl">实验性的 AI 交互系统</span>。' +
          '它不依赖任何服务器账号：所有窗口、文件、对话都跑在你的浏览器里。' +
          '你可以把它当成一个轻量桌面来用，也可以把它当成一台「能动手的 AI」——' +
          '用自然语言让它打开应用、读写文件、换壁纸、锁屏。</p>' +
          '<p>它完全开源、零后端、零追踪：你在这里输入的一切、保存的一切，都只属于你这台设备。</p>' +
          '<h2>数据去哪了（持久化与迁移）</h2>' +
          '<ul>' +
            '<li>当前存储模式：' + fsMode + '</li>' +
            '<li><b>同一台浏览器 / 同一设备</b>：刷新页面、关机再开、甚至几天后再来，文件、便签、设置、智能体对话都还在——它们真真切切写在浏览器文件系统（OPFS）与本地存储里。</li>' +
            '<li><b>换浏览器或换设备</b>：数据不会自动跟过去（这是浏览器安全隔离，谁都绕不开）。解决办法是「设置 → 备份与迁移 → 备份我的小岛」，导出一个 JSON 文件；再到新环境「恢复备份」，一切原样回来。</li>' +
            '<li><b>恢复出厂</b>：在「屿」菜单或「设置 → 重置」里，会真的清掉全部文件、便签与设置，然后重新走一遍上岛向导。</li>' +
          '</ul>' +
          '<h2>智能体（和 AI 对话并让它动手）</h2>' +
          '<ul>' +
            '<li>打开「智能体」，默认是<b>本地指令模式</b>：能开应用、换壁纸、读文件、查设备信息、发通知，全部真实生效。</li>' +
            '<li>想在「本地」之上真正自由对话？点智能体右上角齿轮，填一个 OpenAI 兼容的 <code>/chat/completions</code> 接口地址与密钥，即可升级为<b>云端智能体</b>——它会调用系统工具，真的去操作系统（开应用、读写文件等）。</li>' +
            '<li>密钥只存在本机浏览器，不会上传到系统之外；部分接口可能因跨域（CORS）无法在浏览器直连，这是接口侧限制。</li>' +
          '</ul>' +
          '<h2>浏览器</h2>' +
          '<ul>' +
            '<li>「浏览器」用真实网页内嵌方式访问站点，可直接搜索或输入网址。</li>' +
            '<li>部分网站（多数国内站点、登录页）会禁止被网页嵌入，此时显示空白——点「↗ 新窗口打开」即可在原站打开。</li>' +
            '<li>系统不会收集你在浏览器里输入的任何内容。</li>' +
          '</ul>' +
          '<h2>窗口操作</h2>' +
          '<ul>' +
            '<li>拖动标题栏移动窗口；拖动右 / 下 / 右下边缘调整大小</li>' +
            '<li>双击标题栏最大化 / 还原；红绿灯对应关闭、最小化、最大化</li>' +
            '<li>Dock 中运行中的应用带圆点：点击置前，再点最小化</li>' +
            '<li>桌面空白处右键：换壁纸、深色模式、新建文件</li>' +
          '</ul>' +
          '<h2>文件系统</h2>' +
          '<ul>' +
            '<li>「文件」「终端」「画板」「图库」共用同一套文件系统</li>' +
            '<li>上传的文件、画板的作品都在 <b>/图库</b> 等目录里，可设为壁纸、可下载</li>' +
          '</ul>' +
          '<h2>终端常用命令</h2>' +
          '<table class="cmd-table">' +
            '<tr><th>命令</th><th>说明</th></tr>' +
            '<tr><td><code>ls / cd / pwd</code></td><td>列目录 / 切换目录 / 当前路径</td></tr>' +
            '<tr><td><code>mkdir / touch / rm [-r]</code></td><td>创建目录 / 创建文件 / 删除（目录需 -r）</td></tr>' +
            '<tr><td><code>cat / echo x &gt; f / echo x &gt;&gt; f</code></td><td>查看 / 覆盖写入 / 追加写入</td></tr>' +
            '<tr><td><code>cp [-r] / mv</code></td><td>复制 / 移动改名</td></tr>' +
            '<tr><td><code>tree / du / df</code></td><td>目录树 / 大小统计 / 存储配额</td></tr>' +
            '<tr><td><code>neofetch / open / wall / theme</code></td><td>系统信息 / 打开应用或文件 / 换壁纸 / 换主题</td></tr>' +
          '</table>' +
          '<h2>电源与安全</h2>' +
          '<ul>' +
            '<li>点左上角「屿」菜单：锁定屏幕、重新启动、关机、恢复出厂</li>' +
            '<li>锁屏后点按任意位置解锁；关机后点电源键重新开机</li>' +
            '<li>恢复出厂会清掉小岛上的一切，然后重新走一遍上岛向导</li>' +
          '</ul>' +
          '<h2>小技巧</h2>' +
          '<ul>' +
            '<li>倒计时到点会响铃提醒</li>' +
            '<li>合成器支持键盘弹奏：A W S E D F 一排黑白键</li>' +
            '<li>把本站添加到主屏幕，可以全屏使用（PWA）</li>' +
          '</ul>' +
        '</div>';
    }
  });
})();
