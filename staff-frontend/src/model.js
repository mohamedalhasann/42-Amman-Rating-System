export const fullName = s => s ? `${s.first_name} ${s.last_name}` : 'Unknown student';
export const counted = r => !r.invalidation;
export const ratingsIn = (db, windowId) => db.ratings.filter(r => r.window_id === windowId);
export const stateOfWindow = (w, now = Date.now()) => now < Date.parse(w.starts_at) ? 'Upcoming' : now >= Date.parse(w.ends_at) ? 'Closed' : 'Open';
export function average(db, studentId, windowId = null) {
  const rows = db.ratings.filter(r => r.recipient_id === studentId && counted(r) && (!windowId || r.window_id === windowId));
  return rows.length ? rows.reduce((sum, r) => sum + r.stars, 0) / rows.length : null;
}
export function participation(db, windowId) {
  const w = db.windows.find(w => w.id === windowId);
  return (w?.roster || []).map(id => {
    const student = db.students.find(s => s.id === id);
    const given = ratingsIn(db, windowId).filter(r => r.voter_id === id);
    return {student, submitted: given.length, counted: given.filter(counted).length, remaining: Math.max(0, w.max_votes - given.length)};
  });
}
export function stats(db, windowId) {
  const rows = ratingsIn(db, windowId), roster = participation(db, windowId);
  const rated = roster.filter(p => p.submitted > 0).length;
  return {submitted: rows.length, counted: rows.filter(counted).length, invalidated: rows.filter(r => !counted(r)).length, total: roster.length, rated, notRated: roster.length - rated};
}
export function activitySeries(db, windowId, maxBuckets = 7) {
  const w = db.windows.find(w => w.id === windowId);
  const rows = ratingsIn(db, windowId);
  const formatter = new Intl.DateTimeFormat('en', {year:'numeric', month:'2-digit', day:'2-digit', timeZone:'Asia/Amman'});
  const dayNumber = value => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(part => [part.type, part.value]));
    return Date.parse(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`) / 86400000;
  };
  // Keep historical submissions visible even if staff edit the window's dates.
  const dates = rows.map(r => dayNumber(r.submitted_at));
  const first = Math.min(dayNumber(w.starts_at), ...dates);
  const last = Math.max(dayNumber(Date.parse(w.ends_at) - 1), ...dates);
  const dayCount = last - first + 1, size = Math.min(maxBuckets, dayCount);
  const key = day => new Date(day * 86400000).toISOString().slice(0, 10);
  return Array.from({length:size}, (_, i) => {
    const start = first + Math.floor(i * dayCount / size), end = first + Math.floor((i + 1) * dayCount / size);
    return {startDay:key(start), endDay:key(end-1), count:dates.filter(day => day >= start && day < end).length};
  });
}
export function filterRatings(db, windowId, filters = {}) {
  return ratingsIn(db, windowId).filter(r => (!filters.stars || r.stars === Number(filters.stars)) &&
    (!filters.label || r.label_ids.includes(filters.label)) && (!filters.student || r.voter_id === filters.student || r.recipient_id === filters.student) &&
    (!filters.state || (filters.state === 'counted' ? counted(r) : !counted(r))));
}
export function searchReceivedRatings(db, rows, query) {
  const normalize = value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const term = normalize(query);
  if (!term) return rows;
  const matches = new Set(db.students.filter(student => normalize(`${fullName(student)} ${student.intra_username}`).includes(term)).map(student => student.id));
  return rows.filter(rating => matches.has(rating.recipient_id));
}
export function groupsFor(db, rows, by) {
  const groups = new Map();
  const labelNames = new Map(db.labels.map(label => [label.id, label.name]));
  const studentNames = new Map(db.students.map(student => [student.id, fullName(student)]));
  rows.forEach(r => {
    const keys = by === 'label' ? (r.label_ids.length ? r.label_ids : ['none']) : [by === 'stars' ? String(r.stars) : r.recipient_id];
    keys.forEach(key => {
      if (!groups.has(key)) groups.set(key, {id: key, name: by === 'label' ? (labelNames.get(key) || 'No labels') : by === 'stars' ? `${key} star${key === '1' ? '' : 's'}` : studentNames.get(key) || 'Unknown student', rows: []});
      groups.get(key).rows.push(r);
    });
  });
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length);
}
export function validateWindow(db, w) {
  if (!w.name.trim()) return 'Enter a window name.';
  if (!Number.isFinite(Date.parse(w.starts_at)) || !Number.isFinite(Date.parse(w.ends_at)) || Date.parse(w.starts_at) >= Date.parse(w.ends_at)) return 'The end must be after the start.';
  if (!Number.isInteger(w.min_votes) || !Number.isInteger(w.max_votes) || w.min_votes < 0 || w.max_votes < w.min_votes) return 'Use whole numbers with 0 ≤ minimum ≤ maximum.';
  if (db.windows.some(other => other.id !== w.id && Date.parse(w.starts_at) < Date.parse(other.ends_at) && Date.parse(w.ends_at) > Date.parse(other.starts_at))) return 'This overlaps another voting window. Only one window can be active at a time.';
  return '';
}
const audit = (db, action, target, detail, now) => ({...db, audit: [{id: crypto.randomUUID(), actor: 'Demo staff', action, target, detail, at: now}, ...db.audit]});
export function applyAction(db, action, now = new Date().toISOString()) {
  if (action.type === 'resolve-case') {
    const c = db.cases.find(c => c.id === action.id);
    if (!c || c.status === 'dismissed' || c.resolved_at) throw new Error('This case has already been resolved.');
    if (!['confirmed', 'dismissed'].includes(action.status) || !action.reason?.trim()) throw new Error('Choose an outcome and enter a reason.');
    const ids = [...new Set(action.ids || [])];
    if (action.status === 'dismissed' && ids.length) throw new Error('Dismissing a case cannot exclude ratings.');
    if (ids.some(id => !c.rating_ids.includes(id) || !db.ratings.some(r => r.id === id && counted(r)))) throw new Error('Select only counted ratings linked to this case.');
    if (action.status === 'confirmed' && !ids.length && db.ratings.some(r => c.rating_ids.includes(r.id) && counted(r))) throw new Error('Select the abusive ratings to exclude, or dismiss the case.');
    const reason = action.reason.trim();
    return audit({...db,
      cases: db.cases.map(item => item.id === c.id ? {...item, status: action.status, resolved_at: now, review: {reason, by: 'Demo staff', at: now}} : item),
      ratings: db.ratings.map(r => ids.includes(r.id) ? {...r, invalidation: {case_id: c.id, reason, by: 'Demo staff', at: now}} : r),
    }, 'Case resolved', c.id, action.status === 'dismissed' ? `Dismissed · ${reason}` : `${ids.length} ratings excluded (${ids.join(', ')}) · ${reason}`, now);
  }
  if (action.type === 'capture-rosters') {
    const eligible = db.students.filter(s => s.active && s.approved_at && s.email_verified_at).map(s => s.id);
    return {...db, windows: db.windows.map(w => Date.parse(w.starts_at) <= Date.parse(now) && !w.roster_captured_at ? {...w, roster: w.roster.length ? w.roster : eligible, roster_captured_at: now} : w)};
  }
  if (action.type === 'review') {
    const c = db.cases.find(c => c.id === action.id);
    if (!c || c.status !== 'open') throw new Error('This case has already been reviewed.');
    if (!['confirmed', 'dismissed'].includes(action.status) || !action.reason.trim()) throw new Error('Enter a reason for the decision.');
    return audit({...db, cases: db.cases.map(c => c.id === action.id ? {...c, status: action.status, review: {reason: action.reason.trim(), by: 'Demo staff', at: now}} : c)}, 'Case '+action.status, action.id, action.reason.trim(), now);
  }
  if (action.type === 'invalidate') {
    const c = db.cases.find(c => c.id === action.caseId);
    if (!c || c.status !== 'confirmed') throw new Error('Confirm the abuse case before invalidating a vote.');
    if (!action.reason.trim() || !action.ids.length) throw new Error('Select votes and enter an invalidation reason.');
    if (action.ids.some(id => !c.rating_ids.includes(id) || !db.ratings.some(r => r.id === id))) throw new Error('Only ratings linked to the confirmed case can be invalidated.');
    const ids = action.ids.filter(id => !db.ratings.find(r => r.id === id).invalidation);
    if (!ids.length) return db;
    return audit({...db, ratings: db.ratings.map(r => ids.includes(r.id) ? {...r, invalidation: {case_id: c.id, reason: action.reason.trim(), by: 'Demo staff', at: now}} : r)}, 'Votes invalidated', c.id, `${ids.join(', ')} · ${action.reason.trim()}`, now);
  }
  if (action.type === 'window') {
    const error = validateWindow(db, action.value); if (error) throw new Error(error);
    const existing = db.windows.find(w => w.id === action.value.id);
    if (existing && existing.version !== action.value.version) throw new Error('This window changed. Reopen it before saving.');
    const value = {...action.value, version: (existing?.version || 0) + 1, roster: existing?.roster || []};
    return audit({...db, windows: existing ? db.windows.map(w => w.id === value.id ? value : w) : [...db.windows, value]}, existing ? 'Window updated' : 'Window created', value.id, value.name, now);
  }
  if (action.type === 'label') {
    const l = action.value;
    if (!l.name.trim() || !l.allowed_stars.length || l.allowed_stars.some(s => ![1,2,3].includes(s))) throw new Error('Enter a name and select at least one star level.');
    if (db.labels.some(other => other.id !== l.id && other.name.toLowerCase() === l.name.trim().toLowerCase())) throw new Error('A label with this name already exists.');
    const previous = db.labels.find(other => other.id === l.id);
    if (previous && previous.name !== l.name) throw new Error('Create a replacement label to preserve historical wording.');
    return audit({...db, labels: previous ? db.labels.map(other => other.id === l.id ? l : other) : [...db.labels, {...l, name: l.name.trim()}]}, 'Label updated', l.id, `${l.name} · ${l.active ? 'active' : 'inactive'} · ${l.allowed_stars.join('/')}`, now);
  }
  if (action.type === 'approval-setting') return audit({...db, settings: {...db.settings, manual_student_approval_enabled: action.enabled}}, 'Approval setting updated', 'settings', action.enabled ? 'Manual approval enabled. Established approvals preserved.' : 'Manual approval disabled. Existing pending accounts still require an explicit decision.', now);
  if (action.type === 'approve') {
    const student = db.students.find(s => s.id === action.id);
    if (!student?.active || !student.email_verified_at || student.approved_at) throw new Error('Only active, verified, pending students can be approved.');
    return audit({...db, students: db.students.map(s => s.id === action.id ? {...s, approved_at: now} : s)}, 'Student approved', action.id, fullName(student), now);
  }
  if (action.type === 'export') return audit(db, 'Ratings exported', action.windowId, `${action.count} records`, now);
  return db;
}
export function ratingsCsv(db, rows) {
  const columns = ['rating_id', 'window_id', 'voter_id', 'voter_name', 'recipient_id', 'recipient_name', 'stars', 'labels', 'submitted_at', 'state', 'explanation', 'invalidation_reason'];
  const cell = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [columns, ...rows.map(r => [r.id, r.window_id, r.voter_id, fullName(db.students.find(s => s.id === r.voter_id)), r.recipient_id, fullName(db.students.find(s => s.id === r.recipient_id)), r.stars, r.label_ids.map(id => db.labels.find(l => l.id === id)?.name).join('; '), r.submitted_at, counted(r) ? 'counted' : 'invalidated', r.explanation, r.invalidation?.reason || ''])].map(row => row.map(cell).join(',')).join('\r\n');
}
