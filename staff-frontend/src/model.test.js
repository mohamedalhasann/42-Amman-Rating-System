import test from 'node:test';
import assert from 'node:assert/strict';
import {createData} from './data.js';
import {activitySeries, applyAction, average, counted, filterRatings, groupsFor, participation, ratingsCsv, ratingsIn, searchReceivedRatings, stateOfWindow, stats, validateWindow} from './model.js';

test('all eight required abuse examples have named students and resolvable evidence', () => {
  const db = createData();
  assert.equal(new Set(db.cases.flatMap(c => c.findings.map(f => f.mechanism))).size, 8);
  for (const c of db.cases) {
    assert.ok(c.student_ids.length);
    assert.ok(c.student_ids.every(id => db.students.some(s => s.id === id)));
    assert.ok(c.rating_ids.every(id => db.ratings.some(r => r.id === id)));
    assert.ok(c.attempt_ids.every(id => db.attempts.some(a => a.id === id)));
    const linked = db.ratings.filter(r => c.rating_ids.includes(r.id));
    assert.ok(linked.every(r => c.student_ids.includes(r.voter_id) && c.student_ids.includes(r.recipient_id)));
  }
});
test('fixtures follow the agreed rating and roster constraints', () => {
  const db = createData(), pairs = new Set();
  for (const r of db.ratings) {
    const w = db.windows.find(w => w.id === r.window_id);
    assert.notEqual(r.voter_id, r.recipient_id);
    assert.ok(w.roster.includes(r.voter_id) && w.roster.includes(r.recipient_id));
    const pair = `${r.window_id}/${r.voter_id}/${r.recipient_id}`;
    assert.ok(!pairs.has(pair)); pairs.add(pair);
    assert.ok(Date.parse(r.submitted_at) >= Date.parse(w.starts_at) && Date.parse(r.submitted_at) < Date.parse(w.ends_at));
    assert.ok(r.label_ids.every(id => db.labels.some(l => l.id === id && l.allowed_stars.includes(r.stars))));
    if (r.stars === 1) {assert.ok(r.explanation.trim()); assert.ok(r.label_ids.length);}
  }
  for (const w of db.windows) assert.ok(participation(db, w.id).every(p => p.submitted <= w.max_votes));
});
test('overview and participation reconcile, including zero-vote students', () => {
  const db = createData(), s = stats(db, 'w7'), roster = participation(db, 'w7');
  assert.equal(s.submitted, roster.reduce((sum, p) => sum + p.submitted, 0));
  assert.equal(s.total, s.rated + s.notRated);
  assert.equal(s.submitted, s.counted + s.invalidated);
  assert.ok(roster.some(p => p.submitted === 0));
});
test('student grouping and name/username search work with 235 recipients and duplicate display names', () => {
  const db=createData();
  db.students=Array.from({length:235},(_,i)=>({id:`campus-${i}`,first_name:'Campus',last_name:i<2?'Shared Name':`Student ${String(i).padStart(3,'0')}`,intra_username:`login${String(i).padStart(3,'0')}`}));
  const rows=db.students.flatMap((student,i)=>[0,1].map(n=>({id:`scale-${i}-${n}`,voter_id:db.students[(i+1)%235].id,recipient_id:student.id,stars:3,label_ids:['l1'],invalidation:n?null:{reason:'Fixture invalidation'}})));
  assert.equal(groupsFor(db,rows,'student').length,235);
  assert.ok(groupsFor(db,rows,'student').every(group=>group.rows.length===2));
  const byUsername=searchReceivedRatings(db,rows,'  LOGIN234  ');
  assert.equal(byUsername.length,2);
  assert.ok(byUsername.every(row=>row.recipient_id==='campus-234'));
  assert.equal(searchReceivedRatings(db,rows,'Campus   Shared Name').length,4);
  assert.equal(searchReceivedRatings(db,rows,'Student 02').length,20);
  assert.equal(searchReceivedRatings(db,rows,'does not exist').length,0);
  assert.equal(searchReceivedRatings(db,rows,'  '),rows);
  assert.equal(searchReceivedRatings(db,rows.filter(counted),'login234').length,1);
});
test('activity chart covers Amman calendar boundaries, long windows, and preserved historical votes', () => {
  const db = createData();
  const window = db.windows.find(w => w.id === 'w7');
  let series = activitySeries(db,'w7');
  assert.equal(series.reduce((sum,b) => sum + b.count,0),ratingsIn(db,'w7').length);
  window.starts_at = '2026-11-01T06:00:00Z';
  window.ends_at = '2026-12-15T15:00:00Z';
  series = activitySeries(db,'w7');
  assert.equal(series.length,7);
  assert.equal(series.reduce((sum,b) => sum+b.count,0),ratingsIn(db,'w7').length);
  window.starts_at = '2026-11-05T18:00:00Z';
  window.ends_at = '2026-11-06T06:00:00Z';
  db.ratings = [{...db.ratings[0],submitted_at:'2026-11-05T22:00:00Z'}];
  series = activitySeries(db,'w7');
  assert.equal(series.find(b => b.startDay === '2026-11-06').count,1);
  window.starts_at = '2026-12-01T06:00:00Z';
  window.ends_at = '2026-12-03T15:00:00Z';
  assert.equal(activitySeries(db,'w7').reduce((sum,b)=>sum+b.count,0),1);
});
test('invalidation requires confirmation, updates scores/totals, preserves allowance, and is idempotent', () => {
  let db = createData();
  const request = {type:'invalidate', caseId:'c1', ids:['r1'], reason:'Confirmed retaliatory vote.'};
  assert.throws(() => applyAction(db, request), /Confirm/);
  assert.throws(() => applyAction(db, {type:'review', id:'c1', status:'confirmed', reason:'  '}), /reason/);
  const before = average(db, 's4'), quota = participation(db, 'w7').find(p => p.student.id === 's3');
  db = applyAction(db, {type:'review',id:'c1',status:'confirmed',reason:'Reviewed the evidence.'});
  assert.equal(stats(db,'w7').invalidated,0);
  assert.throws(() => applyAction(db,{...request, ids:['old0']}), /linked/);
  db = applyAction(db, request);
  assert.notEqual(average(db,'s4'),before);
  assert.equal(average(db,'s4'),2);
  assert.equal(average(db,'s4','w7'),null);
  assert.equal(stats(db,'w7').invalidated,1);
  assert.deepEqual(participation(db,'w7').find(p=>p.student.id==='s3').remaining,quota.remaining);
  assert.equal(applyAction(db,request),db);
  assert.ok(db.audit.some(e=>e.action==='Votes invalidated'));
});
test('dismissal leaves ratings and allowances untouched', () => {
  const db=createData(); const next=applyAction(db,{type:'review',id:'c1',status:'dismissed',reason:'Legitimate independent reports.'});
  assert.deepEqual(next.ratings,db.ratings); assert.deepEqual(participation(db,'w7'),participation(next,'w7'));
});
test('windows reject overlaps, invalid ranges, fractional limits, and stale edits', () => {
  const db=createData(), w=db.windows[1];
  assert.match(validateWindow(db,{...w,id:'new'}),/overlaps/);
  assert.match(validateWindow(db,{...w,ends_at:w.starts_at}),/end/);
  assert.match(validateWindow(db,{...w,min_votes:1.5}),/whole/);
  assert.throws(()=>applyAction(db,{type:'window',value:{...w,version:0}}),/changed/);
  const next=applyAction(db,{type:'window',value:{...w,min_votes:0,max_votes:1}});
  assert.deepEqual(next.ratings,db.ratings);
  assert.ok(participation(next,'w7').every(p=>p.remaining>=0));
  assert.equal(stateOfWindow(w,Date.parse(w.starts_at)),'Open');
  assert.equal(stateOfWindow(w,Date.parse(w.ends_at)),'Closed');
});
test('approval preserves established approval and window snapshots', () => {
  const db=createData(), approved=applyAction(db,{type:'approve',id:'s11'});
  assert.ok(approved.students.find(s=>s.id==='s11').approved_at);
  assert.deepEqual(approved.windows,db.windows);
  const next=applyAction(approved,{type:'approval-setting',enabled:false});
  assert.deepEqual(next.students,approved.students);
  assert.equal(next.students.find(s=>s.id==='s12').approved_at,null);
});
test('label edits preserve historical wording and votes', () => {
  const db=createData();
  const next=applyAction(db,{type:'label',value:{...db.labels[0],active:false,allowed_stars:[3]}});
  assert.deepEqual(next.ratings,db.ratings);
  assert.throws(()=>applyAction(db,{type:'label',value:{...db.labels[0],name:'Renamed'}}),/replacement/);
  assert.throws(()=>applyAction(db,{type:'label',value:{...db.labels[0],allowed_stars:[]}}),/star/);
});
test('grouping, filtering, and export use the same rating records', () => {
  const db=createData(), rows=ratingsIn(db,'w7');
  assert.equal(groupsFor(db,rows,'stars').reduce((sum,g)=>sum+g.rows.length,0),rows.length);
  assert.equal(groupsFor(db,rows,'student').reduce((sum,g)=>sum+g.rows.length,0),rows.length);
  assert.ok(filterRatings(db,'w7',{stars:'1'}).every(r=>r.stars===1));
  assert.equal(average(db,'s12'),null);
  const csv=ratingsCsv(db,[{...rows[0],explanation:'=HYPERLINK("bad")\nsecond line, quoted'}]);
  assert.ok(csv.includes('rating_id')); assert.ok(csv.includes('invalidation_reason'));
  assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('""bad""'));
});
