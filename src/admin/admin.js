/* AGT admin portal
 * - Blog: posts are JSON files in content/posts/ of the GitHub repo. Saving commits
 *   through the GitHub API; the deploy workflow rebuilds the site (pages, sitemap,
 *   RSS, llms files) and pushes it to static.app.
 * - Leads: read from the Supabase `leads` table (admins only, enforced by RLS).
 */
(function () {
  'use strict';

  var CFG = window.AGT_CONFIG || {};
  var GH = CFG.github || {};
  var POSTS_DIR = 'content/posts';
  var UPLOAD_DIR = 'static/uploads';
  var WORKFLOW = 'deploy.yml';
  var hasSupabase = Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  var sb = hasSupabase ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;

  var state = { token: null, user: null, posts: [], leads: [], current: null, blobMap: {}, htmlMode: false };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- utils ----------
  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (isErr ? ' err' : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, isErr ? 7000 : 3500);
  }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'onclick') n.addEventListener('click', attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function slugify(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }
  function fmt(d) { return d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function toLocalInput(d) {
    var x = new Date(d || Date.now());
    x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 16);
  }
  function utf8ToB64(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    var bin = atob(b64.replace(/\n/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1]); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  // ---------- GitHub API ----------
  function gh(path, opts) {
    opts = opts || {};
    if (!state.token) return Promise.reject(new Error('Add a GitHub token in Settings first.'));
    return fetch('https://api.github.com/repos/' + GH.owner + '/' + GH.repo + path, {
      method: opts.method || 'GET',
      headers: Object.assign({
        Authorization: 'Bearer ' + state.token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }, opts.body ? { 'Content-Type': 'application/json' } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store'
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error((j && j.message) || ('GitHub error ' + r.status));
          e.status = r.status;
          throw e;
        }
        return j;
      });
    });
  }
  function ghPut(path, b64, message, sha) {
    return gh('/contents/' + path, { method: 'PUT', body: { message: message, content: b64, branch: GH.branch, sha: sha || undefined } });
  }
  function ghDelete(path, sha, message) {
    return gh('/contents/' + path, { method: 'DELETE', body: { message: message, sha: sha, branch: GH.branch } });
  }

  // ---------- auth ----------
  function showLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#login-supabase').hidden = !hasSupabase;
    $('#login-token').hidden = hasSupabase;
    $('#repo-name').textContent = GH.owner + '/' + GH.repo;
    $$('#login-supabase input').forEach(function (i) { i.required = hasSupabase; });
  }

  function loadStoredToken() {
    try { return localStorage.getItem('agt_gh_token') || sessionStorage.getItem('agt_gh_token'); } catch (e) { return null; }
  }
  function storeToken(t, remember) {
    try {
      localStorage.removeItem('agt_gh_token'); sessionStorage.removeItem('agt_gh_token');
      if (t) (remember ? localStorage : sessionStorage).setItem('agt_gh_token', t);
    } catch (e) { /* storage blocked – token lives in memory only */ }
  }

  function afterSupabaseLogin(session) {
    state.user = session.user;
    return sb.from('admins').select('email').limit(1).then(function (r) {
      if (r.error || !r.data || !r.data.length) {
        return sb.auth.signOut().then(function () { throw new Error('This account is not an admin. Add its email to the admins table.'); });
      }
      return sb.from('admin_settings').select('value').eq('key', 'github_token').maybeSingle();
    }).then(function (r) {
      state.token = (r && r.data && r.data.value) || loadStoredToken();
      startApp();
    });
  }

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('#login-err');
    err.textContent = '';
    if (hasSupabase) {
      sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value })
        .then(function (r) { if (r.error) throw r.error; return afterSupabaseLogin(r.data.session); })
        .catch(function (x) { err.textContent = x.message || 'Sign-in failed'; });
    } else {
      var t = f.token.value.trim();
      if (!t) { err.textContent = 'Enter a GitHub token.'; return; }
      state.token = t;
      gh('').then(function (repo) {
        if (!repo.permissions || !repo.permissions.push) throw new Error('Token has no write access to ' + GH.repo);
        storeToken(t, f.remember.checked);
        startApp();
      }).catch(function (x) { state.token = null; err.textContent = x.message; });
    }
  });

  $('#logout').addEventListener('click', function () {
    storeToken(null);
    state.token = null;
    (sb ? sb.auth.signOut() : Promise.resolve()).then(function () { location.hash = ''; location.reload(); });
  });

  // ---------- routing ----------
  function startApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#who').textContent = state.user ? state.user.email : 'GitHub token';
    $('#admins-panel').hidden = !hasSupabase;
    var site = CFG.siteUrl || location.origin;
    $('#lnk-site').href = site + '/';
    $('#lnk-blog').href = site + '/blog/';
    $('#lnk-sitemap').href = site + '/sitemap.xml';
    $('#lnk-llms').href = site + '/llms.txt';
    $('#lnk-repo').href = 'https://github.com/' + GH.owner + '/' + GH.repo;
    $('#set-repo').textContent = GH.owner + '/' + GH.repo + ' (' + POSTS_DIR + ')';
    $('#token-status').textContent = state.token ? 'A token is saved.' : 'No token saved yet – blog publishing is disabled.';
    initEditor();
    window.addEventListener('hashchange', route);
    route();
    refreshLeadBadge();
  }

  function route() {
    var parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
    var tab = parts[0];
    if (!document.querySelector('[data-view="' + tab + '"]')) tab = 'dashboard';
    $$('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== tab; });
    $$('.side nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-tab') === tab); });
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'posts') loadPosts();
    if (tab === 'editor') openEditor(parts[1] ? decodeURIComponent(parts[1]) : null);
    if (tab === 'leads') loadLeads();
    if (!state.token && (tab === 'posts' || tab === 'editor')) toast('Add a GitHub token in Settings to manage blog posts.', true);
  }

  // ---------- dashboard ----------
  function loadDashboard() {
    fetchPosts().then(function () {
      var now = Date.now();
      var pub = state.posts.filter(function (p) { return p.data.status === 'published' && new Date(p.data.date) <= now; });
      $('#st-posts').textContent = pub.length;
      $('#st-drafts').textContent = state.posts.length - pub.length;
    }).catch(function () { $('#st-posts').textContent = '–'; });
    loadRuns();
    if (hasSupabase) {
      var weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new').then(function (r) { $('#st-leads').textContent = r.count == null ? '–' : r.count; });
      sb.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo).then(function (r) { $('#st-leads-7').textContent = r.count == null ? '–' : r.count; });
    }
  }

  function loadRuns() {
    var tb = $('#runs');
    if (!state.token) { tb.innerHTML = '<tr><td colspan="4" class="muted">Add a GitHub token in Settings to see deployments.</td></tr>'; return; }
    gh('/actions/runs?per_page=6').then(function (j) {
      tb.innerHTML = '';
      (j.workflow_runs || []).forEach(function (r) {
        var s = r.status === 'completed' ? r.conclusion : r.status;
        tb.appendChild(el('tr', {}, [
          el('td', {}, [el('span', { class: 'pill pill-' + s, text: s })]),
          el('td', { text: (r.head_commit && r.head_commit.message || r.display_title || '').split('\n')[0] }),
          el('td', { text: fmt(r.created_at) }),
          el('td', {}, [el('a', { href: r.html_url, target: '_blank', rel: 'noopener', text: 'Log' })])
        ]));
      });
      if (!tb.children.length) tb.innerHTML = '<tr><td colspan="4" class="muted">No deployments yet.</td></tr>';
      if ((j.workflow_runs || []).some(function (r) { return r.status !== 'completed'; })) {
        clearTimeout(loadRuns._t);
        loadRuns._t = setTimeout(function () { if (!$('[data-view="dashboard"]').hidden) loadRuns(); }, 10000);
      }
    }).catch(function (e) { tb.innerHTML = ''; tb.appendChild(el('tr', {}, [el('td', { colspan: '4', class: 'muted', text: e.message })])); });
  }

  $('#btn-deploy').addEventListener('click', function () {
    gh('/actions/workflows/' + WORKFLOW + '/dispatches', { method: 'POST', body: { ref: GH.branch } })
      .then(function () { toast('Rebuild started.'); setTimeout(loadRuns, 3000); })
      .catch(function (e) { toast(e.message, true); });
  });

  // ---------- posts ----------
  function fetchPosts() {
    if (!state.token) return Promise.reject(new Error('No token'));
    return gh('/contents/' + POSTS_DIR + '?ref=' + GH.branch).catch(function (e) {
      if (e.status === 404) return [];
      throw e;
    }).then(function (files) {
      files = (files || []).filter(function (f) { return /\.json$/.test(f.name); });
      return Promise.all(files.map(function (f) {
        var cached = state.posts.find(function (p) { return p.sha === f.sha; });
        if (cached) return cached;
        return gh('/contents/' + f.path + '?ref=' + GH.branch).then(function (j) {
          var data;
          try { data = JSON.parse(b64ToUtf8(j.content)); } catch (e) { data = { title: f.name + ' (invalid JSON)' }; }
          return { path: f.path, sha: j.sha, slug: f.name.replace(/\.json$/, ''), data: data };
        });
      }));
    }).then(function (list) {
      state.posts = list.sort(function (a, b) { return String(b.data.date || '').localeCompare(String(a.data.date || '')); });
      return state.posts;
    });
  }

  function loadPosts() {
    var tb = $('#post-rows');
    fetchPosts().then(renderPosts).catch(function (e) {
      tb.innerHTML = '';
      tb.appendChild(el('tr', {}, [el('td', { colspan: '4', class: 'muted', text: e.message })]));
    });
  }
  function renderPosts() {
    var q = $('#post-search').value.toLowerCase();
    var tb = $('#post-rows');
    tb.innerHTML = '';
    var now = Date.now();
    state.posts.filter(function (p) { return !q || (p.data.title || '').toLowerCase().indexOf(q) > -1; }).forEach(function (p) {
      var st = p.data.status === 'published' ? (new Date(p.data.date) > now ? 'scheduled' : 'published') : 'draft';
      tb.appendChild(el('tr', {}, [
        el('td', {}, [el('a', { href: '#/editor/' + encodeURIComponent(p.slug), text: p.data.title || p.slug }), el('div', { class: 'muted small', text: '/blog/' + p.slug + '/' })]),
        el('td', {}, [el('span', { class: 'pill pill-' + st, text: st })]),
        el('td', { text: fmt(p.data.date) }),
        el('td', { class: 'actions' }, [
          el('a', { class: 'btn small ghost', href: '#/editor/' + encodeURIComponent(p.slug), text: 'Edit' }),
          st === 'published' ? el('a', { class: 'btn small ghost', href: (CFG.siteUrl || '') + '/blog/' + p.slug + '/', target: '_blank', rel: 'noopener', text: 'View' }) : null
        ])
      ]));
    });
    if (!tb.children.length) tb.innerHTML = '<tr><td colspan="4" class="muted">No posts yet. Click “New post”.</td></tr>';
  }
  $('#post-search').addEventListener('input', renderPosts);
  // "New post" while already on #/editor doesn't fire hashchange – reset manually.
  $('.side nav a[data-tab="editor"]').addEventListener('click', function () {
    if (location.hash === '#/editor' && (!state.dirty || confirm('Discard unsaved changes?'))) openEditor(null);
  });

  // ---------- editor ----------
  var quill;
  function initEditor() {
    if (quill) return;
    quill = new Quill('#quill', {
      theme: 'snow',
      placeholder: 'Write your article…',
      modules: {
        toolbar: {
          container: [
            [{ header: [2, 3, 4, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
            [{ align: [] }],
            ['blockquote', 'code-block'],
            ['link', 'image', 'video'],
            ['clean']
          ],
          handlers: { image: function () { pickImage().then(insertImage); } }
        },
        clipboard: {}
      }
    });
    quill.on('text-change', updateCounts);

    var f = $('#post-form');
    f.title.addEventListener('input', function () {
      if (!f.slug.dataset.touched && !(state.current && state.current.sha)) f.slug.value = slugify(f.title.value);
      updateSerp();
    });
    f.slug.addEventListener('input', function () { f.slug.dataset.touched = '1'; f.slug.value = slugify(f.slug.value) || f.slug.value.toLowerCase(); updateSerp(); });
    ['metaTitle', 'metaDescription', 'excerpt'].forEach(function (n) { f[n].addEventListener('input', updateSerp); });
    $('#btn-cover').addEventListener('click', function () {
      pickImage().then(function (up) { f.cover.value = up.path; setCoverPreview(up.preview); });
    });
    $('#btn-cover-clear').addEventListener('click', function () { f.cover.value = ''; setCoverPreview(''); });
    $('#btn-save-draft').addEventListener('click', function () { savePost('draft'); });
    $('#btn-publish').addEventListener('click', function () { savePost('published'); });
    $('#btn-delete').addEventListener('click', deletePost);
    $('#toggle-html').addEventListener('click', toggleHtml);
    window.addEventListener('beforeunload', function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
    f.addEventListener('input', function () { state.dirty = true; });
    quill.on('text-change', function (d, o, src) { if (src === 'user') state.dirty = true; });
  }

  function setCoverPreview(src) {
    var box = $('#cover-preview');
    box.innerHTML = '';
    if (src) box.appendChild(el('img', { src: src, alt: '' }));
  }

  function openEditor(slug) {
    var f = $('#post-form');
    state.htmlMode = false;
    $('#html-source').hidden = true;
    $('#quill').parentElement.querySelector('.ql-toolbar').hidden = false;
    $('#quill').hidden = false;
    $('#toggle-html').textContent = 'Edit HTML';
    f.reset();
    delete f.slug.dataset.touched;
    state.blobMap = {};
    state.dirty = false;

    var load = slug ? fetchPosts().then(function () {
      var p = state.posts.find(function (x) { return x.slug === slug; });
      if (!p) throw new Error('Post not found: ' + slug);
      return p;
    }) : Promise.resolve(null);

    load.then(function (p) {
      state.current = p ? { slug: p.slug, sha: p.sha, path: p.path } : null;
      var d = p ? p.data : { status: 'draft', date: new Date().toISOString(), author: '' };
      $('#editor-title').textContent = p ? 'Edit post' : 'New post';
      f.title.value = d.title || '';
      f.slug.value = p ? p.slug : '';
      if (p) f.slug.dataset.touched = '1';
      f.status.value = d.status || 'draft';
      f.date.value = toLocalInput(d.date);
      f.author.value = d.author || '';
      f.tags.value = (d.tags || []).join(', ');
      f.cover.value = d.cover || '';
      f.coverAlt.value = d.coverAlt || '';
      f.metaTitle.value = d.metaTitle || '';
      f.metaDescription.value = d.metaDescription || '';
      f.excerpt.value = d.excerpt || '';
      setCoverPreview(d.cover || '');
      quill.setContents([]);
      if (d.content) quill.clipboard.dangerouslyPasteHTML(0, d.content, 'silent');
      $('#btn-delete').hidden = !p;
      var live = $('#btn-view-live');
      live.hidden = !(p && d.status === 'published');
      live.href = (CFG.siteUrl || '') + '/blog/' + (p ? p.slug : '') + '/';
      updateSerp(); updateCounts();
      state.dirty = false;
    }).catch(function (e) { toast(e.message, true); });
  }

  function toggleHtml() {
    var src = $('#html-source');
    var toolbar = $('#quill').parentElement.querySelector('.ql-toolbar');
    if (!state.htmlMode) {
      src.value = getHtml();
      src.hidden = false; $('#quill').hidden = true; toolbar.hidden = true;
      $('#toggle-html').textContent = 'Back to visual editor';
    } else {
      quill.setContents([]);
      quill.clipboard.dangerouslyPasteHTML(0, src.value, 'user');
      src.hidden = true; $('#quill').hidden = false; toolbar.hidden = false;
      $('#toggle-html').textContent = 'Edit HTML';
    }
    state.htmlMode = !state.htmlMode;
  }

  function getHtml() {
    if (state.htmlMode) return $('#html-source').value;
    var html = quill.getSemanticHTML().replace(/&nbsp;/g, ' ').replace(/(\S) {2,}/g, '$1 ');
    return html === '<p></p>' ? '' : html;
  }

  function updateCounts() {
    var words = quill.getText().trim().split(/\s+/).filter(Boolean).length;
    $('#word-count').textContent = words + ' words · ~' + Math.max(1, Math.round(words / 220)) + ' min read';
  }

  function updateSerp() {
    var f = $('#post-form');
    var title = f.metaTitle.value || f.title.value || 'Post title';
    var desc = f.metaDescription.value || f.excerpt.value || quill.getText().slice(0, 155) || 'Meta description preview…';
    $('#serp-title').textContent = title;
    $('#serp-desc').textContent = desc.length > 160 ? desc.slice(0, 157) + '…' : desc;
    $('#serp-url').textContent = (CFG.siteUrl || location.origin).replace(/^https?:\/\//, '') + ' › blog › ' + (f.slug.value || 'post-url');
    $$('.counter').forEach(function (c) {
      var n = f[c.getAttribute('data-for')].value.length, max = +c.getAttribute('data-max');
      c.textContent = n + '/' + max;
      c.className = 'counter' + (n > max ? ' over' : '');
    });
  }

  // Image upload: resize + convert to WebP, commit to static/uploads/YYYY/MM/.
  function pickImage() {
    return new Promise(function (resolve) {
      var input = $('#file-input');
      input.value = '';
      input.onchange = function () { if (input.files[0]) resolve(uploadImage(input.files[0])); };
      input.click();
    });
  }

  function optimise(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.resolve({ blob: file, ext: (file.name.split('.').pop() || 'img').toLowerCase() });
    return createImageBitmap(file).then(function (bmp) {
      var max = 1600, scale = Math.min(1, max / bmp.width);
      var c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) {
        c.toBlob(function (b) { res(b && b.size < file.size ? { blob: b, ext: 'webp' } : { blob: file, ext: file.type.split('/')[1].replace('jpeg', 'jpg') }); }, 'image/webp', 0.82);
      });
    }).catch(function () { return { blob: file, ext: 'jpg' }; });
  }

  function uploadImage(file) {
    if (file.size > 15 * 1024 * 1024) { toast('Image is larger than 15 MB.', true); return Promise.reject(new Error('too large')); }
    toast('Uploading image…');
    return optimise(file).then(function (o) {
      var now = new Date();
      var base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'image';
      var rel = now.getFullYear() + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + base + '-' + Date.now().toString(36) + '.' + o.ext;
      return blobToB64(o.blob).then(function (b64) {
        return ghPut(UPLOAD_DIR + '/' + rel, b64, 'Upload image ' + rel);
      }).then(function () {
        var preview = URL.createObjectURL(o.blob);
        var sitePath = '/uploads/' + rel;
        state.blobMap[preview] = sitePath;
        toast('Image uploaded.');
        return { path: sitePath, preview: preview };
      });
    }).catch(function (e) { toast('Upload failed: ' + e.message, true); throw e; });
  }

  function insertImage(up) {
    var range = quill.getSelection(true);
    quill.insertEmbed(range ? range.index : quill.getLength(), 'image', up.preview, 'user');
    var alt = prompt('Alt text for this image (describe it for SEO & accessibility):', '');
    if (alt) {
      var img = $('#quill img[src="' + up.preview + '"]');
      if (img) img.setAttribute('alt', alt);
    }
  }

  // Pasted/dropped images arrive as data: URLs – upload them before saving.
  function uploadInlineDataImages(html) {
    var re = /src="(data:image\/([a-z+]+);base64,([^"]+))"/g, m, jobs = [];
    while ((m = re.exec(html))) {
      (function (full, type, b64) {
        jobs.push(fetch(full).then(function (r) { return r.blob(); }).then(function (blob) {
          return uploadImage(new File([blob], 'pasted.' + type.replace('jpeg', 'jpg').replace('svg+xml', 'svg'), { type: blob.type }));
        }).then(function (up) { html = html.split(full).join(up.path); }));
      })(m[1], m[2], m[3]);
    }
    return Promise.all(jobs).then(function () { return html; });
  }

  function normaliseHtml(html) {
    Object.keys(state.blobMap).forEach(function (b) { html = html.split(b).join(state.blobMap[b]); });
    // YouTube watch/short links → embeddable URLs
    html = html.replace(/https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]+)[^"]*/g, 'https://www.youtube-nocookie.com/embed/$1')
      .replace(/https:\/\/youtu\.be\/([\w-]+)[^"]*/g, 'https://www.youtube-nocookie.com/embed/$1');
    return html;
  }

  function savePost(status) {
    if (!state.token) { toast('Add a GitHub token in Settings first.', true); return; }
    var f = $('#post-form');
    var title = f.title.value.trim();
    var slug = slugify(f.slug.value || title);
    if (!title) { toast('Title is required.', true); f.title.focus(); return; }
    if (!slug) { toast('Slug is required.', true); return; }
    var html = getHtml();
    if (status === 'published' && stripText(html).length < 50) { toast('Add some content before publishing.', true); return; }

    var cur = state.current;
    var clash = state.posts.find(function (p) { return p.slug === slug && (!cur || p.slug !== cur.slug); });
    if (clash) { toast('Another post already uses /blog/' + slug + '/', true); return; }

    var btns = $$('#btn-save-draft, #btn-publish');
    btns.forEach(function (b) { b.disabled = true; });
    toast('Saving…');

    uploadInlineDataImages(normaliseHtml(html)).then(function (content) {
      var existing = cur && state.posts.find(function (p) { return p.slug === cur.slug; });
      var now = new Date().toISOString();
      var cover = f.cover.value;
      Object.keys(state.blobMap).forEach(function (b) { if (cover === b) cover = state.blobMap[b]; });
      var data = {
        title: title,
        slug: slug,
        status: status,
        date: new Date(f.date.value || Date.now()).toISOString(),
        updated: now,
        author: f.author.value.trim() || undefined,
        tags: f.tags.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
        cover: cover || undefined,
        coverAlt: f.coverAlt.value.trim() || undefined,
        metaTitle: f.metaTitle.value.trim() || undefined,
        metaDescription: f.metaDescription.value.trim() || undefined,
        excerpt: f.excerpt.value.trim() || undefined,
        content: content
      };
      if (existing && existing.data.created) data.created = existing.data.created; else data.created = now;
      var json = JSON.stringify(data, null, 2) + '\n';
      var path = POSTS_DIR + '/' + slug + '.json';
      var renamed = cur && cur.slug !== slug;
      var verb = status === 'published' ? 'Publish' : 'Save draft';
      return ghPut(path, utf8ToB64(json), verb + ': ' + title, renamed ? undefined : (cur && cur.sha)).then(function (res) {
        if (renamed) return ghDelete(cur.path, cur.sha, 'Rename post ' + cur.slug + ' → ' + slug).then(function () { return res; });
        return res;
      }).then(function (res) {
        state.posts = state.posts.filter(function (p) { return !cur || p.slug !== cur.slug; });
        state.posts.unshift({ path: path, sha: res.content.sha, slug: slug, data: data });
        state.current = { slug: slug, sha: res.content.sha, path: path };
        state.dirty = false;
        f.status.value = status;
        $('#btn-delete').hidden = false;
        $('#editor-title').textContent = 'Edit post';
        if (location.hash !== '#/editor/' + slug) history.replaceState(null, '', '#/editor/' + slug);
        var scheduled = status === 'published' && new Date(data.date) > new Date();
        toast(status === 'published'
          ? (scheduled ? 'Scheduled – it goes live on ' + fmt(data.date) + ' (daily rebuild).' : 'Published! The site rebuilds in 1–2 minutes.')
          : 'Draft saved.');
        var live = $('#btn-view-live');
        live.hidden = status !== 'published';
        live.href = (CFG.siteUrl || '') + '/blog/' + slug + '/';
      });
    }).catch(function (e) {
      toast('Save failed: ' + e.message + (e.status === 409 ? ' (post changed elsewhere – reload and retry)' : ''), true);
    }).then(function () { btns.forEach(function (b) { b.disabled = false; }); });
  }

  function stripText(html) { var d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').trim(); }

  function deletePost() {
    var cur = state.current;
    if (!cur || !confirm('Delete this post permanently? It will be removed from the site on the next rebuild.')) return;
    ghDelete(cur.path, cur.sha, 'Delete post ' + cur.slug).then(function () {
      state.posts = state.posts.filter(function (p) { return p.slug !== cur.slug; });
      state.dirty = false;
      toast('Post deleted.');
      location.hash = '#/posts';
    }).catch(function (e) { toast(e.message, true); });
  }

  // ---------- leads ----------
  function refreshLeadBadge() {
    if (!hasSupabase) return;
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new').then(function (r) {
      var b = $('#new-leads-badge');
      b.hidden = !r.count;
      b.textContent = r.count || '';
    });
  }

  function loadLeads() {
    $('#leads-setup').hidden = hasSupabase;
    if (!hasSupabase) { $('#lead-rows').innerHTML = ''; return; }
    $('#lead-count').textContent = 'Loading…';
    sb.from('leads').select('*').order('created_at', { ascending: false }).limit(1000).then(function (r) {
      if (r.error) { toast(r.error.message, true); return; }
      state.leads = r.data || [];
      renderLeads();
      refreshLeadBadge();
    });
  }

  function filteredLeads() {
    var q = $('#lead-search').value.toLowerCase(), st = $('#lead-status').value;
    return state.leads.filter(function (l) {
      if (st && l.status !== st) return false;
      if (!q) return true;
      return [l.name, l.email, l.phone, l.origin, l.destination, l.message].join(' ').toLowerCase().indexOf(q) > -1;
    });
  }

  function renderLeads() {
    var tb = $('#lead-rows'), list = filteredLeads();
    tb.innerHTML = '';
    list.forEach(function (l) {
      tb.appendChild(el('tr', { class: l.status === 'new' ? 'is-new' : '' }, [
        el('td', { text: fmt(l.created_at) }),
        el('td', {}, [el('strong', { text: l.name })]),
        el('td', {}, [el('a', { href: 'tel:' + l.phone, text: l.phone }), el('br'), el('a', { href: 'mailto:' + l.email, text: l.email })]),
        el('td', {}, [
          document.createTextNode((l.origin || '?') + ' → ' + (l.destination || '?')),
          el('div', { class: 'muted small', text: [l.trip_type, l.cabin, l.depart_date && ('dep ' + l.depart_date), l.return_date && ('ret ' + l.return_date)].filter(Boolean).join(' · ') })
        ]),
        el('td', { text: l.passengers || '' }),
        el('td', {}, [el('span', { class: 'pill pill-' + l.status, text: l.status })]),
        el('td', {}, [el('button', { class: 'btn small ghost', text: 'Open', onclick: function () { openLead(l); } })])
      ]));
    });
    if (!list.length) tb.innerHTML = '<tr><td colspan="7" class="muted">No leads found.</td></tr>';
    $('#lead-count').textContent = list.length + ' of ' + state.leads.length + ' leads';
  }
  $('#lead-search').addEventListener('input', renderLeads);
  $('#lead-status').addEventListener('change', renderLeads);
  $('#btn-leads-refresh').addEventListener('click', loadLeads);

  var openLeadRow = null;
  function openLead(l) {
    openLeadRow = l;
    $('#ld-name').textContent = l.name;
    var dl = $('#ld-details');
    dl.innerHTML = '';
    [['Received', fmt(l.created_at)], ['Email', l.email], ['Phone', l.phone], ['Trip', l.trip_type], ['From', l.origin], ['To', l.destination],
      ['Departure', l.depart_date], ['Return', l.return_date], ['Travelers', l.passengers], ['Cabin', l.cabin], ['Message', l.message],
      ['Page', l.page_url], ['Referrer', l.referrer], ['UTM', l.utm]].forEach(function (x) {
      if (x[1] == null || x[1] === '') return;
      dl.appendChild(el('dt', { text: x[0] }));
      dl.appendChild(el('dd', { text: String(x[1]) }));
    });
    $('#ld-status').value = l.status;
    $('#ld-notes').value = l.notes || '';
    $('#lead-dialog').showModal();
  }
  $('#ld-save').addEventListener('click', function () {
    var l = openLeadRow, patch = { status: $('#ld-status').value, notes: $('#ld-notes').value || null };
    sb.from('leads').update(patch).eq('id', l.id).then(function (r) {
      if (r.error) { toast(r.error.message, true); return; }
      Object.assign(l, patch);
      renderLeads(); refreshLeadBadge();
      $('#lead-dialog').close();
      toast('Lead updated.');
    });
  });
  $('#ld-delete').addEventListener('click', function () {
    var l = openLeadRow;
    if (!confirm('Delete lead from ' + l.name + '? This cannot be undone.')) return;
    sb.from('leads').delete().eq('id', l.id).then(function (r) {
      if (r.error) { toast(r.error.message, true); return; }
      state.leads = state.leads.filter(function (x) { return x.id !== l.id; });
      renderLeads(); refreshLeadBadge();
      $('#lead-dialog').close();
      toast('Lead deleted.');
    });
  });

  $('#btn-leads-csv').addEventListener('click', function () {
    var cols = ['created_at', 'status', 'name', 'email', 'phone', 'trip_type', 'origin', 'destination', 'depart_date', 'return_date', 'passengers', 'cabin', 'message', 'notes', 'page_url', 'referrer', 'utm'];
    var cell = function (v) {
      v = v == null ? '' : String(v);
      if (/^[=+\-@]/.test(v)) v = "'" + v; // block spreadsheet formula injection
      return '"' + v.replace(/"/g, '""') + '"';
    };
    var csv = [cols.join(',')].concat(filteredLeads().map(function (l) { return cols.map(function (c) { return cell(l[c]); }).join(','); })).join('\r\n');
    var a = el('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: 'agt-leads-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  });

  // ---------- settings ----------
  $('#token-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = e.target.token.value.trim();
    if (!t) return;
    var prev = state.token;
    state.token = t;
    gh('').then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw new Error('Token has no write access to ' + GH.repo);
      if (hasSupabase) {
        return sb.from('admin_settings').upsert({ key: 'github_token', value: t, updated_at: new Date().toISOString() }).then(function (r) { if (r.error) throw r.error; });
      }
      storeToken(t, true);
    }).then(function () {
      e.target.reset();
      $('#token-status').textContent = 'Token verified and saved' + (hasSupabase ? ' for all admins.' : ' on this device.');
      toast('GitHub token saved.');
    }).catch(function (x) {
      state.token = prev;
      toast(x.message, true);
    });
  });

  // ---------- boot ----------
  if (!GH.owner || !GH.repo) { document.body.textContent = 'Missing github config in site.config.json'; return; }
  if (hasSupabase) {
    sb.auth.getSession().then(function (r) {
      if (r.data && r.data.session) afterSupabaseLogin(r.data.session).catch(function () { showLogin(); });
      else showLogin();
    });
  } else {
    var t = loadStoredToken();
    if (t) { state.token = t; startApp(); } else showLogin();
  }
})();
