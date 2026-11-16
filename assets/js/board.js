// 게시판: 후기·나눔(누구나), 주보·설교 안내·청소년 설교문(관리자).
// 글은 Firebase Firestore 에 저장한다. 누가 무엇을 쓸 수 있는지는 firestore.rules 가 막는다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, collection, query, orderBy, limit, startAfter, getDocs, getDoc, setDoc, addDoc, deleteDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// 브라우저에 공개되는 연결 정보다. 비밀 값이 아니다.
const firebaseConfig = {
  apiKey: 'AIzaSyD-rLlI-_v-YDBTIRjDgVzaumCxX0OrbUI',
  authDomain: 'moonlight-church.firebaseapp.com',
  projectId: 'moonlight-church',
  storageBucket: 'moonlight-church.firebasestorage.app',
  messagingSenderId: '145344731084',
  appId: '1:145344731084:web:053067cc3bc90307f16f69'
};
// 화면에 관리자 버튼을 보일지 정할 때만 쓴다. 실제 권한은 firestore.rules 의 목록이 정한다.
const ADMIN_EMAILS = ['hello.moosung@gmail.com', 'boxter011@gmail.com'];
const PAGE = 20;
const FACES = ['dali', 'mongi', 'byeoli', 'toto'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const { el, fmtDate, youthRow } = window.Moon;

let user = null;
const isAdmin = () => !!(user && user.emailVerified && ADMIN_EMAILS.includes(user.email));
const refreshers = [];

function toDate(ts) {
  const d = ts && ts.toDate ? ts.toDate() : new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function errText(e) {
  const c = (e && e.code) || '';
  if (c.includes('permission-denied')) return '권한이 없습니다. 관리자 계정으로 로그인했는지 확인해 주세요.';
  if (c.includes('unavailable') || c.includes('network')) return '인터넷 연결을 확인하고 다시 시도해 주세요.';
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return '로그인 창이 닫혔습니다.';
  if (c.includes('popup-blocked')) return '브라우저가 로그인 창을 막았습니다. 팝업을 허용해 주세요.';
  return '처리하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.';
}
// 한 번 누르면 "정말 삭제"로 바뀌고, 한 번 더 눌러야 지워진다
function deleteButton(run) {
  const b = el('button', { class: 'b-del', type: 'button', text: '삭제' });
  let timer;
  b.addEventListener('click', () => {
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = '정말 삭제';
      timer = setTimeout(() => { b.classList.remove('armed'); b.textContent = '삭제'; }, 4000);
      return;
    }
    clearTimeout(timer);
    b.disabled = true;
    run().catch((e) => { b.disabled = false; b.classList.remove('armed'); b.textContent = '삭제'; alert(errText(e)); });
  });
  return b;
}
// "## 소제목", "> 인용", 그 밖의 줄은 문단
function toBlocks(text) {
  return String(text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => {
    if (l.startsWith('## ')) return { k: 'h', x: l.slice(3).trim() };
    if (l.startsWith('> ')) return { k: 'q', x: l.slice(2).trim() };
    return { k: 'p', x: l };
  });
}
function field(form, name) { return form.elements[name].value.trim(); }

/* ---------- 후기·나눔 ---------- */
function setupPosts() {
  const list = document.getElementById('post-list');
  const form = document.getElementById('post-form');
  if (!list || !form) return;
  const status = document.getElementById('post-status');
  const moreBtn = document.getElementById('post-more');
  let last = null;
  let items = [];

  try { form.elements.name.value = localStorage.getItem('moon-name') || ''; } catch (e) { /* 저장소를 못 쓰는 브라우저 */ }

  function draw() {
    list.textContent = '';
    if (!items.length) {
      list.appendChild(el('p', { class: 'b-empty', text: '아직 올라온 글이 없습니다. 첫 글을 남겨 주세요.' }));
      return;
    }
    // 카카오톡 대화처럼: 글마다 말풍선 하나, 왼쪽과 오른쪽에 번갈아 놓는다
    items.forEach((p, i) => {
      const right = i % 2 === 1;
      const name = p.name || '이름 없음';
      const body = el('p', { class: 'k-body', text: p.body });
      const bubble = el('div', { class: 'k-bubble' }, [el('h3', { class: 'k-title', text: p.title }), body]);
      const more = el('button', { class: 'k-more', type: 'button', 'aria-expanded': 'false', text: '더보기' });
      more.hidden = true;
      more.addEventListener('click', () => {
        const open = body.classList.toggle('open');
        more.textContent = open ? '접기' : '더보기';
        more.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      bubble.appendChild(more);
      const side = el('div', { class: 'k-side' }, [el('span', { class: 'k-date', text: fmtDate(toDate(p.createdAt)) })]);
      if (isAdmin() || (user && p.uid === user.uid)) {
        side.appendChild(deleteButton(() => deleteDoc(doc(db, 'posts', p.id)).then(() => {
          items = items.filter((x) => x.id !== p.id);
          draw();
        })));
      }
      let seed = 0;
      for (const ch of name) seed += ch.codePointAt(0);
      const face = el('img', { class: 'k-face', src: 'assets/img/' + FACES[seed % FACES.length] + '-hello.jpg', alt: '' });
      list.appendChild(el('article', { class: 'k-msg' + (right ? ' right' : '') }, [
        face,
        el('div', { class: 'k-col' }, [el('div', { class: 'k-name', text: name }), el('div', { class: 'k-line' }, [bubble, side])])
      ]));
      // 네 줄을 넘는 글에만 "더보기"를 보인다
      if (body.scrollHeight > body.clientHeight + 2) more.hidden = false;
    });
  }
  async function load(reset) {
    if (reset) { last = null; items = []; }
    const parts = [collection(db, 'posts'), orderBy('createdAt', 'desc')];
    if (last) parts.push(startAfter(last));
    parts.push(limit(PAGE));
    try {
      const snap = await getDocs(query(...parts));
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      last = snap.docs[snap.docs.length - 1] || last;
      moreBtn.hidden = snap.size < PAGE;
      draw();
    } catch (e) {
      list.textContent = '';
      list.appendChild(el('p', { class: 'b-empty', text: '글을 불러오지 못했습니다. 잠시 뒤에 다시 열어 주세요.' }));
    }
  }
  moreBtn.addEventListener('click', () => load(false));
  refreshers.push(draw);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (form.elements.website.value) return; // 사람 눈에 안 보이는 칸. 자동 글쓰기 프로그램만 채운다
    const name = field(form, 'name');
    const title = field(form, 'title');
    const body = field(form, 'body');
    if (!name || !title || !body) { status.textContent = '이름, 제목, 내용을 모두 적어 주세요.'; return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    status.textContent = '올리는 중입니다…';
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await addDoc(collection(db, 'posts'), { name, title, body, uid: auth.currentUser.uid, createdAt: serverTimestamp() });
      try { localStorage.setItem('moon-name', name); } catch (e) { /* 무시 */ }
      form.elements.title.value = '';
      form.elements.body.value = '';
      status.textContent = '글을 올렸습니다. 고맙습니다.';
      await load(true);
    } catch (e) {
      status.textContent = errText(e);
    }
    btn.disabled = false;
  });
  load(true);
}

/* ---------- 주보 ---------- */
// 그림 저장소(Firebase Storage)는 유료 요금제가 필요해서, 주보 그림은 줄여서 Firestore 문서에 글자로 넣는다.
// 문서 하나가 1MB 까지라 쪽마다 문서를 따로 둔다: bulletinPages/{주보 id}_{쪽 번호}
const PAGE_LIMIT = 900000;
function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
async function shrinkImage(file) {
  if (file.size <= 600000) return readAsDataURL(file); // 작은 파일은 원본 그대로
  const bmp = await createImageBitmap(file);
  for (const [width, quality] of [[1600, 0.9], [1600, 0.8], [1400, 0.75], [1200, 0.7], [1000, 0.6]]) {
    const scale = Math.min(1, width / bmp.width);
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const g = c.getContext('2d');
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/webp', quality));
    const url = blob && await readAsDataURL(blob);
    if (url && url.length <= PAGE_LIMIT) return url;
  }
  throw Object.assign(new Error('too large'), { code: 'image-too-large' });
}
function setupBulletins() {
  const box = document.getElementById('bulletin-list');
  if (!box) return;
  const form = document.getElementById('bulletin-form');
  const status = document.getElementById('bulletin-status');
  const PER_PAGE = 4; // 한 번에 보이는 주보 수. 지난 주보는 쪽 번호로 넘긴다
  let items = [];
  let openId = null;
  let pageNo = 0;

  async function showPages(b, holder) {
    holder.textContent = '';
    holder.appendChild(el('p', { class: 'b-empty', text: '주보를 불러오는 중입니다…' }));
    if (b.pages) { // 저장소에 파일로 들어 있는 주보 (data/bulletins.json)
      holder.textContent = '';
      b.pages.forEach((src, n) => holder.appendChild(el('img', { class: 'bl-page', src, alt: fmtDate(b.date) + ' 주보 ' + (n + 1) + '쪽' })));
      return;
    }
    try {
      const snaps = await Promise.all(Array.from({ length: b.count }, (_, n) => getDoc(doc(db, 'bulletinPages', b.id + '_' + n))));
      holder.textContent = '';
      snaps.forEach((sn, n) => {
        if (sn.exists()) holder.appendChild(el('img', { class: 'bl-page', src: sn.data().data, alt: fmtDate(b.date) + ' 주보 ' + (n + 1) + '쪽' }));
      });
    } catch (e) {
      holder.textContent = '';
      holder.appendChild(el('p', { class: 'b-empty', text: '주보를 불러오지 못했습니다. 잠시 뒤에 다시 열어 주세요.' }));
    }
  }
  function draw() {
    box.textContent = '';
    if (!items.length) {
      box.appendChild(el('p', { class: 'b-empty', text: '아직 올라온 주보가 없습니다.' }));
      return;
    }
    const pages = Math.ceil(items.length / PER_PAGE);
    pageNo = Math.min(pageNo, pages - 1);
    items.slice(pageNo * PER_PAGE, (pageNo + 1) * PER_PAGE).forEach((b) => {
      const open = openId === b.id;
      const more = el('span', { class: 'ymore', text: open ? '접기 ↑' : '보기 →' });
      const head = el('button', { class: 'yhead', type: 'button', 'aria-expanded': open ? 'true' : 'false' }, [
        el('span', { class: 'ypass', text: fmtDate(b.date) }),
        el('span', { class: 'ytitle', text: b.title || '주일 예배 주보' }),
        more
      ]);
      const holder = el('div', { class: 'bl-pages' });
      holder.hidden = !open;
      head.addEventListener('click', () => { openId = open ? null : b.id; draw(); });
      const row = el('div', { class: 'yrow' }, [head, holder]);
      if (open) {
        showPages(b, holder).then(() => {
          if (isAdmin() && !b.pages) {
            holder.appendChild(el('div', { style: 'text-align:center;margin-top:12px' }, [deleteButton(async () => {
              await Promise.all(Array.from({ length: b.count }, (_, n) => deleteDoc(doc(db, 'bulletinPages', b.id + '_' + n))));
              await deleteDoc(doc(db, 'bulletins', b.id));
              items = items.filter((x) => x.id !== b.id);
              openId = null;
              draw();
            })]));
          }
        });
      }
      box.appendChild(row);
    });
    box.appendChild(el('div', { class: 'yend' }));
    if (pages > 1) {
      const go = (n) => () => { pageNo = n; openId = null; draw(); box.scrollIntoView({ block: 'nearest' }); };
      const nav = el('nav', { class: 'pager', 'aria-label': '지난 주보 쪽 번호' });
      const prev = el('button', { class: 'pg', type: 'button', text: '‹ 이전' });
      prev.disabled = pageNo === 0;
      prev.addEventListener('click', go(pageNo - 1));
      nav.appendChild(prev);
      for (let n = 0; n < pages; n++) {
        const b = el('button', { class: 'pg num', type: 'button', text: String(n + 1), 'aria-current': n === pageNo ? 'page' : null, 'aria-label': (n + 1) + '쪽' });
        b.addEventListener('click', go(n));
        nav.appendChild(b);
      }
      const next = el('button', { class: 'pg', type: 'button', text: '다음 ›' });
      next.disabled = pageNo === pages - 1;
      next.addEventListener('click', go(pageNo + 1));
      nav.appendChild(next);
      box.appendChild(nav);
    }
  }
  async function load() {
    // 주보는 두 곳에서 온다: 저장소 파일(data/bulletins.json)과 관리자가 화면에서 올린 것(Firestore)
    const [files, live] = await Promise.all([
      fetch('data/bulletins.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      getDocs(query(collection(db, 'bulletins'), orderBy('date', 'desc'), limit(200)))
        .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => [])
    ]);
    items = files.map((b) => ({ ...b, id: 'file-' + b.date })).concat(live)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    if (openId === null && items.length) openId = items[0].id; // 가장 최근 주보는 펼쳐 둔다
    draw();
  }
  refreshers.push(draw);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const files = Array.from(form.elements.files.files);
    const date = field(form, 'date');
    if (!date || !files.length) { status.textContent = '날짜를 고르고 주보 그림을 선택해 주세요.'; return; }
    if (files.length > 8) { status.textContent = '한 번에 8쪽까지 올릴 수 있습니다.'; return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const pages = [];
      for (let n = 0; n < files.length; n++) {
        status.textContent = (n + 1) + ' / ' + files.length + ' 쪽을 준비하는 중입니다…';
        pages.push(await shrinkImage(files[n]));
      }
      status.textContent = '올리는 중입니다…';
      const ref = await addDoc(collection(db, 'bulletins'), { date, title: field(form, 'title'), count: pages.length, createdAt: serverTimestamp() });
      await Promise.all(pages.map((data, n) => setDoc(doc(db, 'bulletinPages', ref.id + '_' + n), { bid: ref.id, n, data })));
      form.reset();
      form.elements.date.value = toDate();
      status.textContent = '주보를 올렸습니다.';
      openId = ref.id;
      pageNo = 0;
      await load();
    } catch (e) {
      status.textContent = e.code === 'image-too-large' ? '그림이 너무 큽니다. 더 작은 파일로 올려 주세요.' : errText(e);
    }
    btn.disabled = false;
  });
  form.elements.date.value = toDate();
  load();
}

/* ---------- 설교 안내 ---------- */
function noticeCard(n, onDelete) {
  const body = el('div', { class: 'n-body' }, [el('div', { class: 'n-body-in' },
    toBlocks(n.body).map((b) => (b.k === 'h' ? el('h3', { text: b.x }) : el('p', { class: b.k === 'q' ? 'q' : null, text: b.x }))))]);
  body.hidden = true;
  const btn = el('button', { class: 'n-toggle', type: 'button', 'aria-expanded': 'false', text: '안내 전체 읽기' });
  btn.addEventListener('click', () => {
    const open = body.hidden;
    body.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? '안내 접기' : '안내 전체 읽기';
  });
  const tools = [btn];
  if (onDelete) tools.push(deleteButton(onDelete));
  return el('div', { class: 'n-card' }, [
    el('div', { class: 'n-head' }, [
      el('div', { class: 'n-text' }, [
        el('div', { class: 'n-top' }, [el('span', { class: 'n-pill', text: '설교 안내' }), el('span', { class: 'n-date', text: fmtDate(n.date) + (n.author ? ' · ' + n.author : '') })]),
        el('div', { class: 'n-title', text: n.title }),
        n.summary ? el('p', { class: 'n-summary', text: n.summary }) : null
      ]),
      el('div', { class: 'n-tools' }, tools)
    ]),
    body
  ]);
}
function setupNotices() {
  const box = document.getElementById('notice-live');
  if (!box) return;
  const form = document.getElementById('notice-form');
  const status = document.getElementById('notice-status');
  let items = [];
  function draw() {
    box.textContent = '';
    items.forEach((n) => box.appendChild(noticeCard(n, isAdmin()
      ? () => deleteDoc(doc(db, 'notices', n.id)).then(() => { items = items.filter((x) => x.id !== n.id); draw(); })
      : null)));
  }
  async function load() {
    try {
      const snap = await getDocs(query(collection(db, 'notices'), orderBy('date', 'desc'), limit(10)));
      items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      draw();
    } catch (e) { /* 기존 안내 글은 페이지에 그대로 있으므로 조용히 넘어간다 */ }
  }
  refreshers.push(draw);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = { title: field(form, 'title'), summary: field(form, 'summary'), body: field(form, 'body'), date: field(form, 'date'), author: field(form, 'author'), createdAt: serverTimestamp() };
    if (!data.title || !data.body || !data.date) { status.textContent = '제목, 날짜, 내용을 적어 주세요.'; return; }
    status.textContent = '올리는 중입니다…';
    try {
      await addDoc(collection(db, 'notices'), data);
      form.reset();
      form.elements.date.value = toDate();
      status.textContent = '안내를 올렸습니다.';
      await load();
    } catch (e) { status.textContent = errText(e); }
  });
  form.elements.date.value = toDate();
  load();
}

/* ---------- 청소년 설교문 ---------- */
function setupYouth() {
  const box = document.getElementById('youth-live');
  if (!box) return;
  const form = document.getElementById('youth-form');
  const status = document.getElementById('youth-status');
  let items = [];
  function draw() {
    box.textContent = '';
    items.forEach((y) => {
      const tools = isAdmin()
        ? [deleteButton(() => deleteDoc(doc(db, 'youth', y.id)).then(() => { items = items.filter((x) => x.id !== y.id); draw(); }))]
        : [];
      box.appendChild(youthRow({ ...y, blocks: toBlocks(y.body) }, tools));
    });
  }
  async function load() {
    try {
      const snap = await getDocs(query(collection(db, 'youth'), orderBy('date', 'desc'), limit(50)));
      items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      draw();
    } catch (e) { /* 기존 설교문은 data/youth.json 에서 그대로 보인다 */ }
  }
  refreshers.push(draw);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = { title: field(form, 'title'), passage: field(form, 'passage'), date: field(form, 'date'), series: field(form, 'series'), author: field(form, 'author'), body: field(form, 'body'), createdAt: serverTimestamp() };
    if (!data.title || !data.passage || !data.date || !data.body) { status.textContent = '제목, 본문 성구, 날짜, 설교문을 적어 주세요.'; return; }
    status.textContent = '올리는 중입니다…';
    try {
      await addDoc(collection(db, 'youth'), data);
      const keep = { series: data.series, author: data.author };
      form.reset();
      form.elements.series.value = keep.series;
      form.elements.author.value = keep.author;
      form.elements.date.value = toDate();
      status.textContent = '설교문을 올렸습니다.';
      await load();
    } catch (e) { status.textContent = errText(e); }
  });
  form.elements.date.value = toDate();
  load();
}

/* ---------- 관리자 로그인 ---------- */
function setupAdminBar() {
  const bar = el('div', { class: 'admin-bar' });
  const msg = el('span', { class: 'admin-msg' });
  const btn = el('button', { class: 'admin-btn', type: 'button', text: '관리자' });
  bar.appendChild(msg);
  bar.appendChild(btn);
  document.body.appendChild(bar);
  btn.addEventListener('click', async () => {
    msg.textContent = '';
    try {
      if (isAdmin()) { await signOut(auth); return; }
      const res = await signInWithPopup(auth, new GoogleAuthProvider());
      if (!ADMIN_EMAILS.includes(res.user.email)) {
        await signOut(auth);
        msg.textContent = '관리자 계정이 아닙니다.';
      }
    } catch (e) { msg.textContent = errText(e); }
  });
  return () => {
    btn.textContent = isAdmin() ? '관리자 로그아웃' : '관리자';
    if (isAdmin()) msg.textContent = user.email + ' 로 로그인했습니다.';
    else if (msg.textContent.includes('로그인했습니다')) msg.textContent = '';
    document.querySelectorAll('[data-admin]').forEach((n) => { n.hidden = !isAdmin(); });
  };
}

setupBulletins();
setupPosts();
setupNotices();
setupYouth();
const refreshAdmin = setupAdminBar();
onAuthStateChanged(auth, (u) => {
  user = u;
  refreshAdmin();
  refreshers.forEach((f) => f());
});
