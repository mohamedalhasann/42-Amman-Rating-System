// Turns ratings into signals staff can read. Pure functions over the workspace snapshot.
//
// Dimensions come from the original design (docs/system parts/voting_gate.md on frontend_prototype):
// every label belongs to one dimension, students never see them, staff read the data through them.
// The catalog has no dimension field yet, so labels are mapped by name; unknown labels fall under
// "Other" until the backend stores a dimension per label.
import {counted} from './model.js';

export const DIMENSIONS = ['Help', 'Teamwork', 'Community', 'Conduct'];

const DIMENSION_OF = {
  'helpful': 'Help',
  'good teammate': 'Teamwork',
  'unreliable teammate': 'Teamwork',
  'community contributor': 'Community',
  'respectful': 'Conduct',
  'disruptive': 'Conduct',
  'aggressive behavior': 'Conduct',
  'disrespectful': 'Conduct',
  'clear explainer': 'Help',
  'helpful feedback': 'Help',
  'knows their code': 'Help',
  'thorough': 'Teamwork',
  'well prepared': 'Teamwork',
  'rushed': 'Teamwork',
  'late': 'Teamwork',
  'unprepared': 'Teamwork',
  'fair': 'Conduct',
  'open to feedback': 'Conduct',
  'defensive': 'Conduct',
  'bad evaluator': 'Conduct',
};

export const dimensionOf = label => DIMENSION_OF[label?.name?.trim().toLowerCase()] || 'Other';

// Same rule the student API uses: allowed at 3 stars reads positive, at 2 a concern, only at 1 a flag.
export const toneOf = label => {
  const stars = label?.allowed_stars || [];
  return stars.includes(3) ? 'positive' : stars.includes(2) ? 'concern' : 'flag';
};

const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const sortedWindows = db => [...db.windows].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

/** Everything the staff record says about one student, computed from counted ratings only. */
export function studentInsights(db, studentId) {
  const labels = new Map(db.labels.map(l => [l.id, l]));
  const received = db.ratings.filter(r => r.recipient_id === studentId && counted(r));
  const given = db.ratings.filter(r => r.voter_id === studentId);

  // One row per dimension: positive and negative mentions, and how many different people made them.
  const dims = Object.fromEntries([...DIMENSIONS, 'Other'].map(d => [d, {dimension: d, positive: 0, negative: 0, flags: 0, positivePeople: new Set(), negativePeople: new Set(), ratingIds: new Set()}]));
  const labelCounts = new Map();
  for (const r of received) {
    for (const id of r.label_ids) {
      const label = labels.get(id);
      if (!label) continue;
      const tone = toneOf(label), row = dims[dimensionOf(label)];
      row.ratingIds.add(r.id);
      if (tone === 'positive') { row.positive++; row.positivePeople.add(r.voter_id); }
      else { row.negative++; row.negativePeople.add(r.voter_id); if (tone === 'flag') row.flags++; }
      const entry = labelCounts.get(id) || {label, tone, count: 0, people: new Set()};
      entry.count++; entry.people.add(r.voter_id);
      labelCounts.set(id, entry);
    }
  }
  const dimensions = Object.values(dims)
    .filter(d => d.dimension !== 'Other' || d.positive + d.negative > 0)
    .map(d => ({...d, positivePeople: d.positivePeople.size, negativePeople: d.negativePeople.size, ratingIds: [...d.ratingIds]}));

  const perWindow = sortedWindows(db).map(w => {
    const rows = received.filter(r => r.window_id === w.id);
    const concerns = rows.filter(r => r.label_ids.some(id => toneOf(labels.get(id)) !== 'positive')).length;
    return {window: w, average: mean(rows.map(r => r.stars)), count: rows.length, concerns};
  });

  return {
    average: mean(received.map(r => r.stars)),
    received: received.length,
    raters: new Set(received.map(r => r.voter_id)).size,
    stars: [3, 2, 1].map(s => ({stars: s, count: received.filter(r => r.stars === s).length})),
    dimensions,
    labels: [...labelCounts.values()].map(e => ({...e, people: e.people.size})).sort((a, b) => b.people - a.people || b.count - a.count),
    perWindow,
    given: {total: given.length, stars: [3, 2, 1].map(s => ({stars: s, count: given.filter(r => r.stars === s).length}))},
    cases: db.cases.filter(c => c.student_ids.includes(studentId)),
  };
}

/**
 * Short reasons to look at a student in the selected window. Worded as signals, never verdicts,
 * and counted by distinct people so one person repeating a label doesn't read as a pattern.
 */
export function indicators(db, studentId, windowId) {
  const labels = new Map(db.labels.map(l => [l.id, l]));
  const out = [];
  const windowRows = db.ratings.filter(r => r.recipient_id === studentId && r.window_id === windowId && counted(r));

  // Flags and concerns this window, grouped by dimension.
  const byDim = {};
  for (const r of windowRows) for (const id of r.label_ids) {
    const label = labels.get(id), tone = toneOf(label);
    if (!label || tone === 'positive') continue;
    const d = byDim[dimensionOf(label)] ||= {flags: new Set(), concerns: new Set()};
    (tone === 'flag' ? d.flags : d.concerns).add(r.voter_id);
  }
  for (const [dimension, d] of Object.entries(byDim)) {
    if (d.flags.size) out.push({kind: 'flag', weight: 3, text: `${dimension} · flagged by ${d.flags.size} ${d.flags.size === 1 ? 'person' : 'people'}`});
    else if (d.concerns.size >= 2) out.push({kind: 'concern', weight: 2, text: `${dimension} concerns · ${d.concerns.size} people`});
  }

  // Concerns rising compared with the previous window.
  const windows = sortedWindows(db), i = windows.findIndex(w => w.id === windowId);
  if (i > 0) {
    const concernCount = wid => db.ratings.filter(r => r.recipient_id === studentId && r.window_id === wid && counted(r) && r.label_ids.some(id => toneOf(labels.get(id)) !== 'positive')).length;
    const now = concernCount(windowId), before = concernCount(windows[i - 1].id);
    if (now >= 2 && now > before) out.push({kind: 'concern', weight: 1, text: `Concerns rising · ${before} → ${now}`});
  }

  if (db.cases.some(c => c.status === 'open' && c.student_ids.includes(studentId))) out.push({kind: 'case', weight: 3, text: 'In an open abuse case'});

  const raters = new Set(db.ratings.filter(r => r.recipient_id === studentId && counted(r)).map(r => r.voter_id)).size;
  if (raters > 0 && raters < 3) out.push({kind: 'info', weight: 0, text: `Few raters · ${raters}`});

  return out.sort((a, b) => b.weight - a.weight);
}
