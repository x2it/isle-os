// ============================================================
// 屿 IsleOS v4.1 — 应用 A 组：关于本机 / 文件 / 终端 / 计算器 / 便签
// ============================================================
window.N = window.N || {};

// ---------- 共享工具 ----------
N.util = {
  fmtSize(bytes) {
    if (bytes === null || bytes === undefined) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  },
  fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },
  esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  TEXT_EXT: ['txt', 'md', 'json', 'js', 'css', 'html', 'htm', 'log', 'csv', 'xml', 'yml', 'yaml', 'ini', 'conf', 'sh', 'svg'],
  isImageName(name) { return /\.(png|jpe?g|webp|gif|bmp|ico)$/i.test(name); },
  isTextName(name) {
    const ext = name.split('.').pop().toLowerCase();
    return this.TEXT_EXT.includes(ext);
  }
};

(function () {
  'use strict';
  const U = N.util;

  // ============================================================
  // 关于本机 —— 全部真实数据
  // ============================================================
  N.apps.register({
    id: 'about', name: '关于本机', icon: 'rocket',
    bg: 'linear-gradient(135deg,#0a84ff,#5e5ce6)', w: 420, h: 480, minW: 340, minH: 380,
    render(body) {
      const ua = navigator.userAgent;
      let engine = '未知内核';
      let engineMatch = ua.match(/(Edg|Chrome|Firefox|Safari|Version)\/([\d.]+)/);
      if (/Edg\//.test(ua)) engine = 'Edge（Chromium）' + (ua.match(/Edg\/([\d.]+)/) || ['', ''])[1];
      else if (/Chrome\//.test(ua)) engine = 'Chrome ' + (ua.match(/Chrome\/([\d.]+)/) || ['', ''])[1];
      else if (/Firefox\//.test(ua)) engine = 'Firefox ' + (ua.match(/Firefox\/([\d.]+)/) || ['', ''])[1];
      else if (/Safari\//.test(ua)) engine = 'Safari ' + (ua.match(/Version\/([\d.]+)/) || ['', ''])[1];

      let tz = '未知';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '未知'; } catch (e) { /* 忽略 */ }

      body.innerHTML =
        '<div class="app-about">' +
          '<div class="about-logo">' + N.icons.rocket + '</div>' +
          '<h1>屿 IsleOS</h1>' +
          '<div class="ver">版本 ' + N.VERSION + '</div>' +
          '<div class="about-tag">一座装在浏览器里的小岛 · 实验性 AI 交互系统</div>' +
          '<div class="spec-grid" id="aboutSpec"></div>' +
          '<div class="ver" style="font-size:11px;word-break:break-all;line-height:1.5;user-select:text;" id="aboutUA"></div>' +
        '</div>';

      const spec = body.querySelector('#aboutSpec');
      const rows = [
        ['运行环境', engine],
        ['CPU 逻辑核心', navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' 个' : '—'],
        ['设备内存', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '—'],
        ['屏幕分辨率', window.innerWidth + ' × ' + window.innerHeight + '（DPR ' + (window.devicePixelRatio || 1) + '）'],
        ['语言 / 时区', navigator.language + ' · ' + tz],
        ['网络状态', navigator.onLine ? '联网' : '离线'],
      ];
      rows.forEach(([k, v]) => {
        const div = document.createElement('div');
        div.className = 'spec-row';
        const s = document.createElement('span'); s.textContent = k;
        const b = document.createElement('b'); b.textContent = v;
        div.appendChild(s); div.appendChild(b);
        spec.appendChild(div);
      });
      body.querySelector('#aboutUA').textContent = 'UA: ' + ua;

      // 真实存储用量（异步填充）
      const storeRow = document.createElement('div');
      storeRow.className = 'spec-row';
      storeRow.innerHTML = '<span>文件系统</span><b>检测中…</b>';
      spec.appendChild(storeRow);
      (async () => {
        const modeTxt = N.vfs.mode === 'opfs' ? 'OPFS（持久化）' : '内存（刷新后清空）';
        const est = await N.vfs.usage();
        let v = modeTxt;
        if (est && est.quota) v += ' · 已用 ' + U.fmtSize(est.usage) + ' / ' + U.fmtSize(est.quota);
        storeRow.querySelector('b').textContent = v;
      })();
    }
  });

  // ============================================================
  // 计算器 —— 真实四则运算 + 键盘输入
  // ============================================================
  N.apps.register({
    id: 'calc', name: '计算器', icon: 'calc',
    bg: 'linear-gradient(135deg,#5e5ce6,#3634a3)', w: 300, h: 470, minW: 260, minH: 380,
    render(body, win) {
      body.innerHTML =
        '<div class="app-calc">' +
          '<div class="calc-screen"><div class="calc-expr">&nbsp;</div><div class="calc-val">0</div></div>' +
          '<div class="calc-hist"></div>' +
          '<div class="calc-pad"></div>' +
        '</div>';
      const val = body.querySelector('.calc-val');
      const expr = body.querySelector('.calc-expr');
      const hist = body.querySelector('.calc-hist');
      const pad = body.querySelector('.calc-pad');
      const KEYS = ['AC', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='];
      KEYS.forEach(k => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.k = k;
        b.className = k === '=' ? 'eq' : ('÷×−+±%'.includes(k) ? 'op' : (k === 'AC' ? 'fn' : ''));
        b.textContent = k;
        pad.appendChild(b);
      });

      let cur = '0', acc = null, op = null, fresh = true;
      let lastHist = '';
      function show() {
        const n = parseFloat(cur);
        val.textContent = cur === '错误' ? cur : (isNaN(n) ? cur : (cur.length > 13 ? n.toPrecision(10).replace(/\.?0+$/, '') : cur));
      }
      function apply() {
        const b = parseFloat(cur);
        if (op === '+') acc = acc + b;
        else if (op === '−') acc = acc - b;
        else if (op === '×') acc = acc * b;
        else if (op === '÷') acc = b === 0 ? NaN : acc / b;
        else acc = b;
        cur = Number.isFinite(acc) ? String(+parseFloat(acc.toFixed(9))) : '错误';
        expr.innerHTML = '&nbsp;';
      }
      function press(k) {
        if (/[0-9]/.test(k)) { cur = (fresh || cur === '0') ? k : cur + k; fresh = false; }
        else if (k === '.') {
          if (cur === '错误') { cur = '0.'; fresh = false; }
          else if (fresh) { cur = '0.'; fresh = false; }
          else if (!cur.includes('.')) cur += '.';
        }
        else if (k === 'AC') { if (cur !== '0' || op || acc !== null) lastHist = ''; cur = '0'; acc = null; op = null; fresh = true; expr.innerHTML = '&nbsp;'; }
        else if (k === '±') { if (cur !== '错误' && cur !== '0') cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur; }
        else if (k === '%') { if (cur !== '错误') { cur = String(parseFloat(cur) / 100); fresh = true; } }
        else if ('÷×−+'.includes(k)) {
          if (cur === '错误') return;
          if (op && !fresh) apply(); else acc = parseFloat(cur);
          if (!Number.isFinite(acc)) { cur = '错误'; show(); return; }
          op = k; fresh = true; expr.textContent = acc + ' ' + k;
        }
        else if (k === '=') {
          if (op && cur !== '错误') {
            // 先快照左右操作数与运算符，再只计算一次
            // （旧实现在此调用了两次 apply()，导致结果被重复累加：0.1+0.2 得到 0.6）
            const left = acc, oper = op, right = cur;
            apply();
            lastHist = left + ' ' + oper + ' ' + right + ' = ' + cur;
            expr.textContent = left + ' ' + oper + ' ' + right + ' =';
            hist.textContent = lastHist;
            op = null; fresh = true;
          }
        }
        show();
      }
      pad.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (b) press(b.dataset.k);
      });

      // 键盘输入（真实可用；窗口关闭时解除监听）
      function onKey(e) {
        if (win.classList.contains('minimized')) return;
        const map = { '/': '÷', '*': '×', '-': '−', '+': '+', 'Enter': '=', '=': '=', 'Escape': 'AC', '%': '%' };
        let k = null;
        if (/^[0-9]$/.test(e.key)) k = e.key;
        else if (e.key === '.') k = '.';
        else if (e.key === 'Backspace') {
          e.preventDefault();
          if (!fresh && cur.length > 1) { cur = cur.slice(0, -1); show(); }
          else { cur = '0'; fresh = true; show(); }
          return;
        }
        else k = map[e.key] || null;
        if (k) { e.preventDefault(); press(k); }
      }
      document.addEventListener('keydown', onKey);
      win._onClose = () => document.removeEventListener('keydown', onKey);
    }
  });

  // ============================================================
  // 便签 —— 多便签，localStorage 真实持久化 + 导出下载
  // ============================================================
  N.apps.register({
    id: 'notes', name: '便签', icon: 'notes',
    bg: 'linear-gradient(135deg,#ffd85e,#ff9f2e)', w: 560, h: 400, minW: 420, minH: 320,
    render(body) {
      body.innerHTML =
        '<div class="app-notes">' +
          '<div class="notes-side">' +
            '<div class="ns-head"><button class="tool-btn" data-act="new">＋ 新建</button></div>' +
            '<div class="notes-list" id="notesList"></div>' +
          '</div>' +
          '<div class="notes-main">' +
            '<div class="notes-titlebar">' +
              '<input id="noteTitle" placeholder="标题">' +
              '<button class="tool-btn" data-act="export" title="导出为 .txt 下载">导出</button>' +
              '<button class="tool-btn" data-act="del" title="删除当前便签">删除</button>' +
            '</div>' +
            '<textarea id="noteBody" placeholder="随手记点什么…（自动保存）"></textarea>' +
            '<div class="notes-foot"><span id="notesSaved">—</span><span id="notesCount"></span></div>' +
          '</div>' +
        '</div>';

      const listEl = body.querySelector('#notesList');
      const titleEl = body.querySelector('#noteTitle');
      const bodyEl = body.querySelector('#noteBody');
      const savedEl = body.querySelector('#notesSaved');
      const countEl = body.querySelector('#notesCount');

      const KEY = 'nimbus.notes.list';
      function load() {
        try {
          const arr = JSON.parse(localStorage.getItem(KEY));
          if (Array.isArray(arr) && arr.length) return arr;
        } catch (e) { /* 损坏则重建 */ }
        return [{ id: 1, title: '欢迎使用便签', body: '随手记点什么，自动保存。\n写好的便签可以导出为 .txt 带走。', updated: Date.now() }];
      }
      function save() {
        try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) { savedEl.textContent = '保存失败（存储空间不足？）'; }
      }
      let notes = load();
      let curId = notes[0].id;
      let saveTimer = null;

      function cur() { return notes.find(n => n.id === curId) || notes[0]; }

      function renderList() {
        listEl.innerHTML = '';
        notes.forEach(n => {
          const div = document.createElement('div');
          div.className = 'note-item' + (n.id === curId ? ' active' : '');
          const t = document.createElement('div');
          t.className = 'nt-title';
          t.textContent = n.title || '（无标题）';
          const tm = document.createElement('div');
          tm.className = 'nt-time';
          tm.textContent = U.fmtDate(n.updated);
          div.appendChild(t); div.appendChild(tm);
          div.addEventListener('click', () => { curId = n.id; syncEditor(); renderList(); });
          listEl.appendChild(div);
        });
        countEl.textContent = notes.length + ' 条便签';
      }

      function syncEditor() {
        const n = cur();
        titleEl.value = n.title;
        bodyEl.value = n.body;
        savedEl.textContent = '已保存 · ' + U.fmtDate(n.updated);
      }

      function scheduleSave() {
        savedEl.textContent = '输入中…';
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          const n = cur();
          n.title = titleEl.value;
          n.body = bodyEl.value;
          n.updated = Date.now();
          save();
          renderList();
          savedEl.textContent = '已保存 · ' + U.fmtDate(n.updated);
        }, 500);
      }
      titleEl.addEventListener('input', scheduleSave);
      bodyEl.addEventListener('input', scheduleSave);

      body.querySelector('[data-act="new"]').addEventListener('click', () => {
        const n = { id: Date.now(), title: '新便签', body: '', updated: Date.now() };
        notes.unshift(n);
        curId = n.id;
        save(); renderList(); syncEditor();
        titleEl.focus();
      });
      body.querySelector('[data-act="del"]').addEventListener('click', async () => {
        if (notes.length <= 1) { N.notify.toast('至少保留一条便签'); return; }
        const ok = await N.modal.confirm({ title: '删除便签', message: '确定删除「' + (cur().title || '无标题') + '」吗？此操作不可撤销。', okText: '删除', danger: true });
        if (!ok) return;
        notes = notes.filter(n => n.id !== curId);
        curId = notes[0].id;
        save(); renderList(); syncEditor();
        N.notify.toast('便签已删除');
      });
      body.querySelector('[data-act="export"]').addEventListener('click', () => {
        const n = cur();
        const text = (n.title ? n.title + '\n\n' : '') + n.body;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (n.title || '便签') + '.txt';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        N.notify.toast('已导出：' + a.download);
      });

      renderList();
      syncEditor();
    }
  });

  // ============================================================
  // 文件管理器 —— 基于 N.vfs 的真实文件操作
  // ============================================================
  N.apps.register({
    id: 'files', name: '文件', icon: 'files',
    bg: 'linear-gradient(135deg,#3ba0ff,#0a5fd8)', w: 640, h: 440, minW: 460, minH: 340,
    render(body, win, params) {
      body.innerHTML =
        '<div class="app-files">' +
          '<div class="files-toolbar">' +
            '<button class="tool-btn" data-act="up" title="返回上级">↑ 上级</button>' +
            '<button class="tool-btn" data-act="newdir">新建文件夹</button>' +
            '<button class="tool-btn" data-act="newfile">新建文本</button>' +
            '<button class="tool-btn" data-act="upload">上传文件</button>' +
            '<button class="tool-btn" data-act="refresh">刷新</button>' +
            '<span class="files-crumb" id="filesCrumb"></span>' +
          '</div>' +
          '<div class="files-wrap">' +
            '<div class="files-side" id="filesSide"></div>' +
            '<div class="files-main" id="filesMain"></div>' +
          '</div>' +
          '<input type="file" id="filesUpload" multiple hidden>' +
        '</div>';

      const crumbEl = body.querySelector('#filesCrumb');
      const sideEl = body.querySelector('#filesSide');
      const mainEl = body.querySelector('#filesMain');
      const uploadEl = body.querySelector('#filesUpload');
      let cwd = (params && params.path) || '/';
      const QUICK = [['主目录', '/'], ['文稿', '/文稿'], ['图库', '/图库'], ['下载', '/下载']];

      function navigate(path) {
        cwd = N.vfs.resolve('/', path);
        renderSide();
        refresh();
      }

      function renderSide() {
        sideEl.innerHTML = '';
        QUICK.forEach(([label, path]) => {
          const div = document.createElement('div');
          div.className = 'fs-item' + (cwd === path ? ' active' : '');
          div.textContent = label;
          div.addEventListener('click', () => navigate(path));
          sideEl.appendChild(div);
        });
      }

      async function refresh() {
        crumbEl.innerHTML = '';
        const parts = N.vfs.split(cwd);
        const rootB = document.createElement('b');
        rootB.textContent = '屿 /';
        crumbEl.appendChild(rootB);
        parts.forEach(p => { crumbEl.appendChild(document.createTextNode(' ' + p + ' /')); });
        mainEl.innerHTML = '<div class="files-empty">加载中…</div>';
        let entries;
        try { entries = await N.vfs.list(cwd); }
        catch (err) {
          mainEl.innerHTML = '';
          const errDiv = document.createElement('div');
          errDiv.className = 'files-empty';
          errDiv.textContent = '读取失败：' + err.message;
          mainEl.appendChild(errDiv);
          return;
        }
        mainEl.innerHTML = '';
        if (!entries.length) {
          const empty = document.createElement('div');
          empty.className = 'files-empty';
          empty.textContent = '这里还空着 —— 试试上方的新建或上传';
          mainEl.appendChild(empty);
        }
        entries.forEach(en => {
          const row = document.createElement('div');
          row.className = 'file-row';
          row.dataset.name = en.name;
          const icon = document.createElement('div');
          icon.className = 'f-icon';
          if (en.kind === 'directory') icon.innerHTML = N.icons.folder;
          else if (U.isImageName(en.name)) {
            const img = document.createElement('img');
            icon.appendChild(img);
            // 真实缩略图（懒加载 + 用后释放）
            N.vfs.readBlob(cwd === '/' ? '/' + en.name : cwd + '/' + en.name).then(blob => {
              const url = URL.createObjectURL(blob);
              img.onload = () => URL.revokeObjectURL(url);
              img.src = url;
            }).catch(() => { icon.innerHTML = N.icons.file; });
          }
          else icon.innerHTML = N.icons.file;
          const name = document.createElement('span');
          name.className = 'f-name';
          name.textContent = en.name;
          const size = document.createElement('span');
          size.className = 'f-size';
          size.textContent = en.kind === 'file' ? U.fmtSize(en.size) : '—';
          const date = document.createElement('span');
          date.className = 'f-date';
          date.textContent = U.fmtDate(en.mtime);
          row.appendChild(icon); row.appendChild(name); row.appendChild(size); row.appendChild(date);

          row.addEventListener('click', () => {
            mainEl.querySelectorAll('.file-row.selected').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            clearPreview();
            if (en.kind === 'file') openFileInline(en.name);
          });
          row.addEventListener('dblclick', () => {
            if (en.kind === 'directory') navigate(cwd === '/' ? '/' + en.name : cwd + '/' + en.name);
            else openFileInline(en.name);
          });
          row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            rowMenu(e, en);
          });
          mainEl.appendChild(row);
        });
      }

      function clearPreview() {
        mainEl.querySelectorAll('.file-editor, .file-preview, .img-preview').forEach(n => n.remove());
      }

      async function openFileInline(name) {
        clearPreview();
        const path = cwd === '/' ? '/' + name : cwd + '/' + name;
        let blob;
        try { blob = await N.vfs.readBlob(path); }
        catch (err) { N.notify.toast('读取失败：' + err.message); return; }

        if (U.isImageName(name)) {
          const wrap = document.createElement('div');
          wrap.className = 'img-preview';
          const img = document.createElement('img');
          const url = URL.createObjectURL(blob);
          img.onload = () => URL.revokeObjectURL(url);
          img.src = url;
          const actions = document.createElement('div');
          actions.className = 'preview-actions';
          const setWp = document.createElement('button');
          setWp.className = 'btn';
          setWp.textContent = '设为壁纸';
          const dl = document.createElement('button');
          dl.className = 'btn ghost';
          dl.textContent = '下载';
          setWp.addEventListener('click', async () => {
            try {
              await N.wallpaper.applyFile(path);
              N.notify.toast('壁纸已更新：' + name);
            } catch (err) { N.notify.toast('设置失败：' + err.message); }
          });
          dl.addEventListener('click', () => downloadBlob(blob, name));
          actions.appendChild(setWp); actions.appendChild(dl);
          wrap.appendChild(img); wrap.appendChild(actions);
          mainEl.appendChild(wrap);
          wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }

        if (U.isTextName(name)) {
          const text = await blob.text();
          const wrap = document.createElement('div');
          wrap.className = 'file-editor';
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.spellcheck = false;
          const actions = document.createElement('div');
          actions.style.display = 'flex';
          actions.style.gap = '8px';
          const save = document.createElement('button');
          save.className = 'btn';
          save.textContent = '保存到文件';
          const cancel = document.createElement('button');
          cancel.className = 'btn ghost';
          cancel.textContent = '取消编辑';
          const info = document.createElement('span');
          info.className = 'tag';
          info.textContent = U.fmtSize(blob.size);
          save.addEventListener('click', async () => {
            save.disabled = true;
            try {
              await N.vfs.write(path, ta.value);
              N.notify.toast('已保存：' + path);
              info.textContent = U.fmtSize(new Blob([ta.value]).size) + ' · 已保存 ' + U.fmtDate(Date.now());
            } catch (err) { N.notify.toast('保存失败：' + err.message); }
            save.disabled = false;
          });
          cancel.addEventListener('click', () => { ta.value = text; N.notify.toast('已还原为上次保存的内容'); });
          actions.appendChild(save); actions.appendChild(cancel); actions.appendChild(info);
          wrap.appendChild(ta); wrap.appendChild(actions);
          mainEl.appendChild(wrap);
          wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }

        // 其他类型：真实信息 + 下载
        const wrap = document.createElement('div');
        wrap.className = 'file-preview';
        const meta = document.createElement('div');
        meta.textContent = '「' + name + '」\n类型：' + (blob.type || '未知') + '\n大小：' + U.fmtSize(blob.size) + '\n（此类型无法直接预览，可下载查看）';
        const dl = document.createElement('button');
        dl.className = 'btn ghost';
        dl.style.marginTop = '8px';
        dl.textContent = '下载';
        dl.addEventListener('click', () => downloadBlob(blob, name));
        wrap.appendChild(meta);
        wrap.appendChild(dl);
        mainEl.appendChild(wrap);
        wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      function downloadBlob(blob, name) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        N.notify.toast('已开始下载：' + name);
      }

      async function rowMenu(e, en) {
        const path = cwd === '/' ? '/' + en.name : cwd + '/' + en.name;
        const items = [];
        if (en.kind === 'directory') {
          items.push({ label: '打开', action: () => navigate(path) });
        } else {
          items.push({ label: '打开 / 预览', action: () => openFileInline(en.name) });
          if (U.isImageName(en.name)) items.push({ label: '设为壁纸', action: async () => { try { await N.wallpaper.applyFile(path); N.notify.toast('壁纸已更新'); } catch (err) { N.notify.toast('失败：' + err.message); } } });
          items.push({ label: '下载', action: async () => { try { downloadBlob(await N.vfs.readBlob(path), en.name); } catch (err) { N.notify.toast('失败：' + err.message); } } });
        }
        items.push({ sep: true });
        items.push({
          label: '重命名', action: async () => {
            const nn = await N.modal.prompt({ title: '重命名', value: en.name });
            if (nn === null || nn === en.name) return;
            try {
              const np = await N.vfs.rename(path, nn);
              N.notify.toast('已重命名 → ' + np);
              refresh();
            } catch (err) { N.notify.toast('重命名失败：' + err.message); }
          }
        });
        items.push({
          label: '删除', action: async () => {
            const ok = await N.modal.confirm({
              title: '删除' + (en.kind === 'directory' ? '文件夹' : '文件'),
              message: '确定删除「' + en.name + '」吗？' + (en.kind === 'directory' ? '文件夹内的全部内容将一并删除。' : '') + '此操作不可撤销。',
              okText: '删除', danger: true
            });
            if (!ok) return;
            try {
              await N.vfs.remove(path, { recursive: en.kind === 'directory' });
              N.notify.toast('已删除：' + en.name);
              refresh();
            } catch (err) { N.notify.toast('删除失败：' + err.message + (err.message.includes('非空') ? '（可先清空或用终端 rm -r）' : '')); }
          }
        });
        N.menu.open(items, e.clientX, e.clientY);
      }

      // 工具栏
      body.querySelector('[data-act="up"]').addEventListener('click', () => { if (cwd !== '/') navigate(N.vfs.parentOf(cwd)); });
      body.querySelector('[data-act="refresh"]').addEventListener('click', refresh);
      body.querySelector('[data-act="newdir"]').addEventListener('click', async () => {
        const name = await N.modal.prompt({ title: '新建文件夹', message: '位置：' + cwd, value: '新建文件夹' });
        if (name === null) return;
        try { await N.vfs.mkdir((cwd === '/' ? '' : cwd) + '/' + name); N.notify.toast('已创建文件夹：' + name); refresh(); }
        catch (err) { N.notify.toast('创建失败：' + err.message); }
      });
      body.querySelector('[data-act="newfile"]').addEventListener('click', async () => {
        const name = await N.modal.prompt({ title: '新建文本文件', message: '位置：' + cwd, value: '未命名.txt' });
        if (name === null) return;
        try { await N.vfs.write((cwd === '/' ? '' : cwd) + '/' + name, ''); N.notify.toast('已创建：' + name); refresh(); }
        catch (err) { N.notify.toast('创建失败：' + err.message); }
      });
      body.querySelector('[data-act="upload"]').addEventListener('click', () => uploadEl.click());
      uploadEl.addEventListener('change', async () => {
        const files = Array.from(uploadEl.files || []);
        uploadEl.value = '';
        if (!files.length) return;
        let ok = 0, fail = 0;
        for (const f of files) {
          try { await N.vfs.write((cwd === '/' ? '' : cwd) + '/' + f.name, f); ok += 1; }
          catch (e) { fail += 1; }
        }
        N.notify.toast('上传完成：成功 ' + ok + ' 个' + (fail ? '，失败 ' + fail + ' 个' : ''));
        refresh();
      });

      // 外部导航请求（如顶栏"新建文本"跳转）
      win._onParams = (p) => { if (p && p.path) navigate(p.path); };

      renderSide();
      refresh();
    }
  });

  // ============================================================
  // 终端 —— 真实 shell，直接操作 N.vfs 文件系统
  // ============================================================
  N.apps.register({
    id: 'term', name: '终端', icon: 'term',
    bg: 'linear-gradient(135deg,#3a3a3e,#1c1c1f)', w: 640, h: 420, minW: 440, minH: 300,
    render(body, win, params) {
      body.innerHTML =
        '<div class="app-term">' +
          '<div class="term-scroll">' +
            '<div class="term-line" style="color:#98989d">屿 Terminal · 文件系统：' +
              (N.vfs.mode === 'opfs' ? 'OPFS 持久化' : '内存（此浏览器不支持持久化存储）') +
            '</div>' +
            '<div class="term-line" style="color:#98989d">输入 <b class="term-cy">help</b> 查看命令</div>' +
            '<div id="termOut"></div>' +
          '</div>' +
          '<div class="term-input-line">' +
            '<span class="term-prompt" id="termPrompt">/ %</span>' +
            '<input id="termInput" autocomplete="off" autocapitalize="off" spellcheck="false">' +
          '</div>' +
        '</div>';

      const scroll = body.querySelector('.term-scroll');
      const out = body.querySelector('#termOut');
      const input = body.querySelector('#termInput');
      const promptEl = body.querySelector('#termPrompt');
      let cwd = (params && params.path) || '/';
      const histCmds = [];
      let histIdx = -1;
      const startTime = performance.now();

      function print(html) {
        const div = document.createElement('div');
        div.className = 'term-line';
        div.innerHTML = html;
        out.appendChild(div);
        scroll.scrollTop = scroll.scrollHeight;
      }
      function printText(text, cls) {
        const div = document.createElement('div');
        div.className = 'term-line' + (cls ? ' ' + cls : '');
        div.textContent = text;
        out.appendChild(div);
        scroll.scrollTop = scroll.scrollHeight;
      }
      function updatePrompt() {
        promptEl.textContent = cwd + ' %';
      }

      // 支持双引号的分词（真实 shell 行为）
      function tokenize(s) {
        const res = [];
        let cur = '', q = null;
        for (const ch of s) {
          if (q) { if (ch === q) q = null; else cur += ch; }
          else if (ch === '"' || ch === "'") q = ch;
          else if (/\s/.test(ch)) { if (cur) { res.push(cur); cur = ''; } }
          else cur += ch;
        }
        if (cur) res.push(cur);
        return res;
      }

      const CMDS = {
        help() {
          print(
            '<span class="term-cy">文件操作</span>\n' +
            '  ls [-l]        列出目录        cd <目录>        切换目录\n' +
            '  pwd            当前路径        mkdir &lt;目录&gt;     创建目录\n' +
            '  touch &lt;文件&gt;    创建空文件      cat &lt;文件&gt;        查看文件内容\n' +
            '  echo &lt;文本&gt; &gt; &lt;文件&gt;   写入文件（&gt;&gt; 为追加）\n' +
            '  rm [-r] &lt;路径&gt;  删除            cp [-r] &lt;源&gt; &lt;目标&gt;   复制\n' +
            '  mv &lt;源&gt; &lt;目标&gt;  移动/改名       tree             目录树\n' +
            '  du [路径]      统计大小        df               存储配额\n' +
            '<span class="term-cy">系统</span>\n' +
            '  neofetch       系统信息        date             当前时间\n' +
            '  wall [0-4]     切换渐变壁纸    theme [dark|light|auto]\n' +
            '  open &lt;应用|路径&gt;  打开应用或文件  uptime         开机时长\n' +
            '  history        命令历史        clear            清屏');
        },
        async pwd() { printText(cwd); },
        async cd(args) {
          const target = args[0] || '/';
          const p = N.vfs.resolve(cwd, target);
          const st = await N.vfs.stat(p);
          if (st.kind !== 'directory') throw new Error('不是目录: ' + p);
          cwd = p;
          updatePrompt();
        },
        async ls(args) {
          const long = args.includes('-l') || args.includes('-la') || args.includes('-al');
          const target = args.find(a => !a.startsWith('-')) || '.';
          const p = N.vfs.resolve(cwd, target);
          const st = await N.vfs.stat(p);
          if (st.kind === 'file') { printText(target); return; }
          const entries = await N.vfs.list(p);
          if (!entries.length) { printText('（空目录）', 'term-warn'); return; }
          if (long) {
            entries.forEach(en => {
              printText(
                (en.kind === 'directory' ? 'd' : '-') + '  ' +
                String(en.kind === 'file' ? U.fmtSize(en.size) : '—').padStart(9) + '  ' +
                U.fmtDate(en.mtime) + '  ' + en.name);
            });
          } else {
            const names = entries.map(en => en.kind === 'directory'
              ? '<span class="term-cy">' + U.esc(en.name) + '/</span>'
              : U.esc(en.name));
            print(names.join('   '));
          }
        },
        async mkdir(args) {
          const target = args.find(a => !a.startsWith('-'));
          if (!target) throw new Error('用法: mkdir <目录>');
          const p = N.vfs.resolve(cwd, target);
          if (args.includes('-p')) await N.vfs.mkdirp(p);
          else await N.vfs.mkdir(p);
          printText('已创建目录: ' + p, 'term-ok');
        },
        async touch(args) {
          if (!args[0]) throw new Error('用法: touch <文件>');
          const p = N.vfs.resolve(cwd, args[0]);
          if (await N.vfs.exists(p)) {
            printText('已存在: ' + p);
          } else {
            await N.vfs.write(p, '');
            printText('已创建: ' + p, 'term-ok');
          }
        },
        async cat(args) {
          if (!args[0]) throw new Error('用法: cat <文件>');
          const p = N.vfs.resolve(cwd, args[0]);
          const st = await N.vfs.stat(p);
          if (st.kind === 'directory') throw new Error('是目录而非文件: ' + p);
          const text = await N.vfs.readText(p);
          if (text.length > 20000) printText(text.slice(0, 20000) + '\n…（内容过长已截断显示）');
          else printText(text || '（空文件）');
        },
        async rm(args) {
          const recursive = args.includes('-r') || args.includes('-rf');
          const target = args.find(a => !a.startsWith('-'));
          if (!target) throw new Error('用法: rm [-r] <路径>');
          const p = N.vfs.resolve(cwd, target);
          if (p === '/') throw new Error('不能删除根目录');
          const st = await N.vfs.stat(p);
          await N.vfs.remove(p, { recursive: recursive || st.kind === 'file' });
          printText('已删除: ' + p, 'term-ok');
        },
        async cp(args) {
          const rest = args.filter(a => !a.startsWith('-'));
          if (rest.length < 2) throw new Error('用法: cp [-r] <源> <目标>');
          const s = N.vfs.resolve(cwd, rest[0]);
          let d = N.vfs.resolve(cwd, rest[1]);
          const stD = await N.vfs.stat(d).catch(() => null);
          if (stD && stD.kind === 'directory') d = N.vfs.join(d, N.vfs.baseName(s));
          await N.vfs.copy(s, d);
          printText('已复制: ' + s + ' → ' + d, 'term-ok');
        },
        async mv(args) {
          if (args.length < 2) throw new Error('用法: mv <源> <目标>');
          const s = N.vfs.resolve(cwd, args[0]);
          let d = N.vfs.resolve(cwd, args[1]);
          const stD = await N.vfs.stat(d).catch(() => null);
          if (stD && stD.kind === 'directory') d = N.vfs.join(d, N.vfs.baseName(s));
          await N.vfs.move(s, d);
          printText('已移动: ' + s + ' → ' + d, 'term-ok');
        },
        async tree(args) {
          const rootP = N.vfs.resolve(cwd, args[0] || '.');
          let count = 0;
          async function walk(p, prefix, depth) {
            if (depth > 4 || count > 200) return;
            const entries = await N.vfs.list(p);
            for (let i = 0; i < entries.length; i++) {
              const en = entries[i];
              const last = i === entries.length - 1;
              printText(prefix + (last ? '└── ' : '├── ') + en.name + (en.kind === 'directory' ? '/' : '') +
                (en.kind === 'file' ? '  (' + U.fmtSize(en.size) + ')' : ''));
              count += 1;
              if (en.kind === 'directory' && depth < 4) {
                await walk(N.vfs.join(p, en.name), prefix + (last ? '    ' : '│   '), depth + 1);
              }
            }
          }
          printText(rootP);
          await walk(rootP, '', 0);
          if (count > 200) printText('…（条目过多已截断）', 'term-warn');
        },
        async du(args) {
          const p = N.vfs.resolve(cwd, args[0] || '.');
          const total = await N.vfs.du(p);
          printText(U.fmtSize(total) + '\t' + p);
        },
        async df() {
          const est = await N.vfs.usage();
          printText('文件系统: ' + (N.vfs.mode === 'opfs' ? 'OPFS 持久化' : '内存'));
          if (est && est.quota) {
            printText('已用 ' + U.fmtSize(est.usage) + ' / 配额 ' + U.fmtSize(est.quota) +
              '（' + (est.quota ? (est.usage / est.quota * 100).toFixed(2) : 0) + '%）');
          } else {
            printText('配额未知', 'term-warn');
          }
        },
        async echo(args) {
          // echo 文本 > 文件 / >> 文件（真实写入）
          const gtIdx = args.findIndex(a => a === '>' || a === '>>');
          if (gtIdx === -1) { printText(args.join(' ')); return; }
          const text = args.slice(0, gtIdx).join(' ');
          const file = args[gtIdx + 1];
          if (!file) throw new Error('用法: echo <文本> > <文件>');
          const p = N.vfs.resolve(cwd, file);
          if (args[gtIdx] === '>>') {
            const old = await N.vfs.exists(p) ? await N.vfs.readText(p) : '';
            await N.vfs.write(p, old + (old && !old.endsWith('\n') ? '\n' : '') + text + '\n');
          } else {
            await N.vfs.write(p, text + '\n');
          }
          printText('已写入: ' + p, 'term-ok');
        },
        async neofetch() {
          const est = await N.vfs.usage();
          const up = Math.round((performance.now() - startTime) / 1000);
          print(
            '<span class="term-cy">        .--.        </span>  <b>isle@web</b>\n' +
            '<span class="term-cy">       |o_o |       </span>  -----------------\n' +
            '<span class="term-cy">       |:_/ |       </span>  OS: 屿 IsleOS ' + N.VERSION + ' (Web)\n' +
            '<span class="term-cy">      //   \\ \\      </span>  Kernel: ' + U.esc((navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/) || ['Browser'])[0]) + '\n' +
            '<span class="term-cy">     (|     | )     </span>  CPU cores: ' + (navigator.hardwareConcurrency || '—') + '\n' +
            '<span class="term-cy">    /\'\\_   _/`\\     </span>  Memory: ' + (navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '—') + '\n' +
            '<span class="term-cy">    \\___)=(___/    </span>  Storage: ' + (est && est.quota ? U.fmtSize(est.usage) + ' / ' + U.fmtSize(est.quota) : '—') + '\n' +
            '<span class="term-cy">                   </span>  FS: ' + (N.vfs.mode === 'opfs' ? 'OPFS 持久化' : '内存模式') + '\n' +
            '<span class="term-cy">                   </span>  Resolution: ' + window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x\n' +
            '<span class="term-cy">                   </span>  Uptime: ' + up + 's');
        },
        async wall(args) {
          const n = args[0] !== undefined ? parseInt(args[0], 10) : null;
          if (n === null || isNaN(n)) await N.wallpaper.next();
          else if (n >= 0 && n <= 4) N.wallpaper.applyGradient(n);
          else throw new Error('用法: wall [0-4]');
          printText('壁纸已切换', 'term-ok');
        },
        async theme(args) {
          const m = args[0];
          if (!['dark', 'light', 'auto'].includes(m)) throw new Error('用法: theme <dark|light|auto>');
          N.state.set('theme', m);
          N.theme.apply(m);
          printText('主题已切换: ' + m, 'term-ok');
        },
        async open(args) {
          const t = args[0];
          if (!t) throw new Error('用法: open <应用|路径>');
          if (N.apps.get(t)) { N.wm.openApp(t); printText('已打开应用: ' + t, 'term-ok'); return; }
          const p = N.vfs.resolve(cwd, t);
          const st = await N.vfs.stat(p);
          if (st.kind === 'directory') { N.wm.openApp('files', { path: p }); printText('已在文件管理器打开: ' + p, 'term-ok'); }
          else { N.wm.openApp('files', { path: N.vfs.parentOf(p) }); printText('已定位目录: ' + N.vfs.parentOf(p), 'term-ok'); }
        },
        async date() { printText(new Date().toLocaleString('zh-CN', { hour12: false })); },
        async uptime() {
          const s = Math.round((performance.now() - startTime) / 1000);
          printText('本次开机已运行 ' + s + ' 秒（' + Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒）');
        },
        async history() {
          histCmds.forEach((c, i) => printText(String(i + 1).padStart(3) + '  ' + c));
        },
        async whoami() { printText('guest'); },
        async sudo() { printText('guest 不在 sudoers 文件中。此事件将被报告 :)', 'term-warn'); },
        clear() { out.innerHTML = ''; }
      };

      async function run(raw) {
        const tokens = tokenize(raw);
        if (!tokens.length) return;
        const name = tokens[0];
        const args = tokens.slice(1);
        const cmd = CMDS[name];
        if (!cmd) { printText('command not found: ' + name, 'term-err'); return; }
        try {
          await cmd(args);
        } catch (err) {
          printText(name + ': ' + (err && err.message || err), 'term-err');
        }
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const raw = input.value.trim();
          input.value = '';
          print('<span class="term-prompt">' + U.esc(cwd) + ' %</span> ' + U.esc(raw));
          if (raw) {
            histCmds.push(raw);
            if (histCmds.length > 100) histCmds.shift();
            histIdx = histCmds.length;
            run(raw);
          }
        } else if (e.key === 'ArrowUp') {
          if (!histCmds.length) return;
          e.preventDefault();
          histIdx = Math.max(0, histIdx - 1);
          input.value = histCmds[histIdx] || '';
        } else if (e.key === 'ArrowDown') {
          if (!histCmds.length) return;
          e.preventDefault();
          histIdx = Math.min(histCmds.length, histIdx + 1);
          input.value = histIdx >= histCmds.length ? '' : histCmds[histIdx];
        } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          out.innerHTML = '';
        }
      });
      scroll.addEventListener('click', (e) => {
        if (!window.getSelection().toString() && !e.target.closest('input')) input.focus();
      });
      updatePrompt();
      setTimeout(() => input.focus(), 80);
    }
  });
})();
