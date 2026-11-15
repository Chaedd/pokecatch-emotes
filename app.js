(() => {
'use strict';

const C = window.CONFIG || {};
// Demo (fake lots, nothing sent): when config.js is empty, or with ?demo on a local address.
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const DEMO = !C.supabaseUrl || !C.supabaseKey || (LOCAL && new URLSearchParams(location.search).has('demo'));
const BUCKET = 'emotes';
// zip: archive read in the browser · raw: one source image · out: one emote sent (Discord's limit)
const LIM = { zip: 20 << 20, raw: 4 << 20, out: 256 << 10, side: 256, entries: 300 };
const NAME_RE = /^[a-z0-9_]{2,32}$/;

// ───────────────────────── Texts (EN / FR) ─────────────────────────

const TEXTS = {
  en: {
    title: 'Emote Contest', login: 'Log in with Discord', logout: 'Log out',
    demo: 'Demo mode: fake lots, nothing is sent anywhere. Fill in config.js to go live.',
    tab_gallery: 'Gallery', tab_mine: 'My lot', tab_admin: 'Moderation',
    ph_submit: 'Submissions are open: log in and drop your emote lot.',
    ph_vote: 'Voting is open: pick your favourite lots ({n} votes each).',
    ph_both: 'Submissions and voting are open ({n} votes each).',
    ph_closed: 'The contest is closed. Thanks to everyone who took part!',
    no_lots: 'No lot to show yet.',
    by: 'by {name}', votes: '{n} votes', vote: 'Vote', voted: '✓ Voted', your_lot: 'Your lot',
    votes_left: 'Your votes: {a} / {b}', light: 'Light', dark: 'Dark', in_chat: 'in chat:',
    need_login: 'Log in with Discord to submit a lot or vote.',
    not_member: 'This contest is for members of the Poke\'Catch Discord server. Join it, then log in again.',
    join: 'Join the server', relog: 'Log in again',
    sub_closed: 'Submissions are closed.',
    st_pending: 'Awaiting review', st_approved: 'Published', st_rejected: 'Not accepted',
    replace: 'Replace my lot', replace_warn: 'Sending a new lot replaces this one: it goes back to review and its votes are cleared.',
    drop: 'Drop your images or a .zip here, or click to choose',
    drop_sub: 'PNG, GIF or WebP · up to {n} emotes · 256 KB each · the zip is opened in your browser, only the images are sent',
    rules_1: 'Still images are re-drawn as PNG (max 256 px). Animated emotes: GIF only.',
    rules_2: 'Names: 2 to 32 characters, lowercase letters, digits and _',
    rules_3: 'One lot per member. Your lot appears in the gallery once reviewed.',
    f_title: 'Name of your lot', f_note: 'A word about it (optional)',
    send: 'Send my lot', sending: 'Sending… {a} / {b}', sent: 'Lot sent! It will appear in the gallery once reviewed.',
    clear: 'Clear', skipped: '{n} file(s) of the archive ignored (not PNG / GIF / WebP).',
    e_type: 'not a PNG, GIF or WebP image', e_decode: 'unreadable image', e_big: 'file too large',
    e_heavy: 'over 256 KB once prepared — make it smaller', e_toomany: 'lot is full',
    e_zip: 'unreadable zip', e_zipbig: 'zip over 20 MB',
    e_title: 'Give your lot a name (60 characters max).', e_name: 'Check the emote names (2-32: a-z, 0-9, _, no duplicates).',
    e_count: 'Add at least one emote.', e_member: 'You must be a member of the Discord server.', e_closed: 'Submissions are closed.',
    e_novote: 'Voting is not open.', e_own: 'You cannot vote for your own lot.', e_maxvotes: 'You have used all your votes — remove one first.',
    e_generic: 'Something went wrong: {msg}',
    a_subs: 'Submissions open', a_votes: 'Voting open', a_counts: 'Scores visible to everyone', a_max: 'Votes per member',
    a_members: '{n} verified members · {l} lots', approve: 'Approve', reject: 'Reject', del: 'Delete',
    del_confirm: 'Delete this lot and its files for good?', download: 'Download (clean copies)',
  },
  fr: {
    title: 'Concours d\'emotes', login: 'Se connecter avec Discord', logout: 'Déconnexion',
    demo: 'Mode démo : faux lots, rien n\'est envoyé nulle part. Remplis config.js pour passer en vrai.',
    tab_gallery: 'Galerie', tab_mine: 'Mon lot', tab_admin: 'Modération',
    ph_submit: 'Les dépôts sont ouverts : connecte-toi et dépose ton lot d\'emotes.',
    ph_vote: 'Les votes sont ouverts : choisis tes lots préférés ({n} votes chacun).',
    ph_both: 'Dépôts et votes sont ouverts ({n} votes chacun).',
    ph_closed: 'Le concours est terminé. Merci à tous les participants !',
    no_lots: 'Aucun lot à afficher pour l\'instant.',
    by: 'par {name}', votes: '{n} votes', vote: 'Voter', voted: '✓ Voté', your_lot: 'Ton lot',
    votes_left: 'Tes votes : {a} / {b}', light: 'Clair', dark: 'Sombre', in_chat: 'dans le chat :',
    need_login: 'Connecte-toi avec Discord pour déposer un lot ou voter.',
    not_member: 'Ce concours est réservé aux membres du serveur Discord Poke\'Catch. Rejoins-le, puis reconnecte-toi.',
    join: 'Rejoindre le serveur', relog: 'Se reconnecter',
    sub_closed: 'Les dépôts sont fermés.',
    st_pending: 'En attente de validation', st_approved: 'Publié', st_rejected: 'Non retenu',
    replace: 'Remplacer mon lot', replace_warn: 'Envoyer un nouveau lot remplace celui-ci : il repasse en validation et ses votes sont remis à zéro.',
    drop: 'Dépose tes images ou un .zip ici, ou clique pour choisir',
    drop_sub: 'PNG, GIF ou WebP · jusqu\'à {n} emotes · 256 Ko chacune · le zip est ouvert dans ton navigateur, seules les images sont envoyées',
    rules_1: 'Les images fixes sont redessinées en PNG (256 px max). Emotes animées : GIF uniquement.',
    rules_2: 'Noms : 2 à 32 caractères, lettres minuscules, chiffres et _',
    rules_3: 'Un lot par membre. Ton lot apparaît dans la galerie après validation.',
    f_title: 'Nom de ton lot', f_note: 'Un mot dessus (facultatif)',
    send: 'Envoyer mon lot', sending: 'Envoi… {a} / {b}', sent: 'Lot envoyé ! Il apparaîtra dans la galerie après validation.',
    clear: 'Vider', skipped: '{n} fichier(s) de l\'archive ignoré(s) (ni PNG, ni GIF, ni WebP).',
    e_type: 'pas une image PNG, GIF ou WebP', e_decode: 'image illisible', e_big: 'fichier trop gros',
    e_heavy: 'plus de 256 Ko une fois préparée — réduis-la', e_toomany: 'le lot est plein',
    e_zip: 'zip illisible', e_zipbig: 'zip de plus de 20 Mo',
    e_title: 'Donne un nom à ton lot (60 caractères max).', e_name: 'Vérifie les noms des emotes (2-32 : a-z, 0-9, _, sans doublon).',
    e_count: 'Ajoute au moins une emote.', e_member: 'Tu dois être membre du serveur Discord.', e_closed: 'Les dépôts sont fermés.',
    e_novote: 'Les votes ne sont pas ouverts.', e_own: 'Tu ne peux pas voter pour ton propre lot.', e_maxvotes: 'Tu as utilisé tous tes votes — retires-en un d\'abord.',
    e_generic: 'Une erreur est survenue : {msg}',
    a_subs: 'Dépôts ouverts', a_votes: 'Votes ouverts', a_counts: 'Scores visibles par tous', a_max: 'Votes par membre',
    a_members: '{n} membres vérifiés · {l} lots', approve: 'Approuver', reject: 'Refuser', del: 'Supprimer',
    del_confirm: 'Supprimer définitivement ce lot et ses fichiers ?', download: 'Télécharger (copies nettoyées)',
  },
};

let lang = 'en';
try { lang = localStorage.getItem('lang') || ((navigator.language || '').startsWith('fr') ? 'fr' : 'en'); } catch { /* private mode */ }
if (!TEXTS[lang]) lang = 'en';
const t = (k, v = {}) => (TEXTS[lang][k] ?? TEXTS.en[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '');
const errText = (e) => {
  const code = String(e && e.message || e);
  return TEXTS.en['e_' + code] ? t('e_' + code) : t('e_generic', { msg: code });
};

// ───────────────────────── Tiny DOM helper (text is never parsed as HTML) ─────────────────────────

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
  return el;
}

// ───────────────────────── Files: zip opened here, images checked and re-drawn ─────────────────────────

const MIME = { png: 'image/png', gif: 'image/gif', webp: 'image/webp' };

// The real type, read from the first bytes — the extension and the declared type are ignored.
function sniff(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}

async function inflate(data, limit) {
  const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) { reader.cancel().catch(() => {}); throw new Error('big'); } // zip bomb
    parts.push(value);
  }
  return new Blob(parts);
}

// Minimal zip reader: image entries only, everything else is never extracted.
async function unzip(file) {
  if (file.size > LIM.zip) throw new Error('zipbig');
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let e = buf.length - 22;
  const min = Math.max(0, buf.length - 65557);
  while (e >= min && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < min || e < 0) throw new Error('zip');
  const count = Math.min(dv.getUint16(e + 10, true), LIM.entries);
  let p = dv.getUint32(e + 16, true);
  const files = []; let skipped = 0; const failed = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || dv.getUint32(p, true) !== 0x02014b50) break;
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const full = dec.decode(buf.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + el + cl;
    const base = full.split(/[\\/]/).pop();
    if (!base || full.endsWith('/') || base.startsWith('.') || full.includes('__MACOSX')) continue;
    if (!/\.(png|gif|webp)$/i.test(base)) { skipped++; continue; }
    try {
      if ((flags & 1) || (method !== 0 && method !== 8) || off + 30 > buf.length) throw new Error('zip');
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const data = buf.subarray(start, start + csize);
      const blob = method === 0 ? new Blob([data]) : await inflate(data, LIM.raw);
      files.push(new File([blob], base));
    } catch (err) { failed.push({ name: base, err }); }
  }
  return { files, skipped, failed };
}

function emoteName(fileName) {
  let n = fileName.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  if (n.length < 2) n = 'emote_' + (n || 'x');
  return n;
}

// One image in, one safe emote out: decoded by the browser, then (still images) re-drawn
// on a canvas and saved as a brand-new PNG — only pixels survive.
async function clean(file) {
  if (file.size > LIM.raw) throw new Error('big');
  const kind = sniff(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!kind) throw new Error('type');
  const typed = new Blob([file], { type: MIME[kind] });
  let bmp;
  try { bmp = await createImageBitmap(typed); } catch { throw new Error('decode'); }
  let blob, ext;
  if (kind === 'gif') {            // kept as is, or the animation would be lost
    if (file.size > LIM.out) throw new Error('heavy');
    blob = typed; ext = 'gif';
  } else {
    const k = Math.min(1, LIM.side / Math.max(bmp.width, bmp.height));
    const cv = h('canvas', { width: Math.max(1, Math.round(bmp.width * k)), height: Math.max(1, Math.round(bmp.height * k)) });
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!blob) throw new Error('decode');
    if (blob.size > LIM.out) throw new Error('heavy');
    ext = 'png';
  }
  if (bmp.close) bmp.close();
  return { name: emoteName(file.name), blob, ext, url: URL.createObjectURL(blob) };
}

// ───────────────────────── Backend: Supabase, or a fake one for the demo ─────────────────────────

function supabaseApi() {
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  let uid = null, checked = false;
  const rpc = async (fn, args) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  };
  return {
    init(onChange) {
      sb.auth.onAuthStateChange((_ev, session) => {
        uid = session && session.user ? session.user.id : null;
        // Never call Supabase from inside this callback: defer.
        setTimeout(async () => {
          if (session && session.provider_token && !checked) {
            checked = true;   // the Discord token is only there right after the login
            try { await rpc('verify_member', { token: session.provider_token }); } catch (e) { console.warn(e); }
          }
          onChange();
        }, 0);
      });
    },
    login: () => sb.auth.signInWithOAuth({
      provider: 'discord',
      options: { scopes: 'identify guilds.members.read', redirectTo: location.origin + location.pathname },
    }),
    logout: () => sb.auth.signOut(),
    state: () => rpc('state'),
    url: (path) => `${C.supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`,
    async upload(blob, ext) {
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: MIME[ext], cacheControl: '31536000' });
      if (error) throw new Error(error.message);
      return path;
    },
    async remove(paths) { if (paths.length) await sb.storage.from(BUCKET).remove(paths); },
    submit: (title, note, emotes) => rpc('submit_lot', { p_title: title, p_note: note, p_emotes: emotes }),
    vote: (id, on) => rpc('vote', { p_lot: id, p_on: on }),
    adminState: () => rpc('admin_state'),
    adminSet: (id, status) => rpc('admin_set', { p_lot: id, p_status: status }),
    adminDelete: (id) => rpc('admin_delete', { p_lot: id }),
    adminConfig: (patch) => rpc('admin_config', { p: patch }),
  };
}

function demoApi() {
  const face = (hue, mood) => {
    const cv = h('canvas', { width: 96, height: 96 }), c = cv.getContext('2d');
    c.fillStyle = `hsl(${hue} 80% 60%)`; c.beginPath(); c.arc(48, 48, 44, 0, 7); c.fill();
    c.fillStyle = '#222'; c.beginPath(); c.arc(32, 40, 6, 0, 7); c.arc(64, 40, 6, 0, 7); c.fill();
    c.strokeStyle = '#222'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath();
    if (mood === 0) c.arc(48, 54, 20, 0.2, Math.PI - 0.2);
    else if (mood === 1) c.arc(48, 78, 18, Math.PI + 0.4, -0.4);
    else { c.moveTo(34, 66); c.lineTo(62, 66); }
    c.stroke();
    return cv.toDataURL('image/png');
  };
  const names = ['happy', 'sad', 'meh', 'gg', 'shiny', 'catch'];
  const mk = (id, author, title, hue, status) => ({
    id, title, note: '', status, author, avatar: null, user: author, created_at: new Date().toISOString(), voters: new Set(),
    emotes: names.map((n, i) => ({ name: `${n}_${id}`, path: face(hue + i * 14, i % 3) })),
  });
  const db = {
    config: { submissions_open: true, votes_open: true, show_counts: false, max_votes: 3, max_emotes: 30 },
    lots: [mk('a', 'Ondine', 'Aqua pack', 200, 'approved'), mk('b', 'Pierre', 'Rock solid', 25, 'approved'), mk('c', 'Flora', 'Garden set', 110, 'pending')],
  };
  let me = null, onChange = () => {};
  const view = (l, withVotes) => ({
    ...l, voters: undefined, mine: !!me && l.user === 'me', voted: !!me && l.voters.has('me'),
    votes: withVotes ? l.voters.size : null,
  });
  return {
    init(cb) { onChange = cb; cb(); },
    login() { me = { member: true, admin: true, name: 'Demo', avatar: null }; onChange(); },
    logout() { me = null; onChange(); },
    async state() {
      const mine = me && db.lots.find((l) => l.user === 'me');
      return {
        config: { ...db.config },
        me: me && { ...me, votes_used: db.lots.filter((l) => l.voters.has('me')).length },
        mine: mine ? view(mine, false) : null,
        lots: db.lots.filter((l) => l.status === 'approved').map((l) => view(l, db.config.show_counts)),
      };
    },
    url: (path) => path,
    async upload(blob) { return URL.createObjectURL(blob); },
    async remove() {},
    async submit(title, note, emotes) {
      db.lots = db.lots.filter((l) => l.user !== 'me');
      db.lots.unshift({ id: 'me' + Date.now(), title, note, status: 'pending', author: 'Demo', avatar: null, user: 'me', created_at: new Date().toISOString(), voters: new Set(), emotes });
    },
    async vote(id, on) {
      const l = db.lots.find((x) => x.id === id);
      if (!on) return void l.voters.delete('me');
      if (l.user === 'me') throw new Error('own');
      if (db.lots.filter((x) => x.voters.has('me')).length >= db.config.max_votes) throw new Error('maxvotes');
      l.voters.add('me');
    },
    async adminState() { return { config: { ...db.config }, members: 1, lots: db.lots.map((l) => view(l, true)) }; },
    async adminSet(id, status) { db.lots.find((l) => l.id === id).status = status; },
    async adminDelete(id) { db.lots = db.lots.filter((l) => l.id !== id); return []; },
    async adminConfig(patch) { Object.assign(db.config, patch); },
  };
}

const api = DEMO ? demoApi() : supabaseApi();

// ───────────────────────── State and screens ─────────────────────────

let S = null;                 // what the server says
let A = null;                 // moderation data (admins)
let tab = 'gallery';
let draft = null;             // { title, note, items: [{ name, blob, ext, url }] } while composing a lot
let notes = [];               // problems met while reading the dropped files
let flash = '';               // one message shown at the top
let busy = '';                // text of the action in progress
const lightLots = new Set();  // lots previewed on a light background

async function refresh() {
  try {
    S = await api.state();
    if (tab === 'admin' && !(S.me && S.me.admin)) tab = 'gallery';
    if (tab === 'admin') A = await api.adminState();
  } catch (e) { flash = errText(e); }
  render();
}

async function act(fn) {
  flash = '';
  try { await fn(); } catch (e) { flash = errText(e); }
  await refresh();
}

function emoteGrid(lot, opts = {}) {
  const light = lightLots.has(lot.id);
  return [
    h('div', { class: 'grid' + (light ? ' light' : '') }, lot.emotes.map((e) =>
      h('div', { class: 'tile', title: `:${e.name}:` },
        h('img', { src: api.url(e.path), alt: e.name, loading: 'lazy' }),
        h('div', { class: 'nm' }, `:${e.name}:`)))),
    !opts.noChat && h('div', { class: 'chat' + (light ? ' light' : '') },
      h('span', { class: 'small' }, t('in_chat')),
      lot.emotes.slice(0, 12).map((e) => h('img', { src: api.url(e.path), alt: '' }))),
  ];
}

function lotCard(lot, actions) {
  return h('div', { class: 'card' },
    h('div', { class: 'head' },
      lot.avatar && h('img', { class: 'av', src: lot.avatar, alt: '', referrerPolicy: 'no-referrer' }),
      h('div', { class: 'grow' },
        h('h2', null, lot.title),
        h('div', { class: 'dim small' }, t('by', { name: lot.author || '?' }), lot.note ? ' · ' + lot.note : '')),
      h('button', { class: 'mini ghost', onclick: () => { lightLots.has(lot.id) ? lightLots.delete(lot.id) : lightLots.add(lot.id); render(); } },
        lightLots.has(lot.id) ? '🌙 ' + t('dark') : '☀️ ' + t('light')),
      actions),
    emoteGrid(lot));
}

function galleryView() {
  const cfg = S.config, me = S.me;
  const lots = [...S.lots];
  if (cfg.show_counts) lots.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  if (!lots.length) return h('div', { class: 'empty' }, t('no_lots'));
  const canVote = cfg.votes_open && me && me.member;
  return [
    canVote && h('p', { class: 'dim' }, t('votes_left', { a: me.votes_used, b: cfg.max_votes })),
    lots.map((lot) => lotCard(lot, [
      lot.votes != null && h('span', { class: 'badge' }, t('votes', { n: lot.votes })),
      lot.mine ? h('span', { class: 'badge approved' }, t('your_lot'))
        : cfg.votes_open && h('button', {
          class: lot.voted ? 'done' : 'primary',
          disabled: !canVote || (!lot.voted && me.votes_used >= cfg.max_votes),
          title: !me ? t('need_login') : '',
          onclick: () => act(() => api.vote(lot.id, !lot.voted)),
        }, lot.voted ? t('voted') : t('vote')),
    ])),
  ];
}

function gate() {
  if (!S.me) return h('div', { class: 'card' }, h('p', null, t('need_login')), h('button', { class: 'discord', onclick: api.login }, t('login')));
  if (!S.me.member) return h('div', { class: 'card' }, h('p', null, t('not_member')),
    h('div', { class: 'row' },
      C.invite && h('a', { href: C.invite, target: '_blank', rel: 'noopener noreferrer' }, t('join')),
      h('button', { class: 'discord', onclick: api.login }, t('relog'))));
  return null;
}

async function addFiles(list) {
  const max = S.config.max_emotes;
  const one = async (f) => {
    try {
      if (draft.items.length >= max) throw new Error('toomany');
      draft.items.push(await clean(f));
    } catch (e) { notes.push(`${f.name} — ${errText(e)}`); }
  };
  busy = '…'; render();
  for (const f of list) {
    if (/\.zip$/i.test(f.name)) {
      try {
        const z = await unzip(f);
        if (z.skipped) notes.push(`${f.name} — ${t('skipped', { n: z.skipped })}`);
        for (const x of z.failed) notes.push(`${x.name} — ${errText(x.err)}`);
        for (const g of z.files) await one(g);
      } catch (e) { notes.push(`${f.name} — ${errText(e)}`); }
    } else await one(f);
  }
  // no two emotes with the same name
  const seen = new Set();
  for (const it of draft.items) {
    let n = it.name, i = 2;
    while (seen.has(n)) n = it.name.slice(0, 29) + '_' + i++;
    it.name = n; seen.add(n);
  }
  busy = ''; render();
}

async function sendLot() {
  const title = draft.title.trim();
  if (!title || title.length > 60) { flash = t('e_title'); return render(); }
  if (!draft.items.length) { flash = t('e_count'); return render(); }
  const names = draft.items.map((i) => i.name);
  if (names.some((n) => !NAME_RE.test(n)) || new Set(names).size !== names.length) { flash = t('e_name'); return render(); }
  const old = S.mine ? S.mine.emotes.map((e) => e.path) : [];
  const sent = [];
  try {
    for (const [i, it] of draft.items.entries()) {
      busy = t('sending', { a: i + 1, b: draft.items.length }); render();
      sent.push({ name: it.name, path: await api.upload(it.blob, it.ext) });
    }
    await api.submit(title, draft.note, sent);
    await api.remove(old).catch(() => {});
    draft.items.forEach((i) => URL.revokeObjectURL(i.url));
    draft = null; notes = []; flash = t('sent');
  } catch (e) {
    flash = errText(e);
    await api.remove(sent.map((s) => s.path)).catch(() => {});
  }
  busy = '';
  await refresh();
}

function composer() {
  const max = S.config.max_emotes;
  const picker = h('input', { type: 'file', multiple: true, hidden: true, accept: '.png,.gif,.webp,.zip',
    onchange: (ev) => { addFiles([...ev.target.files]); } });
  const drop = h('div', { class: 'drop',
    onclick: () => picker.click(),
    ondragover: (ev) => { ev.preventDefault(); drop.classList.add('over'); },
    ondragleave: () => drop.classList.remove('over'),
    ondrop: (ev) => { ev.preventDefault(); drop.classList.remove('over'); addFiles([...ev.dataTransfer.files]); },
  }, h('div', null, '📦 ' + t('drop')), h('div', { class: 'dim small' }, t('drop_sub', { n: max })));
  return h('div', { class: 'card' },
    S.mine && h('p', { class: 'dim small' }, t('replace_warn')),
    h('label', { class: 'field' }, h('span', null, t('f_title')),
      h('input', { value: draft.title, maxLength: 60, oninput: (ev) => { draft.title = ev.target.value; } })),
    h('label', { class: 'field' }, h('span', null, t('f_note')),
      h('textarea', { value: draft.note, maxLength: 300, oninput: (ev) => { draft.note = ev.target.value; } })),
    picker, drop,
    h('ul', { class: 'rules' }, h('li', null, t('rules_1')), h('li', null, t('rules_2')), h('li', null, t('rules_3'))),
    notes.length > 0 && h('ul', { class: 'notes' }, notes.map((n) => h('li', null, n))),
    draft.items.length > 0 && h('div', { class: 'grid' }, draft.items.map((it, i) =>
      h('div', { class: 'tile' },
        h('img', { src: it.url, alt: '' }),
        h('input', { value: it.name, maxLength: 32, class: NAME_RE.test(it.name) ? '' : 'bad',
          oninput: (ev) => { it.name = ev.target.value.toLowerCase(); ev.target.classList.toggle('bad', !NAME_RE.test(it.name)); } }),
        h('button', { class: 'x mini', title: t('del'), onclick: () => { URL.revokeObjectURL(it.url); draft.items.splice(i, 1); render(); } }, '×')))),
    draft.items.length > 0 && h('div', { class: 'chat' }, h('span', { class: 'small' }, t('in_chat')),
      draft.items.slice(0, 12).map((it) => h('img', { src: it.url, alt: '' }))),
    h('p', null),
    h('div', { class: 'row' },
      h('button', { class: 'primary', disabled: !!busy || !draft.items.length, onclick: sendLot },
        busy || `${t('send')} (${draft.items.length} / ${max})`),
      h('button', { class: 'ghost', disabled: !!busy, onclick: () => { draft.items.forEach((i) => URL.revokeObjectURL(i.url)); draft = S.mine ? null : { title: '', note: '', items: [] }; notes = []; render(); } }, t('clear'))));
}

function mineView() {
  const g = gate();
  if (g) return g;
  const open = S.config.submissions_open;
  if (!S.mine && !draft && open) draft = { title: '', note: '', items: [] };
  return [
    S.mine && lotCard(S.mine, [
      h('span', { class: 'badge ' + S.mine.status }, t('st_' + S.mine.status)),
      open && !draft && h('button', { onclick: () => { draft = { title: S.mine.title, note: S.mine.note, items: [] }; render(); } }, t('replace')),
    ]),
    !open && h('div', { class: 'banner' }, t('sub_closed')),
    open && draft && composer(),
  ];
}

// Copies for the organiser: PNG re-drawn once more here, GIF checked by its first bytes.
async function downloadLot(lot) {
  for (const e of lot.emotes) {
    try {
      const src = await (await fetch(api.url(e.path))).blob();
      const item = await clean(new File([src], e.name));
      const a = h('a', { href: item.url, download: `${e.name}.${item.ext}` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(item.url), 10000);
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) { notes.push(`${e.name} — ${errText(err)}`); }
  }
}

function adminView() {
  if (!A) return h('div', { class: 'empty' }, '…');
  const toggle = (key, label) => h('label', null,
    h('input', { type: 'checkbox', checked: !!A.config[key], onchange: (ev) => act(() => api.adminConfig({ [key]: ev.target.checked })) }), label);
  const order = { pending: 0, approved: 1, rejected: 2 };
  const lots = [...A.lots].sort((a, b) => order[a.status] - order[b.status] || (b.votes || 0) - (a.votes || 0));
  return [
    h('div', { class: 'card' },
      h('div', { class: 'row' }, toggle('submissions_open', t('a_subs')), toggle('votes_open', t('a_votes')), toggle('show_counts', t('a_counts')),
        h('label', null, t('a_max'), h('input', { type: 'number', min: 1, max: 20, value: A.config.max_votes,
          onchange: (ev) => act(() => api.adminConfig({ max_votes: Number(ev.target.value) || 3 })) }))),
      h('p', null), h('div', { class: 'dim small' }, t('a_members', { n: A.members, l: A.lots.length }))),
    lots.length ? lots.map((lot) => lotCard(lot, [
      h('span', { class: 'badge ' + lot.status }, t('st_' + lot.status)),
      h('span', { class: 'badge' }, t('votes', { n: lot.votes || 0 })),
      lot.status !== 'approved' && h('button', { class: 'primary mini', onclick: () => act(() => api.adminSet(lot.id, 'approved')) }, t('approve')),
      lot.status !== 'rejected' && h('button', { class: 'mini', onclick: () => act(() => api.adminSet(lot.id, 'rejected')) }, t('reject')),
      h('button', { class: 'mini', onclick: () => downloadLot(lot) }, '⬇ ' + t('download')),
      h('button', { class: 'mini danger', onclick: () => { if (confirm(t('del_confirm'))) act(async () => api.remove(await api.adminDelete(lot.id) || [])); } }, t('del')),
    ])) : h('div', { class: 'empty' }, t('no_lots')),
  ];
}

function render() {
  document.documentElement.lang = lang;
  const app = document.getElementById('app');
  if (!S) { app.replaceChildren(h('div', { class: 'empty' }, flash || '…')); return; }
  const cfg = S.config, me = S.me;
  const phase = cfg.submissions_open && cfg.votes_open ? 'ph_both' : cfg.submissions_open ? 'ph_submit' : cfg.votes_open ? 'ph_vote' : 'ph_closed';
  const tabBtn = (id) => h('button', { class: tab === id ? 'on' : '', onclick: () => { tab = id; flash = ''; refresh(); } }, t('tab_' + id));
  const page = h('div', null,
    h('header', null,
      h('h1', { class: 'grow' }, 'Poke\'Catch · ', h('span', null, t('title'))),
      h('button', { class: 'mini ghost', onclick: () => { lang = lang === 'fr' ? 'en' : 'fr'; try { localStorage.setItem('lang', lang); } catch { /* ignore */ } render(); } }, lang === 'fr' ? 'EN' : 'FR'),
      me ? h('div', { class: 'user' },
          me.avatar && h('img', { src: me.avatar, alt: '', referrerPolicy: 'no-referrer' }),
          h('span', null, me.name || ''),
          h('button', { class: 'mini ghost', onclick: api.logout }, t('logout')))
        : h('button', { class: 'discord', onclick: api.login }, t('login'))),
    DEMO && h('div', { class: 'banner demo' }, t('demo')),
    h('div', { class: 'banner phase' }, t(phase, { n: cfg.max_votes })),
    flash && h('div', { class: 'banner' }, flash),
    h('div', { class: 'tabs' }, tabBtn('gallery'), tabBtn('mine'), me && me.admin && tabBtn('admin')),
    h('main', null, tab === 'gallery' ? galleryView() : tab === 'mine' ? mineView() : adminView()));
  app.replaceChildren(...page.childNodes);   // through h(), so a false or empty item is dropped
}

// A file dropped beside the drop zone must not make the browser open it.
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => e.preventDefault());

render();
api.init(refresh);
})();
