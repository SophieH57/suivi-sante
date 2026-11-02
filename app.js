'use strict';

// ---------- Données (stockées sur le téléphone) ----------
// Les éléments retirés d'une liste gardent off: true, pour que l'historique affiche toujours leur nom.
const KEY = 'sante-v1';
const EMPTY = {
  symptoms: [],   // { id, name, emoji, off? }
  meds: [],       // { id, name, emoji, dose, off? }
  activities: [
    { id: 'yoga', name: 'Yoga', emoji: '🧘' },
    { id: 'zumba', name: 'Zumba', emoji: '💃' },
    { id: 'course', name: 'Course à pied', emoji: '🏃' },
    { id: 'marche', name: 'Marche', emoji: '🚶' },
    { id: 'elliptique', name: 'Vélo elliptique', emoji: '🏋️' },
    { id: 'velo', name: "Vélo d'appartement", emoji: '🚴' },
  ],
  // 'AAAA-MM-JJ' → { symptoms: [{ id, typeId, time, context }], meds: [{ id, medId, time, dose, note }],
  //                  stools: [{ id, bristol, time, note }], checkin: {…} | null, color: null | 'green' | 'orange' | 'red' }
  days: {},
};
let db = load();

function load() {
  try { return { ...structuredClone(EMPTY), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return structuredClone(EMPTY); }
}
const isEmptyDay = d => !d.symptoms?.length && !d.meds?.length && !d.stools?.length && !d.checkin && !d.color;
function save() {
  for (const [k, d] of Object.entries(db.days)) if (isEmptyDay(d)) delete db.days[k];
  localStorage.setItem(KEY, JSON.stringify(db));
  window.onSave?.();
}
navigator.storage?.persist?.();

// ---------- Utilitaires ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toLocaleDateString('sv'); // AAAA-MM-JJ, heure locale
const nowTime = () => new Date().toTimeString().slice(0, 5);
const shift = (date, n) => { const d = new Date(date + 'T12:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv'); };
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.toLocaleDateString('sv').slice(0, 7); };
const longDate = date => new Date(date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const num = v => v === null || v === '' ? null : +v;
const peek = date => db.days[date] || {};   // lecture sans créer le jour
const dayOf = date => {                      // crée le jour si besoin (les jours vides sont retirés à l'enregistrement)
  const d = db.days[date] ||= {};
  d.symptoms ||= []; d.meds ||= []; d.stools ||= [];
  d.checkin ??= null; d.color ??= null;
  return d;
};
const active = list => db[list].filter(x => !x.off);
const item = (list, id) => db[list].find(x => x.id === id) || { name: '(supprimé)', emoji: '❔' };

const BRISTOL = [
  'Petites boules dures, séparées',
  'Saucisse grumeleuse',
  'Saucisse avec craquelures',
  'Saucisse lisse et molle',
  'Morceaux mous aux bords nets',
  'Morceaux pâteux, bords déchiquetés',
  'Liquide, sans morceaux',
];

// ---------- Couleur du jour ----------
const COLOR_NAMES = { green: 'Vert', orange: 'Orange', red: 'Rouge' };
const autoColor = d => { const n = d.symptoms?.length || 0; return n === 0 ? 'green' : n <= 2 ? 'orange' : 'red'; };
// Pas de couleur avant le premier jour noté ni dans le futur (sinon tout le passé serait « vert »)
function colorOf(date) {
  const d = peek(date);
  if (d.color) return d.color;
  const first = Object.keys(db.days).sort()[0];
  if (!first || date < first || date > today()) return '';
  return autoColor(d);
}

// ---------- Onglet Journée ----------
let cur = null; // jour affiché ; null = aujourd'hui (suit le changement de date)
const day = () => cur || today();
const setDay = date => { cur = date >= today() ? null : date; };

function checkinSummary(c) {
  const parts = [];
  if (c.sleepHours != null || c.sleepQuality) parts.push(`😴 ${c.sleepHours != null ? c.sleepHours + ' h' : ''}${c.sleepQuality ? ` (${c.sleepQuality}/5)` : ''}`);
  if (c.mood) parts.push(`🙂 ${c.mood}/5`);
  if (c.stress) parts.push(`😰 ${c.stress}/5`);
  if (c.period || c.cycleDay) parts.push(`🩸 ${c.period ? 'règles' : ''}${c.period && c.cycleDay ? ', ' : ''}${c.cycleDay ? 'J' + c.cycleDay : ''}`);
  if (c.activities?.length) parts.push(c.activities.map(id => { const a = item('activities', id); return `${a.emoji} ${a.name}`; }).join(', '));
  return `<div class="summary">${parts.map(esc).join(' · ') || '<span class="muted">Bilan vide</span>'}
    ${c.note ? `<small>${esc(c.note)}</small>` : ''}</div>`;
}

function timeline(d) {
  const rows = [
    ...(d.symptoms || []).map(e => { const s = item('symptoms', e.typeId); return { e, kind: 'symptoms', ico: s.emoji, label: s.name, text: e.context }; }),
    ...(d.meds || []).map(e => { const m = item('meds', e.medId); return { e, kind: 'meds', ico: m.emoji, label: m.name + (e.dose ? ' · ' + e.dose : ''), text: e.note }; }),
    ...(d.stools || []).map(e => ({ e, kind: 'stools', ico: '💩', label: `Selles · type ${e.bristol}`, text: e.note || BRISTOL[e.bristol - 1] })),
  ].sort((a, b) => a.e.time.localeCompare(b.e.time));
  if (!rows.length) return '<p class="muted">Rien de noté pour ce jour.</p>';
  return `<ul class="list tl">${rows.map(r => `
    <li class="${r.kind}" data-act="edit" data-kind="${r.kind}" data-id="${r.e.id}">
      <span class="time">${esc(r.e.time)}</span><span class="ico">${esc(r.ico)}</span>
      <span class="txt"><b>${esc(r.label)}</b>${r.text ? `<small>${esc(r.text)}</small>` : ''}</span>
    </li>`).join('')}</ul>`;
}

function renderDay() {
  const date = day(), d = peek(date), isToday = !cur, c = colorOf(date);
  const sy = active('symptoms'), md = active('meds');
  $('#v-day').innerHTML = `
    <div class="daynav">
      <button data-act="prev" aria-label="Jour précédent">‹</button>
      <div class="dtitle"><b>${isToday ? "Aujourd'hui" : esc(cap(longDate(date)))}</b>
        ${isToday ? `<small>${esc(longDate(date))}</small>` : `<button class="link" data-act="today">↩ aujourd'hui</button>`}</div>
      <button data-act="next" aria-label="Jour suivant" ${isToday ? 'disabled' : ''}>›</button>
      <button class="dot ${c}" data-act="color" aria-label="Couleur du jour">${d.color ? '✎' : ''}</button>
    </div>

    <h2>Symptômes</h2>
    ${sy.length ? `<div class="grid">${sy.map(s => `
      <button class="tap" data-act="addsym" data-id="${s.id}"><span>${esc(s.emoji)}</span>${esc(s.name)}</button>`).join('')}</div>`
    : `<p class="muted">Ta liste de symptômes est vide. <button class="link" data-view="settings">Ajouter dans Réglages</button></p>`}

    <h2>Médicaments et selles</h2>
    <div class="grid">${md.map(m => `
      <button class="tap med" data-act="addmed" data-id="${m.id}"><span>${esc(m.emoji)}</span>${esc(m.name)}${m.dose ? `<small>${esc(m.dose)}</small>` : ''}</button>`).join('')}
      <button class="tap stool" data-act="addstool"><span>💩</span>Selles</button>
    </div>

    <button class="big checkin ${d.checkin ? 'done' : ''}" data-act="checkin">🌙 Bilan du soir${d.checkin ? ' ✓' : ''}</button>
    ${d.checkin ? checkinSummary(d.checkin) : ''}

    <h2>Journal du jour</h2>
    ${timeline(d)}`;
}

// ---------- Fenêtres ----------
let dlgOk = null;
function openDlg(html, onOk) {
  $('#dform').innerHTML = html;
  dlgOk = onOk;
  $('#dlg').showModal();
}
// Seul « Enregistrer » est un bouton d'envoi : la touche Entrée ne peut pas déclencher « Supprimer »
const actions = del => `<div class="actions">
  ${del ? '<button type="button" class="danger" data-act="dlgdel">Supprimer</button>' : ''}
  <button type="button" data-act="dlgclose">Annuler</button>
  <button value="ok" class="primary">Enregistrer</button></div>`;

$('#dform').addEventListener('submit', e => {
  if (e.submitter?.value === 'ok') dlgOk?.(new FormData(e.target), 'ok');
});

let toastTimer;
function toast(msg, buttons = []) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>`;
  for (const [label, fn] of buttons) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { t.hidden = true; fn(); };
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
}

// ---------- Saisies ----------
const findEntry = (date, kind, id) => peek(date)[kind]?.find(x => x.id === id);

function addEntry(kind, entry) {
  const date = day(), e = { id: uid(), time: cur ? '12:00' : nowTime(), ...entry };
  dayOf(date)[kind].push(e);
  save(); render();
  if (cur) return openEdit(date, kind, e.id); // jour passé : on règle l'heure tout de suite
  const label = kind === 'symptoms' ? item('symptoms', e.typeId) : item('meds', e.medId);
  toast(`${label.emoji} ${label.name} · ${e.time}`, [
    ['✏️ Détails', () => openEdit(date, kind, e.id)],
    ['↶ Annuler', () => { removeEntry(date, kind, e.id); save(); render(); }],
  ]);
}

function removeEntry(date, kind, id) {
  const d = peek(date);
  if (d[kind]) d[kind] = d[kind].filter(x => x.id !== id);
}

function entryFields(kind, e) {
  if (kind === 'symptoms') {
    const s = item('symptoms', e.typeId);
    return `<h2>${esc(s.emoji)} ${esc(s.name)}</h2>
      <label>Contexte<textarea name="context" rows="3" placeholder="Intensité, durée, repas, température…">${esc(e.context)}</textarea></label>`;
  }
  if (kind === 'meds') {
    const m = item('meds', e.medId);
    return `<h2>${esc(m.emoji)} ${esc(m.name)}</h2>
      <label>Dose<input name="dose" value="${esc(e.dose)}"></label>
      <label>Note<textarea name="note" rows="2">${esc(e.note)}</textarea></label>`;
  }
  return `<h2>💩 Selles — échelle de Bristol</h2>
    <div class="bristol">${BRISTOL.map((b, i) => `
      <label><input type="radio" name="bristol" value="${i + 1}" required ${e.bristol === i + 1 ? 'checked' : ''}>
        <b>${i + 1}</b><span>${b}</span></label>`).join('')}</div>
    <label>Note<textarea name="note" rows="2">${esc(e.note)}</textarea></label>`;
}

// Ouvre la fiche d'une saisie existante (id) ou d'une nouvelle (entry)
function openEdit(date, kind, id, entry = null) {
  const e = entry || findEntry(date, kind, id);
  if (!e) return;
  openDlg(`${entryFields(kind, e)}
    <label>Heure<input name="time" type="time" value="${esc(e.time)}" required></label>
    ${actions(!entry)}`, (fd, act) => {
    if (act === 'del') removeEntry(date, kind, e.id);
    else {
      const v = Object.fromEntries(fd);
      if (v.bristol) v.bristol = +v.bristol;
      for (const k of ['context', 'note', 'dose']) if (k in v) v[k] = v[k].trim();
      const list = dayOf(date)[kind], i = list.findIndex(x => x.id === e.id);
      const next = { ...e, ...v };
      if (i < 0) list.push(next); else list[i] = next;
    }
    save(); render();
  });
}

// ---------- Bilan du soir ----------
function openCheckin() {
  const date = day(), had = peek(date).checkin, c = had || {};
  const scale = (name, lo, hi) => `
    <div class="scale">${[1, 2, 3, 4, 5].map(n => `
      <label><input type="radio" name="${name}" value="${n}" ${c[name] === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
    <div class="ends"><span>${lo}</span><span>${hi}</span></div>`;
  const acts = db.activities.filter(a => !a.off || c.activities?.includes(a.id));
  openDlg(`<h2>🌙 Bilan — ${esc(longDate(date))}</h2>
    <fieldset><legend>😴 Sommeil</legend>
      <label>Durée (heures)<input name="sleepHours" type="number" min="0" max="24" step="0.5" inputmode="decimal" value="${c.sleepHours ?? ''}"></label>
      <div class="lbl">Qualité</div>${scale('sleepQuality', 'mauvaise', 'excellente')}
    </fieldset>
    <fieldset><legend>🙂 Humeur</legend>${scale('mood', 'très basse', 'très bonne')}</fieldset>
    <fieldset><legend>😰 Stress</legend>${scale('stress', 'calme', 'très stressée')}</fieldset>
    <fieldset><legend>🩸 Cycle</legend>
      <label class="chk"><input type="checkbox" name="period" ${c.period ? 'checked' : ''}>Règles aujourd'hui</label>
      <label>Jour du cycle<input name="cycleDay" type="number" min="1" max="99" inputmode="numeric" value="${c.cycleDay ?? ''}"></label>
    </fieldset>
    <fieldset><legend>🏃 Activités</legend>
      <div class="chips">${acts.map(a => `
        <label><input type="checkbox" name="activities" value="${a.id}" ${c.activities?.includes(a.id) ? 'checked' : ''}><span>${esc(a.emoji)} ${esc(a.name)}</span></label>`).join('')}</div>
    </fieldset>
    <label>Note du jour<textarea name="note" rows="3">${esc(c.note)}</textarea></label>
    ${actions(!!had)}`, (fd, act) => {
    const d = dayOf(date);
    d.checkin = act === 'del' ? null : {
      sleepHours: num(fd.get('sleepHours')), sleepQuality: num(fd.get('sleepQuality')),
      mood: num(fd.get('mood')), stress: num(fd.get('stress')),
      period: fd.has('period'), cycleDay: num(fd.get('cycleDay')),
      activities: fd.getAll('activities'), note: fd.get('note').trim(),
    };
    save(); render();
  });
}

// ---------- Couleur choisie à la main ----------
function openColor() {
  const date = day(), d = peek(date), n = d.symptoms?.length || 0;
  openDlg(`<h2>Couleur — ${esc(longDate(date))}</h2>
    <div class="colors">${['', 'green', 'orange', 'red'].map(k => `
      <label><input type="radio" name="color" value="${k}" ${(d.color || '') === k ? 'checked' : ''}>
        <span class="dot ${k || autoColor(d)}"></span>${k ? COLOR_NAMES[k] : `Automatique (${n} symptôme${n > 1 ? 's' : ''})`}</label>`).join('')}</div>
    ${actions(false)}`, fd => {
    dayOf(date).color = fd.get('color') || null;
    save(); render();
  });
}

// ---------- Onglet Calendrier ----------
let month = today().slice(0, 7);
function renderMonth() {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate();
  const cells = Array((first.getDay() + 6) % 7).fill('<span></span>'); // semaine du lundi au dimanche
  const count = { green: 0, orange: 0, red: 0 };
  for (let i = 1; i <= n; i++) {
    const date = `${month}-${String(i).padStart(2, '0')}`, c = colorOf(date);
    if (c) count[c]++;
    cells.push(`<button class="cell ${c} ${date === today() ? 'now' : ''}" data-act="openday" data-date="${date}" ${date > today() ? 'disabled' : ''}>
      ${i}${peek(date).color ? '<i>✎</i>' : ''}</button>`);
  }
  $('#v-month').innerHTML = `
    <div class="daynav">
      <button data-act="mprev" aria-label="Mois précédent">‹</button>
      <div class="dtitle"><b>${esc(cap(first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })))}</b></div>
      <button data-act="mnext" aria-label="Mois suivant" ${month >= today().slice(0, 7) ? 'disabled' : ''}>›</button>
    </div>
    <div class="cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(j => `<b>${j}</b>`).join('')}${cells.join('')}</div>
    <p class="legend">
      <span><span class="dot green"></span>${count.green} jour(s)</span>
      <span><span class="dot orange"></span>${count.orange} jour(s)</span>
      <span><span class="dot red"></span>${count.red} jour(s)</span>
    </p>
    <p class="muted">Vert : aucun symptôme · orange : 1 à 2 · rouge : 3 et plus. ✎ : couleur choisie à la main.
      Touche un jour pour voir son détail ou changer sa couleur.</p>`;
}

// ---------- Onglet Réglages ----------
const LISTS = {
  symptoms: { title: 'Symptômes', ex: 'Mal de tête', emoji: '🤒' },
  meds: { title: 'Médicaments', ex: 'Paracétamol', emoji: '💊' },
  activities: { title: 'Activités', ex: 'Natation', emoji: '🏃' },
};

function renderSettings() {
  $('#v-settings').innerHTML = Object.entries(LISTS).map(([k, L]) => `
    <h2>${L.title}</h2>
    <ul class="list">${active(k).map((x, i) => `
      <li class="li-item"><span class="ico">${esc(x.emoji)}</span>
        <span class="name">${esc(x.name)}${x.dose ? ` <small>${esc(x.dose)}</small>` : ''}</span>
        <button class="chip" data-act="up" data-list="${k}" data-id="${x.id}" ${i ? '' : 'disabled'} aria-label="Monter">↑</button>
        <button class="chip" data-act="rename" data-list="${k}" data-id="${x.id}" aria-label="Modifier">✏️</button>
        <button class="chip" data-act="remove" data-list="${k}" data-id="${x.id}" aria-label="Retirer">🗑</button>
      </li>`).join('') || '<li class="muted">Liste vide</li>'}</ul>
    <form class="bar addform" data-list="${k}">
      <input name="emoji" class="emoji" placeholder="${L.emoji}" aria-label="Emoji">
      <input name="name" placeholder="${L.ex}" required aria-label="Nom">
      ${k === 'meds' ? '<input name="dose" class="dose" placeholder="Dose" aria-label="Dose">' : ''}
      <button class="primary">Ajouter</button>
    </form>`).join('') + `

    ${typeof cloudHtml === 'function' ? cloudHtml() : ''}

    <h2>Sauvegarde</h2>
    <p class="muted">Les données sont enregistrées sur ce téléphone. Exporte-les de temps en temps.</p>
    <button data-act="export">⬇️ Exporter (JSON)</button>
    <label class="btn">⬆️ Restaurer<input type="file" accept=".json,application/json" id="imp-json" hidden></label>
    <p class="muted">${Object.keys(db.days).length} jour(s) noté(s)</p>`;
}

function editItem(k, x) {
  openDlg(`<h2>Modifier</h2>
    <div class="row"><label class="emoji-l">Emoji<input name="emoji" value="${esc(x.emoji)}"></label>
      <label>Nom<input name="name" value="${esc(x.name)}" required></label></div>
    ${k === 'meds' ? `<label>Dose habituelle<input name="dose" value="${esc(x.dose)}"></label>` : ''}
    ${actions(false)}`, fd => {
    x.emoji = fd.get('emoji').trim() || LISTS[k].emoji;
    x.name = fd.get('name').trim() || x.name;
    if (k === 'meds') x.dose = fd.get('dose').trim();
    save(); render();
  });
}

// ---------- Navigation ----------
const VIEWS = { day: renderDay, month: renderMonth, settings: renderSettings };
let view = 'day';
function render() { VIEWS[view](); }
function go(v) {
  view = v;
  for (const s of document.querySelectorAll('.view')) s.hidden = s.id !== 'v-' + v;
  for (const b of document.querySelectorAll('nav button')) b.classList.toggle('on', b.dataset.view === v);
  render();
  scrollTo(0, 0);
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-view]');
  if (!t) return;
  if (t.dataset.view) {
    if (t.dataset.view === 'day') cur = null; // l'onglet « Journée » ramène toujours à aujourd'hui
    return go(t.dataset.view);
  }
  const { id, list } = t.dataset;
  const x = list && db[list].find(i => i.id === id);
  switch (t.dataset.act) {
    case 'prev': setDay(shift(day(), -1)); return render();
    case 'next': setDay(shift(day(), 1)); return render();
    case 'today': cur = null; return render();
    case 'color': return openColor();
    case 'checkin': return openCheckin();
    case 'addsym': return addEntry('symptoms', { typeId: id, context: '' });
    case 'addmed': return addEntry('meds', { medId: id, dose: item('meds', id).dose || '', note: '' });
    case 'addstool': return openEdit(day(), 'stools', null, { id: uid(), time: cur ? '12:00' : nowTime(), bristol: null, note: '' });
    case 'edit': return openEdit(day(), t.dataset.kind, id);
    case 'dlgclose': return $('#dlg').close();
    case 'dlgdel':
      if (!confirm('Supprimer ?')) return;
      $('#dlg').close();
      return dlgOk?.(null, 'del');
    case 'mprev': month = shiftMonth(month, -1); return render();
    case 'mnext': month = shiftMonth(month, 1); return render();
    case 'openday': setDay(t.dataset.date); return go('day');
    case 'up': {
      const arr = db[list], i = arr.indexOf(x);
      const j = arr.slice(0, i).findLastIndex(o => !o.off);
      if (j >= 0) [arr[i], arr[j]] = [arr[j], arr[i]];
      break;
    }
    case 'rename': return editItem(list, x);
    case 'remove':
      if (!confirm(`Retirer « ${x.name} » de la liste ? (l'historique est conservé)`)) return;
      x.off = true; break;
    case 'export': return download(`suivi-sante-${today()}.json`, JSON.stringify(db, null, 1), 'application/json');
    default: return;
  }
  save(); render();
});

document.addEventListener('submit', e => {
  const f = e.target;
  if (!f.classList.contains('addform')) return;
  e.preventDefault();
  const k = f.dataset.list, name = f.elements.name.value.trim();
  if (!name) return;
  const emoji = f.elements.emoji.value.trim() || LISTS[k].emoji, dose = f.elements.dose?.value.trim() || '';
  // Même nom qu'un élément retiré : on le réactive (son historique reste lié)
  const old = db[k].find(o => o.name.toLowerCase() === name.toLowerCase());
  if (old) Object.assign(old, { off: false, emoji }, k === 'meds' ? { dose } : {});
  else db[k].push({ id: uid(), name, emoji, ...(k === 'meds' ? { dose } : {}) });
  save(); render();
  $(`.addform[data-list="${k}"] [name="name"]`)?.focus();
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id !== 'imp-json' || !t.files?.[0]) return;
  const text = await t.files[0].text();
  t.value = '';
  try {
    const d = JSON.parse(text);
    if (!d.days || !d.symptoms) throw 0;
    if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
    db = { ...structuredClone(EMPTY), ...d }; save(); render();
  } catch { alert('Fichier de sauvegarde invalide.'); }
});

// Appli restée ouverte : à la reprise, « aujourd'hui » peut avoir changé
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
