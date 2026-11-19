// GTA VI trophy guide + tracker: loads app/data/trophies.json, renders the
// checklist, the roadmap and the tracker. Everything runs offline; the only
// network-free fetch is the local data file. Progress is kept in
// localStorage (wrapped in try/catch) and can be exported/imported as JSON.

const DATA_URL = 'data/trophies.json';
const STORE_KEY = 'gta6-trophy-guide-progress-v1';

const state = {
  trophies: [],
  earned: new Set(),
  spoiler: true,
  filter: 'all',
  query: '',
  revealed: new Set(),
};

const els = {
  list: document.getElementById('trophyList'),
  heading: document.getElementById('listHeading'),
  empty: document.getElementById('emptyMsg'),
  count: document.getElementById('progressCount'),
  pct: document.getElementById('progressPct'),
  fill: document.getElementById('progressFill'),
  search: document.getElementById('search'),
  spoiler: document.getElementById('spoilerToggle'),
  roadmap: document.getElementById('roadmap'),
  importMsg: document.getElementById('importMsg'),
};

// ---------- storage (try/catch: private mode and quota errors must not break the app) ----------
function loadStored() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.earned)) state.earned = new Set(data.earned.filter(Number.isInteger));
    if (typeof data.spoiler === 'boolean') state.spoiler = data.spoiler;
  } catch (err) {
    // Corrupt or unavailable storage: start fresh, the app still works.
    state.earned = new Set();
  }
}

function saveStored() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      earned: [...state.earned].sort((a, b) => a - b),
      spoiler: state.spoiler,
    }));
  } catch (err) {
    // Storage full or unavailable: progress is kept in memory for this session.
  }
}

// ---------- helpers ----------
function gradeLabel(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function isMasked(t) {
  // Spoiler mode hides hidden trophies (which include every story trophy)
  // until they are earned or the reader reveals one.
  return state.spoiler && t.hidden && !state.earned.has(t.id) && !state.revealed.has(t.id);
}

function trophyMatches(t) {
  if (state.filter === 'story' && t.kind !== 'story') return false;
  if (state.filter === 'missable' && !t.missable) return false;
  if (state.filter === 'collectibles' && t.kind !== 'collectibles') return false;
  if (state.filter === 'activities' && t.kind !== 'activities') return false;
  if (state.filter === 'online') return false; // No online trophies exist.
  if (state.filter === 'earned' && !state.earned.has(t.id)) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const hay = (t.name + ' ' + t.description + ' ' + t.guide).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

// ---------- rendering ----------
function renderCounts() {
  const total = state.trophies.length;
  const earned = state.earned.size;
  els.count.textContent = earned + ' / ' + total;
  els.pct.textContent = total ? Math.round((earned / total) * 100) + '%' : '0%';
  els.fill.style.width = total ? (earned / total) * 100 + '%' : '0%';
  const counts = {
    all: total,
    story: state.trophies.filter((t) => t.kind === 'story').length,
    missable: state.trophies.filter((t) => t.missable).length,
    collectibles: state.trophies.filter((t) => t.kind === 'collectibles').length,
    activities: state.trophies.filter((t) => t.kind === 'activities').length,
    online: 0,
    earned,
  };
  document.querySelectorAll('[data-count]').forEach((el) => {
    el.textContent = '(' + counts[el.dataset.count] + ')';
  });
}

function trophyCard(t) {
  const earned = state.earned.has(t.id);
  const masked = isMasked(t);
  const card = document.createElement('article');
  card.className = 'trophy-card' + (earned ? ' earned' : '') + (masked ? ' masked' : '');
  card.dataset.id = String(t.id);
  card.id = 'trophy-' + t.id;

  const head = document.createElement('div');
  head.className = 'card-head';

  const check = document.createElement('label');
  check.className = 'check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned;
  box.setAttribute('aria-label', 'Mark ' + (masked ? 'hidden trophy' : t.name) + ' as earned');
  box.addEventListener('change', () => {
    if (box.checked) state.earned.add(t.id); else state.earned.delete(t.id);
    saveStored();
    render();
  });
  check.appendChild(box);
  check.appendChild(document.createElement('span'));
  head.appendChild(check);

  const title = document.createElement('div');
  title.className = 'card-title';
  const name = document.createElement('h3');
  name.textContent = masked ? 'Hidden trophy' : t.name;
  title.appendChild(name);
  const meta = document.createElement('p');
  meta.className = 'card-meta';
  const grade = document.createElement('span');
  grade.className = 'grade grade-' + t.grade;
  grade.textContent = gradeLabel(t.grade);
  meta.appendChild(grade);
  if (t.hidden) {
    const hid = document.createElement('span');
    hid.className = 'tag tag-hidden';
    hid.textContent = 'Hidden';
    meta.appendChild(hid);
  }
  if (t.missable) {
    const mis = document.createElement('span');
    mis.className = 'tag tag-missable';
    mis.textContent = 'Possibly missable';
    meta.appendChild(mis);
  }
  title.appendChild(meta);
  head.appendChild(title);
  card.appendChild(head);

  if (masked) {
    const reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.className = 'reveal-btn';
    reveal.textContent = 'Reveal this trophy (spoiler)';
    reveal.addEventListener('click', () => {
      state.revealed.add(t.id);
      render();
    });
    card.appendChild(reveal);
    return card;
  }

  const desc = document.createElement('p');
  desc.className = 'official';
  desc.textContent = t.description;
  card.appendChild(desc);

  const guide = document.createElement('p');
  guide.className = 'guide';
  guide.textContent = t.guide;
  card.appendChild(guide);

  if (t.missable && t.missable_note) {
    const warn = document.createElement('p');
    warn.className = 'missable-note';
    warn.textContent = t.missable_note;
    card.appendChild(warn);
  }

  const src = document.createElement('p');
  src.className = 'source';
  const conf = document.createElement('span');
  conf.className = 'confidence';
  conf.textContent = t.confidence;
  src.appendChild(conf);
  src.appendChild(document.createTextNode(' · Source: '));
  const link = document.createElement('a');
  link.href = t.source.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = t.source.name;
  src.appendChild(link);
  card.appendChild(src);

  return card;
}

function renderList() {
  els.list.innerHTML = '';
  const shown = state.trophies.filter(trophyMatches);
  els.empty.hidden = shown.length > 0;
  const titles = {
    all: 'All trophies',
    story: 'Story trophies',
    missable: 'Possibly missable trophies',
    collectibles: 'Collectibles',
    activities: 'Activities',
    online: 'Online trophies',
    earned: 'Earned trophies',
  };
  els.heading.textContent = titles[state.filter] || 'All trophies';
  shown.forEach((t) => els.list.appendChild(trophyCard(t)));
}

const ROADMAP = [
  {
    stage: 'story',
    title: 'Phase 1 — Finish the story (60–80 hours)',
    body: 'Play the story through its 5 chapters. Chapter and mission trophies pop as you play and cannot be missed. Do the optional missions as they appear (you need any 100 for the 100% checklist later) and scan vehicles and study animals as you go. Keep a manual save at the start and end of each chapter — there is no mission replay.',
    warning: 'Watch out in Chapter 1: Positive Mental Attitude has one meditation at Jason\u2019s house that can only be done during Chapter 1. After the mission Down to Earth, talk to Lucia in the kitchen in the morning, follow her to the balcony and choose Accept. It is unclear whether that meditation is required for the trophy, so do it to be safe.',
  },
  {
    stage: 'checklist',
    title: 'Phase 2 — 100% Completion checklist & 70 of 80 challenges (~100 hours)',
    body: 'After the story, the 100% Completion checklist unlocks under Progress > Stats > 100% Completion. It is forgiving — closer to 60% true completion — and nothing toward it is missable. Work through it: 200 of 277 vehicles scanned, 100 of 255 animals studied, 70 of 80 challenges, 300 stunts, the robberies, the collectibles and the money goals. Most of it comes from doing the other trophies.',
    warning: null,
  },
  {
    stage: 'cleanup',
    title: 'Phase 3 — Strangers & Freaks and miscellaneous cleanup (~10 hours)',
    body: 'Finish the stranger mission strands (Andy, Kenton, Billy, Randy, Tyrone and Bret) and the 8 Strangers & Freaks strands that count. Then clean up whatever is left — the cryptic trophies, the 500 Criminal Profile actions and any activity trophies still open.',
    warning: null,
  },
  {
    stage: 'platinum',
    title: 'Platinum — Vice Got a Price!',
    body: 'Earn the other 54 trophies. No multiplayer and no DLC is required.',
    warning: null,
  },
];

function renderRoadmap() {
  els.roadmap.innerHTML = '';
  ROADMAP.forEach((phase) => {
    const members = state.trophies.filter((t) => t.stage === phase.stage);
    const earned = members.filter((t) => state.earned.has(t.id)).length;
    const box = document.createElement('div');
    box.className = 'phase';
    const h = document.createElement('h3');
    h.textContent = phase.title;
    box.appendChild(h);
    const p = document.createElement('p');
    p.textContent = phase.body;
    box.appendChild(p);
    if (phase.warning) {
      const w = document.createElement('p');
      w.className = 'phase-warning';
      w.textContent = phase.warning;
      box.appendChild(w);
    }
    const count = document.createElement('p');
    count.className = 'phase-count';
    count.textContent = earned + ' / ' + members.length + ' trophies in this phase';
    box.appendChild(count);
    const names = document.createElement('p');
    names.className = 'phase-trophies';
    names.textContent = members.map((t) => (isMasked(t) ? 'Hidden trophy' : t.name)).join(' · ');
    box.appendChild(names);
    els.roadmap.appendChild(box);
  });
}

function render() {
  renderCounts();
  renderRoadmap();
  renderList();
}

// ---------- export / import ----------
function downloadJson(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportProgress() {
  const payload = {
    app: 'gta6-trophy-guide',
    exported_at: new Date().toISOString(),
    earned: [...state.earned].sort((a, b) => a - b),
  };
  downloadJson('gta6-trophy-progress.json', JSON.stringify(payload, null, 2));
  els.importMsg.textContent = 'Progress exported.';
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data || !Array.isArray(data.earned)) {
        throw new Error('missing earned list');
      }
      const ids = new Set(state.trophies.map((t) => t.id));
      const valid = data.earned.filter((n) => Number.isInteger(n) && ids.has(n));
      if (valid.length === 0 && data.earned.length > 0) {
        throw new Error('no recognised trophy ids');
      }
      state.earned = new Set(valid);
      saveStored();
      render();
      els.importMsg.textContent = 'Imported ' + valid.length + ' earned trophies.';
    } catch (err) {
      els.importMsg.textContent = 'That file is not a valid progress export. Import cancelled — nothing was changed.';
    }
  };
  reader.onerror = () => {
    els.importMsg.textContent = 'Could not read that file. Import cancelled — nothing was changed.';
  };
  reader.readAsText(file);
}

// ---------- wire up ----------
document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    renderList();
  });
});

els.search.addEventListener('input', () => {
  state.query = els.search.value.trim();
  renderList();
});

els.spoiler.addEventListener('change', () => {
  state.spoiler = els.spoiler.checked;
  saveStored();
  render();
});

document.getElementById('exportBtn').addEventListener('click', exportProgress);
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) importProgress(file);
  e.target.value = '';
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (window.confirm('Clear all earned trophies? This cannot be undone.')) {
    state.earned = new Set();
    state.revealed = new Set();
    saveStored();
    render();
  }
});

// ---------- boot ----------
loadStored();
els.spoiler.checked = state.spoiler;
fetch(DATA_URL)
  .then((res) => {
    if (!res.ok) throw new Error('Could not load ' + DATA_URL);
    return res.json();
  })
  .then((data) => {
    state.trophies = Array.isArray(data) ? data : data.trophies;
    render();
    // Deep links: the trophy cards are rendered by script, so the browser
    // cannot scroll to a #trophy-<id> fragment on its own — do it here once
    // the list exists. A #roadmap link scrolls to the roadmap section.
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) target.scrollIntoView({ block: 'start' });
    }
  })
  .catch(() => {
    els.list.innerHTML = '';
    els.empty.hidden = false;
    els.empty.textContent = 'Could not load the trophy data. Open this guide from its own folder so the data file loads.';
  });
