// ============================================================
// 屿 IsleOS v4.1 — 文件系统层（N.vfs）
// 优先使用 OPFS（浏览器持久化文件系统）；
// 不支持时降级为内存模式，并如实标注。
// ============================================================
window.N = window.N || {};

N.vfs = (function () {
  'use strict';

  let mode = 'memory';        // 'opfs' | 'memory'
  let rootHandle = null;      // OPFS 根目录句柄
  let memRoot = null;         // 内存模式根节点

  const WELCOME =
    '欢迎来到屿\n' +
    '==========\n\n' +
    '这里的文件都保存在浏览器里，刷新、重开都还在。\n\n' +
    '  · 终端可以直接操作这套文件系统，试试：ls、cat 欢迎来到屿.txt\n' +
    '  · 画板的作品可以存进「图库」，还能设成壁纸。\n' +
    '  · 删掉这个文件也没关系，小岛照常运转。\n\n' +
    '慢慢逛。';

  const TODO =
    '# 今日待办\n\n' +
    '- [x] 上岛\n' +
    '- [ ] 在终端输入 neofetch 看看这台设备\n' +
    '- [ ] 用画板画点什么并保存到图库\n' +
    '- [ ] 在设置里切换深色模式\n' +
    '- [ ] 试试合成器，按下键盘 A S D F 弹个音';

  // ---------- 启动初始化 ----------
  const ready = (async () => {
    try {
      const supported =
        typeof navigator !== 'undefined' &&
        navigator.storage &&
        typeof navigator.storage.getDirectory === 'function' &&
        typeof window.FileSystemFileHandle === 'function' &&
        typeof FileSystemFileHandle.prototype.createWritable === 'function';
      if (supported) {
        rootHandle = await navigator.storage.getDirectory();
        mode = 'opfs';
      }
    } catch (err) {
      rootHandle = null;
      mode = 'memory';
    }
    if (mode !== 'opfs') {
      memRoot = { kind: 'directory', children: new Map(), mtime: Date.now() };
    }
    // 默认目录与欢迎文件（真实存在，可编辑可删除）
    await mkdirp('/文稿');
    await mkdirp('/图库');
    await mkdirp('/下载');
    try {
      if (!(await exists('/文稿/欢迎来到屿.txt'))) await write('/文稿/欢迎来到屿.txt', WELCOME);
      if (!(await exists('/文稿/待办清单.md'))) await write('/文稿/待办清单.md', TODO);
    } catch (err) { /* 非致命：忽略默认文件写入失败 */ }
  })();

  // ---------- 路径工具 ----------
  function split(path) {
    return String(path).split('/').filter(Boolean);
  }
  function join(a, b) {
    return '/' + split(a + '/' + b).join('/');
  }
  // 把（相对/绝对）路径解析为规范绝对路径，支持 . 与 ..
  function resolve(cwd, input) {
    let segs = (input || '.').startsWith('/') ? [] : split(cwd);
    for (const raw of split(input)) {
      if (raw === '.') continue;
      if (raw === '..') segs.pop();
      else segs.push(raw);
    }
    return '/' + segs.join('/');
  }
  function parentOf(p) {
    const s = split(p);
    s.pop();
    return '/' + s.join('/');
  }
  function baseName(p) {
    const s = split(p);
    return s.length ? s[s.length - 1] : '/';
  }
  function validateName(name) {
    if (!name || name === '.' || name === '..') throw new Error('名称不能为空');
    if (name.includes('/')) throw new Error('名称不能包含斜杠 /');
    if (name.length > 80) throw new Error('名称过长（最多 80 字符）');
    return name;
  }

  // ---------- 内部：取目录句柄 / 内存节点 ----------
  async function getDir(path, create) {
    if (mode === 'opfs') {
      if (path === '/' ) return rootHandle;
      let cur = rootHandle;
      for (const seg of split(path)) {
        cur = await cur.getDirectoryHandle(seg, { create: !!create });
      }
      return cur;
    }
    // 内存模式
    let cur = memRoot;
    for (const seg of split(path)) {
      let next = cur.children.get(seg);
      if (!next) {
        if (!create) throw new Error('目录不存在: ' + path);
        next = { kind: 'directory', children: new Map(), mtime: Date.now() };
        cur.children.set(seg, next);
      }
      if (next.kind !== 'directory') throw new Error('不是目录: ' + seg);
      cur = next;
    }
    return cur;
  }

  async function memGet(path) {
    let cur = memRoot;
    for (const seg of split(path)) {
      if (!cur || cur.kind !== 'directory') throw new Error('路径不存在: ' + path);
      cur = cur.children.get(seg);
    }
    if (!cur) throw new Error('路径不存在: ' + path);
    return cur;
  }

  function friendly(err, path) {
    // 同时检查 err.name 与 message：部分 DOMException 的 name 是标准英文名，
    // 而 message 可能是一句不含关键字的描述（如 "A requested file or directory could not be found..."），
    // 只匹配 message 会漏判，导致原始英文错误泄漏到界面 / 控制台。
    const name = String(err && err.name || '');
    const msg = String(err && err.message || err);
    const hay = name + ' :: ' + msg;
    if (/NotFoundError|not ?found/i.test(hay)) return new Error('找不到：' + path);
    if (/TypeMismatchError/i.test(hay)) return new Error('不是目录：' + path);
    if (/InvalidModificationError/i.test(hay)) return new Error('目录非空，需要递归删除：' + path);
    if (/NoModificationAllowedError/i.test(hay)) return new Error('无法修改：' + path);
    return new Error(msg);
  }

  // ---------- 对外 API ----------
  async function list(path) {
    const p = resolve('/', path);
    try {
      const dir = await getDir(p, false);
      const out = [];
      if (mode === 'opfs') {
        const iter = dir.entries();
        while (true) {
          let step;
          try { step = await iter.next(); } catch (e) { throw friendly(e, p); }
          if (step.done) break;
          const name = step.value[0];
          const handle = step.value[1];
          if (handle.kind === 'file') {
            try {
              const f = await handle.getFile();
              out.push({ name, kind: 'file', size: f.size, mtime: f.lastModified });
            } catch (e) {
              out.push({ name, kind: 'file', size: null, mtime: null });
            }
          } else {
            out.push({ name, kind: 'directory', size: null, mtime: null });
          }
        }
      } else {
        for (const [name, node] of dir.children) {
          if (node.kind === 'file') out.push({ name, kind: 'file', size: node.blob.size, mtime: node.mtime });
          else out.push({ name, kind: 'directory', size: null, mtime: node.mtime });
        }
      }
      out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'zh') : (a.kind === 'directory' ? -1 : 1)));
      return out;
    } catch (err) { throw friendly(err, p); }
  }

  async function stat(path) {
    const p = resolve('/', path);
    try {
      if (p === '/') return { kind: 'directory', size: null, mtime: null };
      const parent = await getDir(parentOf(p), false);
      if (mode === 'opfs') {
        const handle = await parent.getFileHandle(baseName(p));
        const f = await handle.getFile();
        return { kind: 'file', size: f.size, mtime: f.lastModified };
      }
      const node = parent.children.get(baseName(p));
      if (!node) throw new Error('not found');
      return node.kind === 'file'
        ? { kind: 'file', size: node.blob.size, mtime: node.mtime }
        : { kind: 'directory', size: null, mtime: node.mtime };
    } catch (err) {
      // 目录尝试
      try {
        await getDir(p, false);
        return { kind: 'directory', size: null, mtime: null };
      } catch (e2) { throw friendly(err, p); }
    }
  }

  async function exists(path) {
    try { await stat(path); return true; } catch (e) { return false; }
  }

  async function readBlob(path) {
    const p = resolve('/', path);
    try {
      if (mode === 'opfs') {
        const parent = await getDir(parentOf(p), false);
        const fh = await parent.getFileHandle(baseName(p));
        return await fh.getFile();
      }
      const node = await memGet(p);
      if (node.kind !== 'file') throw new Error('是目录而非文件: ' + p);
      return node.blob;
    } catch (err) { throw friendly(err, p); }
  }

  async function readText(path) {
    const blob = await readBlob(path);
    return blob.text();
  }

  // data: string | Blob | File
  async function write(path, data) {
    const p = resolve('/', path);
    const name = baseName(p);
    validateName(name);
    try {
      const parent = await getDir(parentOf(p), false);
      if (mode === 'opfs') {
        const fh = await parent.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(data);
        await w.close();
      } else {
        const old = parent.children.get(name);
        if (old && old.kind === 'directory') throw new Error('同名目录已存在: ' + p);
        parent.children.set(name, { kind: 'file', blob: new Blob([data]), mtime: Date.now() });
      }
      return p;
    } catch (err) {
      if (/名称/.test(String(err.message || err))) throw err;
      throw friendly(err, p);
    }
  }

  // 单级目录创建：父目录必须存在，目标不能已存在
  async function mkdir(path) {
    const p = resolve('/', path);
    const name = baseName(p);
    if (p === '/') throw new Error('根目录已存在');
    validateName(name);
    try {
      if (await exists(p)) throw new Error('已存在: ' + p);
      const parent = await getDir(parentOf(p), false);
      if (mode === 'opfs') {
        await parent.getDirectoryHandle(name, { create: true });
      } else {
        parent.children.set(name, { kind: 'directory', children: new Map(), mtime: Date.now() });
      }
      return p;
    } catch (err) {
      if (/已存在|名称/.test(String(err.message || err))) throw err;
      throw friendly(err, p);
    }
  }

  // 逐级创建目录
  async function mkdirp(path) {
    const p = resolve('/', path);
    if (mode === 'opfs') {
      let cur = rootHandle;
      for (const seg of split(p)) cur = await cur.getDirectoryHandle(seg, { create: true });
    } else {
      let cur = memRoot;
      for (const seg of split(p)) {
        let next = cur.children.get(seg);
        if (!next) { next = { kind: 'directory', children: new Map(), mtime: Date.now() }; cur.children.set(seg, next); }
        cur = next;
      }
    }
    return p;
  }

  async function remove(path, opts) {
    const p = resolve('/', path);
    if (p === '/') throw new Error('不能删除根目录');
    const recursive = !!(opts && opts.recursive);
    try {
      const parent = await getDir(parentOf(p), false);
      if (mode === 'opfs') {
        await parent.removeEntry(baseName(p), { recursive });
      } else {
        const node = parent.children.get(baseName(p));
        if (!node) throw new Error('找不到：' + p);
        if (node.kind === 'directory' && !recursive && node.children.size > 0) {
          throw new Error('目录非空，需要递归删除：' + p);
        }
        parent.children.delete(baseName(p));
      }
      return p;
    } catch (err) {
      if (/不能删除|找不到|非空/.test(String(err.message || err))) throw err;
      throw friendly(err, p);
    }
  }

  async function copy(src, dst) {
    const s = resolve('/', src);
    const d = resolve('/', dst);
    if (s === d) throw new Error('源与目标相同');
    if (d.startsWith(s + '/')) throw new Error('不能把目录复制到其自身内部');
    const st = await stat(s);
    if (await exists(d)) throw new Error('目标已存在: ' + d);
    if (st.kind === 'file') {
      const blob = await readBlob(s);
      await write(d, blob);
    } else {
      await mkdirp(d);
      const entries = await list(s);
      for (const en of entries) {
        await copy(join(s, en.name), join(d, en.name));
      }
    }
    return d;
  }

  async function move(src, dst) {
    const d = await copy(src, dst);
    await remove(src, { recursive: true });
    return d;
  }

  // 同目录改名
  async function rename(path, newName) {
    const p = resolve('/', path);
    validateName(newName);
    return move(p, join(parentOf(p), newName));
  }

  // 递归统计目录/文件大小（真实字节）
  async function du(path) {
    const p = resolve('/', path);
    const st = await stat(p);
    if (st.kind === 'file') return st.size || 0;
    let total = 0;
    const entries = await list(p);
    for (const en of entries) {
      if (en.kind === 'file') total += en.size || 0;
      else total += await du(join(p, en.name));
    }
    return total;
  }

  // 递归遍历目录，返回 [{ path, kind, size }]（备份 / 智能体遍历用）
  async function walk(root) {
    const p = resolve('/', root || '/');
    const out = [];
    async function rec(path) {
      const st = await stat(path);
      out.push({ path, kind: st.kind, size: st.size || 0 });
      if (st.kind === 'directory') {
        const entries = await list(path);
        for (const en of entries) await rec(join(path, en.name));
      }
    }
    await rec(p);
    return out;
  }

  // 浏览器存储配额（真实值）
  async function usage() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        return { usage: est.usage || 0, quota: est.quota || 0 };
      }
    } catch (e) { /* 忽略 */ }
    return null;
  }

  // 清空全部文件（恢复出厂用）
  async function wipeAll() {
    if (mode === 'opfs') {
      const entries = await list('/');
      for (const en of entries) {
        await rootHandle.removeEntry(en.name, { recursive: true });
      }
      await mkdirp('/文稿'); await mkdirp('/图库'); await mkdirp('/下载');
    } else {
      memRoot = { kind: 'directory', children: new Map(), mtime: Date.now() };
    }
  }

  return {
    ready,
    get mode() { return mode; },
    resolve, join, split, baseName, parentOf,
    list, stat, exists, readBlob, readText, write,
    mkdir, mkdirp, remove, copy, move, rename, du, usage, wipeAll, walk,
  };
})();
