// ============================================================
// 屿 IsleOS v4.1 — 应用 C 组：智能体 / 浏览器
// 智能体：本地指令模式（真实操作系统）+ 可选 OpenAI 兼容 API（真对话 + 工具调用）
// 浏览器：iframe 真实访问可嵌入站点（受限站点支持新窗口打开）
// ============================================================
window.N = window.N || {};

(function () {
  'use strict';
  const U = N.util;

  // ============================================================
  // 工具：把一段文字里的应用名解析成 appId
  // ============================================================
  function detectAppInText(text) {
    for (const id of N.apps.order) {
      if (text.includes(N.apps.get(id).name)) return id;
    }
    const t = (text || '').trim();
    if (N.apps.get(t)) return t;
    const lower = t.toLowerCase();
    for (const id of N.apps.order) if (id === lower) return id;
    return null;
  }

  function systemInfoText() {
    const ua = navigator.userAgent;
    const eng = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '未知内核';
    return '设备信息：\n· 内核 ' + eng +
      '\n· 逻辑核心 ' + (navigator.hardwareConcurrency || '—') +
      '\n· 内存 ' + (navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '—') +
      '\n· 屏幕 ' + window.innerWidth + ' × ' + window.innerHeight +
      '\n· 文件系统 ' + (N.vfs.mode === 'opfs' ? 'OPFS 持久化' : '内存') +
      '\n· 时间 ' + new Date().toLocaleString('zh-CN', { hour12: false });
  }

  // ============================================================
  // 智能体可执行工具（本地与云端共用，全部真实生效）
  // ============================================================
  const TOOL_IMPLS = {
    open_app({ app_id }) {
      const id = detectAppInText(app_id) || (N.apps.get(app_id) ? app_id : null);
      if (!id) return { ok: false, error: '未知应用：' + app_id };
      N.wm.openApp(id);
      return { ok: true, result: '已打开「' + N.apps.get(id).name + '」' };
    },
    set_theme({ mode }) {
      if (!['dark', 'light', 'auto'].includes(mode)) return { ok: false, error: 'mode 仅支持 dark/light/auto' };
      N.state.set('theme', mode); N.theme.apply(mode);
      return { ok: true, result: '主题已切换为 ' + mode };
    },
    set_wallpaper({ index }) {
      const n = Math.max(0, Math.min(4, index | 0));
      N.wallpaper.applyGradient(n);
      return { ok: true, result: '壁纸已切换为第 ' + (n + 1) + ' 张' };
    },
    async list_directory({ path }) {
      try {
        const es = await N.vfs.list(path || '/');
        return { ok: true, result: es.length ? es.map(e => e.name + (e.kind === 'directory' ? '/' : '')).join('、') : '（空）' };
      } catch (e) { return { ok: false, error: e.message }; }
    },
    async read_file({ path }) {
      try { return { ok: true, result: (await N.vfs.readText(path)).slice(0, 3000) }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async write_file({ path, content }) {
      try { return { ok: true, result: '已写入 ' + (await N.vfs.write(path, content || '')) }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async create_note({ title, body }) {
      try {
        const p = await N.vfs.write('/文稿/' + (title || '便签') + '.md', body || '');
        return { ok: true, result: '已创建笔记 ' + p };
      } catch (e) { return { ok: false, error: e.message }; }
    },
    notify({ message }) {
      N.notify.toast(message || '提醒');
      return { ok: true, result: '已发送通知' };
    },
    lock_screen() { N.shell.lock(); return { ok: true, result: '已锁定屏幕' }; },
    get_system_info() { return { ok: true, result: systemInfoText() }; }
  };

  const TOOL_SCHEMAS = [
    { type: 'function', function: { name: 'open_app', description: '打开一个应用。app_id 可用：files(文件)、notes(便签)、gallery(图库)、clock(时钟)、paint(画板)、synth(合成器)、calc(计算器)、term(终端)、settings(设置)、help(帮助)、about(关于本机)、agent(智能体)、browser(浏览器)', parameters: { type: 'object', properties: { app_id: { type: 'string' } }, required: ['app_id'] } } },
    { type: 'function', function: { name: 'set_theme', description: '切换系统主题', parameters: { type: 'object', properties: { mode: { type: 'string', enum: ['dark', 'light', 'auto'] } }, required: ['mode'] } } },
    { type: 'function', function: { name: 'set_wallpaper', description: '切换渐变壁纸，index 取 0-4', parameters: { type: 'object', properties: { index: { type: 'integer' } }, required: ['index'] } } },
    { type: 'function', function: { name: 'list_directory', description: '列出某目录下的内容', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'read_file', description: '读取文本文件内容', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'write_file', description: '写入文本文件（不存在则自动创建）', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
    { type: 'function', function: { name: 'create_note', description: '在 /文稿 下创建一篇 Markdown 便签', parameters: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'body'] } } },
    { type: 'function', function: { name: 'notify', description: '在系统里发送一条通知', parameters: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } } },
    { type: 'function', function: { name: 'lock_screen', description: '锁定屏幕', parameters: { type: 'object', properties: {} } } },
    { type: 'function', function: { name: 'get_system_info', description: '获取当前设备与系统信息', parameters: { type: 'object', properties: {} } } }
  ];

  // ---------- 本地指令解释器（无 API 时的真实兜底）----------
  async function localReply(text) {
    const t = (text || '').trim();
    if (/锁屏|锁定|lock screen|^\s*lock\s*$/i.test(t)) { N.shell.lock(); return '已锁定屏幕。'; }
    if (/深色|暗色|夜间|dark/i.test(t)) { N.state.set('theme', 'dark'); N.theme.apply('dark'); return '已切换到深色模式。'; }
    if (/浅色|亮色|\blight\b/i.test(t)) { N.state.set('theme', 'light'); N.theme.apply('light'); return '已切换到浅色模式。'; }
    if (/跟随系统|自动(主题)?|\bauto\b/i.test(t)) { N.state.set('theme', 'auto'); N.theme.apply('auto'); return '主题已设为自动（跟随系统深浅色）。'; }
    if (/壁纸|wallpaper|\bwall\b/i.test(t)) {
      const num = t.match(/\d/);
      if (num) { const n = +num[0]; if (n >= 0 && n <= 4) { N.wallpaper.applyGradient(n); return '壁纸已切换到第 ' + (n + 1) + ' 张。'; } }
      await N.wallpaper.next(); return '已切换到下一张壁纸。';
    }
    const app = detectAppInText(t);
    if (app && /打开|启动|运行|open|launch|起/.test(t)) { N.wm.openApp(app); return '已打开「' + N.apps.get(app).name + '」。'; }
    if (/提醒|通知|\bnotify\b/i.test(t)) {
      const m = (t.match(/[：:]\s*(.+)$/) || [])[1] || t.replace(/.*(提醒|通知|notify)\s*/i, '').trim();
      N.notify.toast(m || '提醒');
      return '已发送通知：' + (m || '提醒');
    }
    if (/列出|目录|有什么文件|\bls\b|查看.*文件|文件.*有/i.test(t)) {
      const path = (t.match(/(\/[\w一-龥.]+)+/) || [])[0] || '/';
      try {
        const es = await N.vfs.list(path);
        return path + ' 下共 ' + es.length + ' 项：' + es.map(e => e.name + (e.kind === 'directory' ? '/' : '')).join('、');
      } catch (e) { return '读取失败：' + e.message; }
    }
    if (/读(取|出)?|查看文件|\bcat\b/i.test(t)) {
      const path = (t.match(/(\/[\w一-龥.]+)+/) || [])[0];
      if (path) { try { return '「' + path + '」内容：\n' + (await N.vfs.readText(path)).slice(0, 1500); } catch (e) { return '读取失败：' + e.message; } }
    }
    if (/系统信息|设备|配置|neofetch|你(是谁|叫什么|是什么)|关于本机/i.test(t)) return systemInfoText();
    return '现在是本地指令模式，试试这些真实操作：「打开文件」「换个深色」「壁纸 3」「锁屏」「系统信息」。\n想自由对话？点右上角 ⚙ 填入 OpenAI 兼容接口即可。';
  }

  // ---------- 云端 LLM 调用（OpenAI 兼容 /chat/completions）----------
  async function callLLM(messages) {
    const endpoint = N.state.get('agent.endpoint') || 'https://api.openai.com/v1/chat/completions';
    const key = N.state.get('agent.key') || '';
    const model = N.state.get('agent.model') || 'gpt-4o-mini';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { Authorization: 'Bearer ' + key } : {}),
      body: JSON.stringify({ model: model, messages: messages, tools: TOOL_SCHEMAS, tool_choice: 'auto', temperature: 0.6 })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error('接口返回 ' + res.status + (txt ? '：' + txt.slice(0, 200) : ''));
    }
    return res.json();
  }

  async function llmReply(userText, history) {
    const messages = history.concat([{ role: 'user', content: userText }]);
    let lastText = null;
    for (let i = 0; i < 6; i++) {
      const data = await callLLM(messages);
      const msg = data && data.choices && data.choices[0] && data.choices[0].message;
      if (!msg) throw new Error('返回结构异常');
      messages.push(msg);
      if (msg.tool_calls && msg.tool_calls.length) {
        const results = [];
        for (const tc of msg.tool_calls) {
          const fn = TOOL_IMPLS[tc.function.name];
          let out;
          try {
            const args = JSON.parse(tc.function.arguments || '{}');
            out = fn.length ? await fn(args) : fn(args);
          } catch (e) { out = { ok: false, error: String(e && e.message || e) }; }
          results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out) });
        }
        messages.push.apply(messages, results);
        continue;
      }
      lastText = msg.content;
      break;
    }
    if (lastText == null) throw new Error('模型未返回文本内容');
    return lastText;
  }

  // ============================================================
  // 智能体应用
  // ============================================================
  N.apps.register({
    id: 'agent', name: '智能体', icon: 'agent',
    bg: 'linear-gradient(135deg,#34c759,#0a84ff)', w: 580, h: 560, minW: 360, minH: 420,
    render(body, win) {
      const cloud = !!(N.state.get('agent.enabled') && N.state.get('agent.key'));
      body.innerHTML =
        '<div class="app-agent">' +
          '<div class="ag-bar">' +
            '<div class="ag-title">智能体</div>' +
            '<span class="ag-badge ' + (cloud ? 'cloud' : 'local') + '" id="agBadge">' + (cloud ? '云端' : '本地') + '</span>' +
            '<button class="ag-gear" id="agGear" title="设置" aria-label="设置">' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" stroke-width="1.6"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.7 7.7 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.6a7.7 7.7 0 0 0-2.6 1.5l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.7 7.7 0 0 0 2.6 1.5l.5 2.6h4l.5-2.6a7.7 7.7 0 0 0 2.6-1.5l2.3 1 2-3.4-2-1.5Z" stroke="currentColor" stroke-width="1.4"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="ag-msgs" id="agMsgs"></div>' +
          '<div class="ag-input-row">' +
            '<textarea id="agInput" rows="1" placeholder="试试：打开文件 / 换壁纸 / 锁屏"></textarea>' +
            '<button class="ag-send" id="agSend">发送</button>' +
          '</div>' +
          '<div class="ag-cfg" id="agCfg" hidden>' +
            '<div class="ag-cfg-row"><label><input type="checkbox" id="agEnable"> 启用云端智能体</label></div>' +
            '<div class="ag-cfg-row"><span>接口地址</span><input id="agEndpoint" placeholder="https://api.openai.com/v1/chat/completions"></div>' +
            '<div class="ag-cfg-row"><span>模型</span><input id="agModel" placeholder="gpt-4o-mini"></div>' +
            '<div class="ag-cfg-row"><span>密钥</span><input id="agKey" type="password" placeholder="sk-...（仅保存在本机浏览器）"></div>' +
            '<div class="ag-cfg-note">填入 OpenAI 兼容的 /chat/completions 接口与密钥后，智能体即可真正对话并按你的指令操作系统（开应用、读文件、换壁纸等）。密钥只存在本地，不会上传到本系统之外。部分接口可能因跨域（CORS）无法在浏览器直连。</div>' +
          '</div>' +
        '</div>';

      const msgs = body.querySelector('#agMsgs');
      const input = body.querySelector('#agInput');
      const sendBtn = body.querySelector('#agSend');
      const badge = body.querySelector('#agBadge');
      const gear = body.querySelector('#agGear');
      const cfg = body.querySelector('#agCfg');

      // 对话历史（仅 user/assistant 文本，真实持久化）
      let history = [];
      try {
        const h = JSON.parse(N.state.get('agent.history', '[]'));
        if (Array.isArray(h)) history = h.slice(-20);
      } catch (e) { history = []; }

      function pushHistory(role, content) {
        if (!content) return;
        history.push({ role, content });
        if (history.length > 24) history = history.slice(-24);
        N.state.set('agent.history', JSON.stringify(history));
      }
      function addBubble(role, text) {
        const div = document.createElement('div');
        div.className = 'ag-msg ' + (role === 'user' ? 'user' : 'bot');
        div.textContent = text;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
      }
      function greet() {
        if (msgs.children.length) return;
        if (history.length) { history.forEach(m => addBubble(m.role, m.content)); return; }
        // 欢迎语保持两行内，且不滚到底部（避免长文案被顶部裁切）
        addBubble('bot', cloud
          ? '云端智能体已就绪。我能对话，也能动手：打开应用、读写文件、换壁纸、锁屏。试试看？'
          : '我是本岛智能体，一句话即可真实操作：打开文件 / 换壁纸 / 深浅色 / 锁屏。');
        msgs.scrollTop = 0;
      }

      let busy = false;
      async function send() {
        const text = input.value.trim();
        if (!text || busy) return;
        input.value = '';
        addBubble('user', text);
        pushHistory('user', text);
        const wait = document.createElement('div');
        wait.className = 'ag-msg bot';
        wait.textContent = '思考中…';
        msgs.appendChild(wait);
        msgs.scrollTop = msgs.scrollHeight;
        busy = true;
        let reply;
        try {
          if (cloud) reply = await llmReply(text, history.filter(m => m.role !== 'system'));
          else reply = await localReply(text);
        } catch (e) {
          reply = '出错了：' + (e && e.message || e) + (cloud ? '\n（可能是接口地址、密钥错误或跨域 CORS 限制。可在设置里关闭云端，切回本地指令模式。）' : '');
        }
        wait.remove();
        addBubble('bot', reply);
        pushHistory('assistant', reply);
        busy = false;
      }

      sendBtn.addEventListener('click', send);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(120, input.scrollHeight) + 'px';
      });

      // 设置面板
      function syncCfg() {
        body.querySelector('#agEnable').checked = !!N.state.get('agent.enabled');
        body.querySelector('#agEndpoint').value = N.state.get('agent.endpoint') || '';
        body.querySelector('#agModel').value = N.state.get('agent.model') || '';
        body.querySelector('#agKey').value = N.state.get('agent.key') || '';
      }
      function refreshBadge() {
        const on = !!(N.state.get('agent.enabled') && N.state.get('agent.key'));
        badge.textContent = on ? '云端' : '本地';
        badge.className = 'ag-badge ' + (on ? 'cloud' : 'local');
      }
      gear.addEventListener('click', () => { syncCfg(); cfg.hidden = !cfg.hidden; });
      body.querySelector('#agEnable').addEventListener('change', (e) => { N.state.set('agent.enabled', e.target.checked); refreshBadge(); N.notify.toast(e.target.checked ? '已尝试启用云端智能体' : '已切回本地指令模式'); });
      body.querySelector('#agEndpoint').addEventListener('change', (e) => N.state.set('agent.endpoint', e.target.value.trim()));
      body.querySelector('#agModel').addEventListener('change', (e) => N.state.set('agent.model', e.target.value.trim()));
      body.querySelector('#agKey').addEventListener('change', (e) => { N.state.set('agent.key', e.target.value.trim()); refreshBadge(); });

      greet();
    }
  });

  // ============================================================
  // 浏览器 —— iframe 真实访问可嵌入站点
  // ============================================================
  const HOME_HTML =
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>html,body{margin:0;height:100%;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}' +
    'body{background:linear-gradient(135deg,#0a84ff,#34c759);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;}' +
    'h1{font-size:22px;font-weight:700;margin:0;opacity:.95}.box{display:flex;gap:8px;width:min(520px,86%);}' +
    'input{flex:1;padding:12px 14px;border:0;border-radius:12px;font-size:15px;outline:none;}' +
    'button{padding:12px 18px;border:0;border-radius:12px;background:#0d3a52;color:#fff;font-size:15px;cursor:pointer;white-space:nowrap;}' +
    '.links{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;max-width:86%}' +
    '.links a{color:#fff;opacity:.9;text-decoration:none;background:rgba(255,255,255,.16);padding:7px 13px;border-radius:20px;font-size:13px}' +
    'p{font-size:12px;opacity:.8;margin:0}</style></head>' +
    '<body><h1>屿 · 浏览器</h1>' +
    '<form class="box" onsubmit="var q=document.getElementById(\'q\').value.trim();if(q){location.href=\'https://duckduckgo.com/html/?q=\'+encodeURIComponent(q)}return false">' +
    '<input id="q" placeholder="搜索，或输入网址后回车" autofocus><button>前往</button></form>' +
    '<div class="links">' +
    '<a href="https://duckduckgo.com" target="_top">DuckDuckGo</a>' +
    '<a href="https://www.wikipedia.org" target="_top">维基百科</a>' +
    '<a href="https://www.bing.com" target="_top">Bing</a>' +
    '<a href="https://github.com" target="_top">GitHub</a>' +
    '<a href="https://news.ycombinator.com" target="_top">Hacker News</a>' +
    '</div><p>提示：部分网站禁止被网页嵌入，遇到空白可点下方「新窗口打开」。</p></body></html>';

  N.apps.register({
    id: 'browser', name: '浏览器', icon: 'browser',
    bg: 'linear-gradient(135deg,#0a84ff,#5e5ce6)', w: 760, h: 540, minW: 420, minH: 360,
    render(body, win) {
      body.innerHTML =
        '<div class="app-browser">' +
          '<div class="br-bar">' +
            '<button class="br-btn" id="brReload" title="刷新">↻</button>' +
            '<button class="br-btn" id="brHome" title="主页">⌂</button>' +
            '<input id="brAddr" placeholder="输入网址或搜索词，回车前往" spellcheck="false">' +
            '<button class="br-go" id="brGo">前往</button>' +
            '<button class="br-btn" id="brNew" title="新窗口打开">↗</button>' +
          '</div>' +
          '<div class="br-frame-wrap"><iframe id="brFrame" referrerpolicy="no-referrer" allow="clipboard-read; clipboard-write"></iframe></div>' +
          '<div class="br-foot">部分网站（如多数国内站点、登录页）会禁止被嵌入，此时显示空白——点「↗ 新窗口打开」即可在原站打开。本站不收集你在浏览器里的任何输入。</div>' +
        '</div>';

      const frame = body.querySelector('#brFrame');
      const addr = body.querySelector('#brAddr');
      let cur = '';

      function go(url) {
        url = (url || '').trim();
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) {
          if (/^[\w-]+(\.[\w-]+)+/.test(url)) url = 'https://' + url;
          else url = 'https://duckduckgo.com/html/?q=' + encodeURIComponent(url);
        }
        cur = url;
        addr.value = url;
        frame.src = url;
      }
      function home() { cur = ''; addr.value = ''; frame.srcdoc = HOME_HTML; }
      function reload() { if (cur) frame.src = cur; else home(); }

      body.querySelector('#brGo').addEventListener('click', () => go(addr.value));
      body.querySelector('#brReload').addEventListener('click', reload);
      body.querySelector('#brHome').addEventListener('click', home);
      body.querySelector('#brNew').addEventListener('click', () => { if (cur) window.open(cur, '_blank', 'noopener'); else N.notify.toast('先访问一个网址'); });
      addr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(addr.value); });
      frame.addEventListener('load', () => {
        try { const u = frame.contentWindow.location.href; if (u && u !== 'about:blank') { cur = u; addr.value = u; } } catch (e) { /* 跨域无法读取，忽略 */ }
      });

      home();
    }
  });
})();
