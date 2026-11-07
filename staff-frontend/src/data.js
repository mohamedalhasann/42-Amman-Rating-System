// Synthetic fixtures only. Replace the local adapter with the Django API before production.
const names = [
  ['Lina', 'Mansour', 'lmansour'], ['Khaled', 'Qasem', 'kqasem'],
  ['Noor', 'Terzi', 'nterzi'], ['Omar', 'Alkhatib', 'oalkhat'],
  ['Sara', 'Abbadi', 'sabbadi'], ['Rami', 'Haddad', 'rhaddad'],
  ['Dina', 'Nasser', 'dnasser'], ['Adam', 'Salem', 'asalem'],
  ['Yara', 'Hamdan', 'yhamdan'], ['Zaid', 'Saleh', 'zsaleh'],
  ['Hala', 'Awad', 'hawad'], ['Sami', 'Khalil', 'skhalil'],
];
export function createData() {
  const students = names.map(([first_name, last_name, intra_username], i) => ({
    id: `s${i + 1}`, first_name, last_name, intra_username, active: true,
    email_verified_at: '2026-10-25T08:00:00Z', approved_at: i < 10 ? '2026-10-25T09:00:00Z' : null,
  }));
  const roster = students.slice(0, 10).map(s => s.id);
  const windows = [
    {id: 'w6', name: 'October review', starts_at: '2026-10-26T06:00:00Z', ends_at: '2026-11-02T15:00:00Z', min_votes: 0, max_votes: 8, roster: [...roster], version: 1},
    {id: 'w7', name: 'November review', starts_at: '2026-11-04T06:00:00Z', ends_at: '2026-11-10T15:00:00Z', min_votes: 3, max_votes: 8, roster: [...roster], version: 1},
    {id: 'w8', name: 'Next review', starts_at: '2026-11-12T06:00:00Z', ends_at: '2026-11-18T15:00:00Z', min_votes: 0, max_votes: 8, roster: [], version: 1},
  ];
  const labels = [
    ['Helpful', [2, 3]], ['Good teammate', [2, 3]], ['Community contributor', [2, 3]],
    ['Respectful', [2, 3]], ['Disruptive', [1, 2]], ['Unreliable teammate', [1, 2]],
    ['Aggressive behavior', [1]], ['Disrespectful', [1]], ['Other', [1]],
  ].map(([name, allowed_stars], i) => ({id: `l${i + 1}`, name, allowed_stars, active: true}));
  const ratings = [];
  function add(voter, recipient, stars, minute, label, explanation = '') {
    const id = `r${ratings.length + 1}`;
    ratings.push({id, window_id: 'w7', voter_id: `s${voter}`, recipient_id: `s${recipient}`, stars,
      label_ids: label ? [label] : [], explanation,
      submitted_at: new Date(Date.UTC(2026, 10, 5, 9, minute)).toISOString(), invalidation: null});
    return id;
  }
  const pair = [add(3, 4, 1, 0, 'l6', 'My assigned teammate did not deliver their agreed part of the group exercise.'), add(4, 3, 1, 11, 'l8', 'During our discussion, the student repeatedly interrupted and used disrespectful language.')];
  const bulk = [1, 2, 3, 4, 5, 7].map((s, i) => add(s, 6, 2, 60 + [0,4,8,12,16,19][i], 'l5', 'Repeated interruptions during the shared evaluation session.'));
  const boost = [add(1, 2, 3, 120, 'l1'), add(2, 7, 3, 122, 'l2'), add(7, 1, 3, 124, 'l4'), add(2, 1, 3, 126, 'l1'), add(1, 7, 3, 128, 'l2'), add(7, 2, 3, 130, 'l1')];
  const fast = [add(8, 1, 3, 150, 'l1'), add(8, 2, 2, 150, 'l4'), add(8, 3, 3, 151, 'l3')];
  const extreme = [add(5, 1, 1, 180, 'l6', 'The student missed their assigned group task without notifying the group.'), add(5, 2, 1, 190, 'l8', 'The student made disrespectful remarks during a peer discussion.'), add(5, 7, 1, 200, 'l5', 'The evaluation was interrupted repeatedly while another student was explaining.')];
  const malicious = [add(4, 2, 1, 240, 'l9', 'I heard from someone else that this student did something wrong. I was not present.')];
  add(6, 1, 3, 260, 'l1'); add(6, 8, 3, 280, 'l4'); add(7, 8, 2, 300, 'l6');
  ratings.filter(r => boost.includes(r.id)).forEach(r => {r.submitted_at = new Date(Date.parse(r.submitted_at)-86400000).toISOString();});
  ratings.filter(r => fast.includes(r.id)).forEach(r => {r.submitted_at = new Date(Date.parse(r.submitted_at)+86400000).toISOString();});
  ratings.slice(-3).forEach((r,i) => {r.submitted_at = new Date(Date.UTC(2026,10,i===0?4:6,12,20+i*5)).toISOString();});
  // A second window exercises all-window averages independently of the current filter.
  for (let i = 0; i < 7; i++) ratings.push({id: `old${i}`, window_id: 'w6', voter_id: `s${i + 1}`, recipient_id: `s${(i + 2) % 8 + 1}`, stars: i % 2 ? 2 : 3, label_ids: ['l1'], explanation: '', submitted_at: `2026-10-28T1${i}:00:00Z`, invalidation: null});
  const attempts = [0, 1, 2, 3].map(i => ({id: `a${i}`, voter_id: 's3', recipient_id: 's4', window_id: 'w7', attempted_at: new Date(Date.UTC(2026, 10, 5, 9, 14 + i)).toISOString(), outcome: 'Blocked', reason: 'Pair already rated in this window', is_retry: false}));
  function makeCase(id, title, mechanism, summary, rating_ids, student_ids, extra = {}) {
    const observed = [...ratings.filter(r => rating_ids.includes(r.id)).map(r => Date.parse(r.submitted_at)), ...attempts.filter(a => (extra.attempt_ids || []).includes(a.id)).map(a => Date.parse(a.attempted_at))];
    return {id, title, window_id: 'w7', status: 'open', detected_at: new Date(Math.max(...observed)+60000).toISOString(), rating_ids,
      student_ids, findings: [{mechanism, explanation: summary}], attempt_ids: [], review: null, ...extra};
  }
  const cases = [
    makeCase('c1', 'Two low ratings, eleven minutes apart', 'Pair voting / revenge', 'Noor and Omar rated each other 1 star eleven minutes apart. Review their explanations and the sequence before deciding whether there was retaliation.', pair, ['s3', 's4']),
    makeCase('c2', 'Six students rated Rami in nineteen minutes', 'Bulk votes', 'Six distinct voters rated Rami during the same short interval. A shared event may explain the activity.', bulk, ['s1', 's2', 's3', 's4', 's5', 's6', 's7']),
    makeCase('c3', 'Repeated attempts after a rating was accepted', 'Repeated votes', 'Noor attempted to rate Omar four more times after their accepted rating. These are separate submissions, not identical network retries. The additional votes were blocked.', [pair[0]], ['s3', 's4'], {attempt_ids: attempts.map(a => a.id)}),
    makeCase('c4', 'Several matching ratings for one student', 'Group voting', 'Six voters chose the same stars and label for Rami close together. Compare the explanations and context for evidence of coordination.', bulk, ['s1', 's2', 's3', 's4', 's5', 's6', 's7'], {findings: [{mechanism: 'Group voting', explanation: 'The six linked ratings share 2 stars and the Disruptive label.'}, {mechanism: 'Bulk votes', explanation: 'The same six ratings were submitted within nineteen minutes.'}]}),
    makeCase('c5', 'High ratings exchanged within a group', 'Friends boosting', 'Lina, Khaled, and Dina exchanged six 3-star ratings. Review this pattern alongside their ratings outside the group.', boost, ['s1', 's2', 's7']),
    makeCase('c6', 'Three ratings submitted within one minute', 'Too fast or too often', 'Adam submitted three ratings within one minute. Review whether each rating reflects a considered interaction.', fast, ['s8', 's1', 's2', 's3']),
    makeCase('c7', 'Only 1-star ratings in this sample', 'Extreme voter', 'These three ratings from Sara all used 1 star. A small or uniform sample is not proof of abuse; inspect each explanation.', extreme, ['s5', 's1', 's2', 's7']),
    makeCase('c8', 'A serious report without first-hand context', 'Malicious serious vote', 'The explanation says the voter was not present and is repeating a second-hand claim. Staff must establish the facts; the system cannot determine whether an accusation is true.', malicious, ['s4', 's2']),
  ];
  return {schema: 3, students, windows, labels, ratings, attempts, cases, settings: {manual_student_approval_enabled: true}, audit: []};
}
