(function () {
  'use strict';

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] == null) return;
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function fmtDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? m[1] + '년 ' + Number(m[2]) + '월 ' + Number(m[3]) + '일' : '';
  }

  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  /* ---------- 복사 버튼 ---------- */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var label = btn.getAttribute('data-label') || btn.textContent;
    btn.addEventListener('click', function () {
      var done = function (msg) {
        btn.textContent = msg;
        setTimeout(function () { btn.textContent = label; }, 2500);
      };
      try {
        navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(
          function () { done('복사했어요'); },
          function () { done('길게 눌러 복사해 주세요'); }
        );
      } catch (e) { done('길게 눌러 복사해 주세요'); }
    });
  });

  /* ---------- 펼치기 버튼 ---------- */
  document.querySelectorAll('[data-toggle]').forEach(function (btn) {
    var target = document.getElementById(btn.getAttribute('data-toggle'));
    if (!target) return;
    btn.addEventListener('click', function () {
      var open = target.hidden;
      target.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? btn.getAttribute('data-open') : btn.getAttribute('data-closed');
    });
  });

  /* ---------- 유튜브 ---------- */
  function embed(id, title, autoplay) {
    return el('iframe', {
      src: 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + (autoplay ? '?autoplay=1' : ''),
      title: title,
      allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share',
      allowfullscreen: ''
    });
  }
  function thumb(id) { return 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg'; }
  function playDot(size) {
    var d = el('span', { class: 'playdot', 'aria-hidden': 'true', style: 'width:' + size + 'px;height:' + size + 'px' });
    d.innerHTML = '<svg width="' + size / 2 + '" height="' + size / 2 + '" viewBox="0 0 24 24"><path d="M8 5 L20 12 L8 19 Z" fill="#22428F"/></svg>';
    return d;
  }

  function renderRecent(box, videos) {
    var list = videos.slice(0, 5);
    box.textContent = '';
    if (!list.length) {
      box.appendChild(el('p', { class: 'loading', text: '아직 올라온 설교 영상이 없습니다.' }));
      return;
    }
    var player = el('div', { class: 'player' });
    var pill = el('span', { class: 'pill' });
    var title = el('h3', { class: 'feature-title' });
    var desc = el('p', { class: 'feature-desc' });
    box.appendChild(el('div', { class: 'feature' }, [player, el('div', { class: 'feature-text' }, [pill, title, desc])]));
    var items = el('div', { class: 'vlist' });
    box.appendChild(items);

    function show(v, autoplay) {
      player.textContent = '';
      player.appendChild(embed(v.id, v.title, autoplay));
      pill.textContent = (v === list[0] ? '가장 최근 설교 · ' : '') + fmtDate(v.published);
      title.textContent = v.title;
      desc.textContent = v.desc || '';
      desc.hidden = !v.desc;
      items.querySelectorAll('.vitem').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-id') === v.id ? 'true' : 'false');
      });
    }
    list.forEach(function (v) {
      var b = el('button', { class: 'vitem lift', type: 'button', 'data-id': v.id }, [
        el('span', { class: 'vthumb' }, [el('img', { src: thumb(v.id), alt: '', loading: 'lazy' }), playDot(40)]),
        el('span', {}, [el('span', { class: 'vdate', text: fmtDate(v.published) }), el('span', { class: 'vtitle', text: v.title })])
      ]);
      b.addEventListener('click', function () {
        show(v, true);
        player.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      items.appendChild(b);
    });
    show(list[0], false);
  }

  function renderShorts(box, shorts) {
    box.textContent = '';
    shorts.slice(0, 8).forEach(function (v) {
      var frame = el('span', { class: 'short-frame' }, [el('img', { src: thumb(v.id), alt: '', loading: 'lazy' }), playDot(48)]);
      var b = el('button', { class: 'short lift', type: 'button' }, [frame, el('span', { class: 'short-title', text: v.title })]);
      b.addEventListener('click', function () {
        frame.textContent = '';
        frame.appendChild(embed(v.id, v.title, true));
      });
      box.appendChild(b);
    });
  }

  var recent = document.getElementById('sermon-recent');
  var shortsBox = document.getElementById('sermon-shorts');
  if (recent || shortsBox) {
    getJSON('data/videos.json').then(function (d) {
      if (recent) renderRecent(recent, d.videos || []);
      if (shortsBox) renderShorts(shortsBox, d.shorts || []);
    }).catch(function () {
      if (recent) {
        recent.textContent = '';
        recent.appendChild(el('p', { class: 'loading', text: '영상을 불러오지 못했습니다. 위의 “유튜브에서 전체 보기”를 눌러 주세요.' }));
      }
    });
  }

  /* ---------- 청소년 설교문 ---------- */
  var youthBox = document.getElementById('youth-list');
  if (youthBox) {
    getJSON('data/youth.json').then(function (list) {
      youthBox.textContent = '';
      list.forEach(function (y) {
        var more = el('span', { class: 'ymore', text: '읽기 →' });
        var head = el('button', { class: 'yhead', type: 'button', 'aria-expanded': 'false' }, [
          el('span', { class: 'ypass', text: y.passage }),
          el('span', { class: 'ytitle', text: y.title }),
          el('span', { class: 'ydate', text: fmtDate(y.date) }),
          more
        ]);
        var inner = el('div', { class: 'ybody-in' }, [
          el('div', { class: 'ymeta', text: ['청소년 설교문', y.series, y.author].filter(Boolean).join(' · ') }),
          el('div', { class: 'ybig', text: y.title }),
          el('div', { class: 'ysub', text: '본문: ' + y.passage + ' · ' + fmtDate(y.date) })
        ]);
        (y.blocks || []).forEach(function (b) {
          inner.appendChild(b.k === 'h' ? el('h3', { text: b.x }) : el('p', { class: b.k === 'q' ? 'q' : null, text: b.x }));
        });
        var close = el('button', { class: 'yclose', type: 'button', text: '설교문 접기' });
        inner.appendChild(el('div', { style: 'margin-top:28px;text-align:center' }, [close]));
        var body = el('div', { class: 'ybody' }, [inner]);
        body.hidden = true;
        function toggle() {
          var open = body.hidden;
          body.hidden = !open;
          head.setAttribute('aria-expanded', open ? 'true' : 'false');
          more.textContent = open ? '접기 ↑' : '읽기 →';
          if (!open) head.scrollIntoView({ block: 'nearest' });
        }
        head.addEventListener('click', toggle);
        close.addEventListener('click', toggle);
        youthBox.appendChild(el('div', { class: 'yrow' }, [head, body]));
      });
      youthBox.appendChild(el('div', { class: 'yend' }));
    }).catch(function () {
      youthBox.textContent = '';
      youthBox.appendChild(el('p', { class: 'loading', text: '설교문을 불러오지 못했습니다. 잠시 뒤에 다시 열어 주세요.' }));
    });
  }
})();
