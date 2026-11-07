import React, {useEffect, useMemo, useState} from 'react';
import {useStaff} from './context';
import {average, counted, fullName} from './model';
import {Avatar, dateTime, Empty, Icon, RatingLabels, Search} from './components';

// The abuse queue reads as three lanes, because staff handle each kind differently:
//   likely abuse  — look at the evidence, exclude the bad votes or dismiss;
//   1-star checks — every serious vote is surfaced; read the reason, keep or invalidate it;
//   context       — advisories (revenge pairs, only-3-star voters); read, nothing to exclude by default.
export const LANES = [
  ['abuse', 'Likely abuse'],
  ['check', '1-star checks'],
  ['context', 'For context'],
];

export function laneOf(c) {
  const kinds = c.findings.map(f => f.kind || '');
  if (kinds.length && kinds.every(k => k === 'serious')) return 'check';
  if (c.findings.length && c.findings.every(f => f.advisory)) return 'context';
  return 'abuse';
}

// Other cases sharing a vote with this one, so a 1-star check inside a group case reads as one story.
export const relatedCases = (db, c) => db.cases.filter(x => x.id !== c.id && laneOf(x) !== 'check' && x.rating_ids.some(id => c.rating_ids.includes(id)));

const minutes = m => m >= 120 ? `${Math.round(m / 60)} h` : `${m} min`;

// The two or three numbers that make a finding make sense at a glance.
export function factsOf(f) {
  const e = f.evidence || {};
  switch (f.kind) {
    case 'bulk': return [`${e.voters} students`, `${minutes(e.minutes)}`, `${e.share}% of campus votes then`, e.deadline_rush && 'deadline rush'];
    case 'group': return [`${e.voters} students`, `within ${minutes(e.minutes)}`, ...(e.labels || [])];
    case 'boosting': return [`${e.core} in the core circle`, `${e.members} involved`, (e.windows || []).join(' and ')];
    case 'repeated': return [`${e.stars}★ every time`, (e.windows || []).join(', ')];
    case 'revenge': return [`${e.hours_apart} h apart`];
    case 'extreme': return [`${e.votes} votes`, `all ${e.stars}★`];
    case 'serious': return e.labels || [];
    default: return [];
  }
}

function useCaseData(c) {
  const {db} = useStaff();
  return useMemo(() => {
    const ratings = db.ratings.filter(r => c.rating_ids.includes(r.id)).sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
    const attempts = db.attempts.filter(a => c.attempt_ids.includes(a.id)).sort((a, b) => a.attempted_at.localeCompare(b.attempted_at));
    // Roles come from the detector; older cases fall back to who gave and who received.
    const roles = {...(c.roles || {})};
    for (const id of c.student_ids) {
      if (roles[id]) continue;
      const gave = ratings.some(r => r.voter_id === id), got = ratings.some(r => r.recipient_id === id);
      roles[id] = gave && got ? 'participant' : got ? 'target' : 'voter';
    }
    return {ratings, attempts, roles};
  }, [db, c]);
}

const student = (db, id) => db.students.find(s => s.id === id);

// ---------------- inbox ----------------

// Most serious first; the one-line rule is what staff need to judge each row in the group.
const PATTERNS = [
  ['group', 'Group voting', 'Three or more students gave one student 1 star within an hour.'],
  ['bulk', 'Bulk votes', 'Many students rated one student within 20 minutes, a large share of all votes on campus at that time.'],
  ['boosting', 'Friends boosting', 'The same circle of students traded 3 stars with each other in more than one window.'],
  ['extreme', 'Extreme voter', 'A student who gave only 1 star (4 votes or more), or only 3 stars (10 votes or more).'],
  ['repeated', 'Repeated votes', 'A student gave the same student the same stars in consecutive windows.'],
  ['revenge', 'Pair voting', 'Two students gave each other 1 star in the same window. Often a real dispute.'],
  ['serious', 'Serious vote check', 'Every 1-star vote, so a serious claim is checked by a person before it counts against someone.'],
];
const patternOf = c => c.findings[0]?.kind || c.findings[0]?.mechanism || 'other';
const shortWhen = t => t ? new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Amman', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}).format(new Date(t)) : '';

function PatternGroup({id, name, rule, cases, db, openCase, showWindow}) {
  const [all, setAll] = useState(false);
  const shown = all ? cases : cases.slice(0, 5);
  return <section className="pattern-group">
    <header className="pattern-head">
      <h3>{name}<span className="pattern-count">{cases.length}</span></h3>
      {rule && <p>{rule}</p>}
    </header>
    <ul className="case-rows">
      {shown.map(c => {
        const f = c.findings[0] || {};
        const facts = c.findings.flatMap(factsOf).filter(Boolean).slice(0, 3);
        const related = id === 'serious' ? relatedCases(db, c) : [];
        const win = db.windows.find(w => w.id === c.window_id)?.name;
        return <li key={c.id}><button data-case-id={c.id} className={`case-row lane-${laneOf(c)}`} onClick={() => openCase(c.id)}>
          <span className="case-row-main">
            <span className="case-row-title">{c.title}</span>
            <span className="case-row-facts">{facts.map((x, i) => <span key={i}>{x}</span>)}{related.length > 0 && <span className="case-row-related">also in {related[0].findings[0]?.mechanism.toLowerCase()}</span>}</span>
          </span>
          <span className="case-row-meta">
            {c.status !== 'open' && <span className={'case-row-status ' + c.status}>{c.status === 'confirmed' ? 'Votes excluded' : 'Dismissed'}</span>}
            {showWindow && <span>{win}</span>}
            <time dateTime={f.observed_to || c.detected_at}>{shortWhen(f.observed_to || c.detected_at)}</time>
          </span>
          <Icon name="arrow" size={16}/>
        </button></li>;
      })}
    </ul>
    {cases.length > 5 && <button className="text-button pattern-more" onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `Show all ${cases.length}`}</button>}
  </section>;
}

export function AbuseReview() {
  const {db, windowId, openCase, reviewInboxState, setReviewInboxState} = useStaff();
  const {status, scope, query} = reviewInboxState;
  const lane = reviewInboxState.lane || 'abuse';
  const update = patch => setReviewInboxState(state => ({...state, page: 1, ...patch}));
  const inScope = db.cases.filter(c => scope === 'all' || c.window_id === windowId);
  const openIn = l => inScope.filter(c => c.status === 'open' && laneOf(c) === l).length;
  const q = query.trim().toLowerCase();
  const cases = inScope
    .filter(c => laneOf(c) === lane)
    .filter(c => status === 'any' || (status === 'decided' ? c.status !== 'open' : c.status === 'open'))
    .filter(c => !q || (c.title + ' ' + c.student_ids.map(id => fullName(student(db, id)) + ' ' + (student(db, id)?.intra_username || '')).join(' ')).toLowerCase().includes(q))
    .sort((a, b) => (b.findings[0]?.observed_to || b.detected_at).localeCompare(a.findings[0]?.observed_to || a.detected_at));
  const known = PATTERNS.map(([id, name, rule]) => ({id, name, rule, cases: cases.filter(c => patternOf(c) === id)}));
  const other = [...new Set(cases.map(patternOf).filter(k => !PATTERNS.some(p => p[0] === k)))]
    .map(k => ({id: k, name: cases.find(c => patternOf(c) === k).findings[0]?.mechanism || 'Other', rule: '', cases: cases.filter(c => patternOf(c) === k)}));
  const groups = [...known, ...other].filter(g => g.cases.length);
  const blurb = {
    abuse: 'Votes that look coordinated, repeated or one-sided. Open a case, read the evidence, then exclude the abusive votes or dismiss it.',
    check: 'Every 1-star vote. Keep it if the reason describes something real, invalidate it if the claim is invented.',
    context: 'Worth knowing, not accusations. Usually nothing needs excluding.',
  }[lane];

  return <div className="abuse-inbox">
    <div className="lane-bar" role="tablist" aria-label="Kinds of cases">
      {LANES.map(([id, label]) => <button key={id} role="tab" aria-selected={lane === id} className={`lane-tab lane-${id}` + (lane === id ? ' active' : '')} onClick={() => update({lane: id})}>
        {label}<span className="lane-count">{openIn(id)}</span>
      </button>)}
    </div>
    <div className="abuse-toolbar">
      <p className="lane-blurb">{blurb}</p>
      <div className="abuse-filters">
        <Search value={query} onChange={value => update({query: value})} label="Search cases" placeholder="Search a student"/>
        <select aria-label="Decision" value={status === 'any' || status === 'decided' ? status : 'open'} onChange={e => update({status: e.target.value})}><option value="open">Needs a decision</option><option value="decided">Decided</option><option value="any">All cases</option></select>
        <select aria-label="Which windows" value={scope} onChange={e => update({scope: e.target.value})}><option value="all">All windows</option><option value="window">Selected window</option></select>
      </div>
    </div>
    {groups.length ? groups.map(g => <PatternGroup key={g.id + lane + status} {...g} db={db} openCase={openCase} showWindow={new Set(cases.map(c => c.window_id)).size > 1}/>)
      : <section className="panel"><Empty>{status === 'open' ? 'Nothing waiting here.' : 'No cases match.'}</Empty></section>}
  </div>;
}

// ---------------- one case ----------------

function Timeline({ratings, attempts, from, to}) {
  const times = [...ratings.map(r => Date.parse(r.submitted_at)), ...attempts.map(a => Date.parse(a.attempted_at))];
  if (times.length < 2) return null;
  const start = Math.min(...times, from ? Date.parse(from) : Infinity), end = Math.max(...times, to ? Date.parse(to) : -Infinity);
  const span = Math.max(1, end - start);
  const pos = t => `${((Date.parse(t) - start) / span) * 100}%`;
  const fmt = t => new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Amman', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}).format(new Date(t));
  const length = span / 60000;
  return <div className="case-timeline" aria-label={`Votes from ${fmt(start)} to ${fmt(end)}`}>
    <div className="timeline-track">
      {from && to && <span className="timeline-span" style={{left: pos(from), width: `${(Date.parse(to) - Date.parse(from)) / span * 100}%`}}/>}
      {ratings.map(r => <span key={r.id} className={`timeline-mark stars-${r.stars}` + (counted(r) ? '' : ' excluded')} style={{left: pos(r.submitted_at)}} title={`${r.stars}★ at ${fmt(r.submitted_at)}`}/>)}
      {attempts.map(a => <span key={a.id} className="timeline-mark blocked" style={{left: pos(a.attempted_at)}} title={`Blocked at ${fmt(a.attempted_at)}`}/>)}
    </div>
    <div className="timeline-scale"><span>{fmt(start)}</span><span>{length < 120 ? `${Math.max(1, Math.round(length))} minutes` : length < 2880 ? `${Math.round(length / 60)} hours` : `${Math.round(length / 1440)} days`}</span><span>{fmt(end)}</span></div>
  </div>;
}

export function CaseDetail({id}) {
  const {db, dispatch, notify, go, openCase, goStudent, saving} = useStaff();
  const c = db.cases.find(item => item.id === id);
  const [selected, setSelected] = useState([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [asAbuse, setAsAbuse] = useState(false);
  useEffect(() => { setSelected([]); setReason(''); setError(''); setAsAbuse(false); }, [id]);
  const data = useCaseData(c || {rating_ids: [], attempt_ids: [], student_ids: [], findings: []});
  if (!c) return <section className="panel"><Empty>This case could not be found.</Empty><button className="button" onClick={() => go('review')}>Back to the queue</button></section>;

  const {ratings, attempts, roles} = data;
  const lane = laneOf(c), mode = asAbuse ? 'abuse' : lane;
  const open = c.status === 'open';
  const countable = ratings.filter(counted);
  const picked = selected.filter(rid => countable.some(r => r.id === rid));
  const name = sid => fullName(student(db, sid));
  const votes = n => `${n} ${n === 1 ? 'vote' : 'votes'}`;
  const byRole = role => Object.keys(roles).filter(sid => roles[sid] === role);
  const targets = byRole('target'), voters = byRole('voter'), others = byRole('participant');
  const revenge = c.findings.find(f => f.kind === 'revenge');

  // What excluding the selected votes would do to each affected student's overall rating.
  const preview = [...new Set(ratings.filter(r => picked.includes(r.id)).map(r => r.recipient_id))].map(sid => {
    const before = average(db, sid);
    const rest = db.ratings.filter(r => r.recipient_id === sid && counted(r) && !picked.includes(r.id));
    const after = rest.length ? rest.reduce((s, r) => s + r.stars, 0) / rest.length : null;
    return {sid, before, after, removed: ratings.filter(r => picked.includes(r.id) && r.recipient_id === sid).length};
  });

  const nextOpen = db.cases.filter(x => x.id !== c.id && x.status === 'open' && laneOf(x) === lane).sort((a, b) => b.detected_at.localeCompare(a.detected_at))[0];

  async function decide(status, ids, text) {
    setError('');
    try {
      await dispatch({type: 'resolve-case', id: c.id, status, ids, reason: text});
      notify(status === 'dismissed' ? 'Decision saved. No votes changed.' : `${ids.length} ${ids.length === 1 ? 'vote' : 'votes'} excluded. Ratings updated.`);
      if (nextOpen) openCase(nextOpen.id);
    } catch (e) { setError(e.message); }
  }
  const toggle = rid => setSelected(ids => ids.includes(rid) ? ids.filter(x => x !== rid) : [...ids, rid]);
  const fmt = r => new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Amman', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}).format(new Date(r));

  return <div className="case-layout">
    <div className="case-main">
      <section className={`panel case-what lane-${lane}`}>
        <div className="case-what-head">
          <span className="case-card-patterns">{c.findings.map(f => <span key={f.mechanism + f.kind} className="pattern-chip">{f.mechanism}</span>)}</span>
          <span className="muted">{db.windows.find(w => w.id === c.window_id)?.name} · detected {dateTime(c.detected_at)}</span>
        </div>
        {c.findings.map(f => <div key={f.mechanism + f.kind} className="case-finding">
          <p>{f.explanation}</p>
          {factsOf(f).filter(Boolean).length > 0 && <div className="case-card-facts">{factsOf(f).filter(Boolean).map((x, i) => <span key={i}>{x}</span>)}</div>}
        </div>)}
        {relatedCases(db, c).map(x => <button key={x.id} className="case-related" onClick={() => openCase(x.id)}><span>This vote is also part of <b>{x.title}</b>{x.status === 'open' ? '. Deciding that case may settle this one.' : ` (${x.status === 'confirmed' ? 'votes excluded' : 'dismissed'}).`}</span><Icon name="arrow" size={15}/></button>)}
        {lane === 'context' && <p className="case-note">This is context, not an accusation. Nothing needs excluding unless the evidence shows abuse.</p>}
      </section>

      {lane !== 'check' && <section className="panel case-who">
        <h2>Who is involved</h2>
        {revenge ? <div className="pair-view">
          {ratings.slice(0, 2).map(r => <div key={r.id} className="pair-side">
            <button className="person-chip" onClick={() => goStudent(r.voter_id)}><Avatar student={student(db, r.voter_id)}/>{name(r.voter_id)}</button>
            <p className="muted">gave {name(r.recipient_id)} {r.stars} star · {fmt(r.submitted_at)}</p>
            <RatingLabels rating={r}/>
            <blockquote>{r.explanation || 'No explanation written.'}</blockquote>
          </div>)}
        </div> : <div className="role-groups">
          {targets.length > 0 && <div className="role-group"><span className="role-label">On the receiving end</span>{targets.map(sid => <button key={sid} className="person-chip is-target" onClick={() => goStudent(sid)}><Avatar student={student(db, sid)}/>{name(sid)}<small>{votes(ratings.filter(r => r.recipient_id === sid).length)}</small></button>)}</div>}
          {voters.length > 0 && <div className="role-group"><span className="role-label">Voting</span>{voters.map(sid => <button key={sid} className="person-chip" onClick={() => goStudent(sid)}><Avatar student={student(db, sid)}/>{name(sid)}<small>{votes(ratings.filter(r => r.voter_id === sid).length)}</small></button>)}</div>}
          {others.length > 0 && <div className="role-group"><span className="role-label">In the group</span>{others.map(sid => <button key={sid} className="person-chip" onClick={() => goStudent(sid)}><Avatar student={student(db, sid)}/>{name(sid)}<small>{ratings.filter(r => r.voter_id === sid).length} given · {ratings.filter(r => r.recipient_id === sid).length} received</small></button>)}</div>}
        </div>}
      </section>}

      {(ratings.length > 1 || attempts.length > 0) && <section className="panel case-when">
        <h2>When it happened</h2>
        <Timeline ratings={ratings} attempts={attempts} from={c.findings[0]?.observed_from} to={c.findings[0]?.observed_to}/>
        <div className="timeline-legend"><span><i className="stars-3"/>3★</span><span><i className="stars-2"/>2★</span><span><i className="stars-1"/>1★</span>{attempts.length > 0 && <span><i className="blocked"/>blocked attempt</span>}<span><i className="excluded"/>excluded</span></div>
      </section>}

      <section className="panel case-votes">
        <div className="case-votes-head">
          <h2>The votes <span className="muted">· {ratings.length} linked{attempts.length ? ` · ${attempts.length} blocked attempts` : ''}</span></h2>
          {open && mode === 'abuse' && countable.length > 1 && <button className="text-button" onClick={() => setSelected(picked.length === countable.length ? [] : countable.map(r => r.id))}>{picked.length === countable.length ? 'Clear selection' : 'Select all'}</button>}
        </div>
        <ul className="vote-list">
          {ratings.map(r => <li key={r.id} className={(picked.includes(r.id) ? 'is-picked ' : '') + (counted(r) ? '' : 'is-excluded')}>
            {open && mode === 'abuse' && counted(r) ? <input type="checkbox" aria-label={`Exclude ${name(r.voter_id)}'s vote for ${name(r.recipient_id)}`} checked={picked.includes(r.id)} onChange={() => toggle(r.id)}/> : <span className="vote-spacer"/>}
            <div className="vote-who"><b>{name(r.voter_id)}</b><Icon name="arrow" size={14}/><b>{name(r.recipient_id)}</b><span className="muted">{fmt(r.submitted_at)}</span></div>
            <span className={`vote-stars stars-text-${r.stars}`} aria-label={`${r.stars} stars`}>{'★'.repeat(r.stars)}<i>{'★'.repeat(3 - r.stars)}</i></span>
            <div className="vote-body"><RatingLabels rating={r}/>{r.explanation && <p>“{r.explanation}”</p>}</div>
            {!counted(r) && <span className="vote-excluded">Excluded</span>}
          </li>)}
          {attempts.map(a => <li key={a.id} className="is-attempt"><span className="vote-spacer"/><div className="vote-who"><b>{name(a.voter_id)}</b><Icon name="arrow" size={14}/><b>{name(a.recipient_id)}</b><span className="muted">{fmt(a.attempted_at)}</span></div><span className="vote-blocked">Blocked</span><div className="vote-body"><p className="muted">{a.reason}</p></div></li>)}
        </ul>
      </section>
    </div>

    <aside className="case-decision">
      {!open ? <div className="panel decision-done">
        <h2>{c.status === 'confirmed' ? 'Votes excluded' : 'Dismissed'}</h2>
        <p>{c.review?.reason}</p>
        <small className="muted">{c.review?.by} · {dateTime(c.review?.at)}</small>
        <p className="muted">{ratings.filter(r => !counted(r)).length} of {ratings.length} votes excluded</p>
      </div> : <div className="panel decision-panel">
        {mode === 'check' && countable.length === 1 ? <>
          <h2>Is this report genuine?</h2>
          <p className="muted">Keep the vote if the explanation describes something real. Invalidate it only if the claim is invented. Either way, write why.</p>
          <label className="decision-reason">Reason<textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="What you checked and found"/></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="decision-actions">
            <button className="button" disabled={saving || !reason.trim()} onClick={() => decide('dismissed', [], reason)}>Keep the vote</button>
            <button className="button danger" disabled={saving || !reason.trim()} onClick={() => decide('confirmed', [countable[0].id], reason)}>Invalidate it</button>
          </div>
        </> : mode === 'context' ? <>
          <h2>Noted?</h2>
          <p className="muted">Mark it as reviewed. Nothing changes for any student.</p>
          <label className="decision-reason">Note<textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional: anything worth remembering"/></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="decision-actions">
            <button className="button primary" disabled={saving} onClick={() => decide('dismissed', [], reason.trim() || 'Reviewed as context; no action needed.')}>Mark as reviewed</button>
          </div>
          {countable.length > 0 && <button className="text-button decision-switch" onClick={() => setAsAbuse(true)}>This looks like abuse after all</button>}
        </> : <>
          <h2>{picked.length ? `Exclude ${picked.length} ${picked.length === 1 ? 'vote' : 'votes'}?` : 'Select the votes to exclude'}</h2>
          {!picked.length && <p className="muted">Tick the abusive votes on the left, or dismiss the case if nothing is wrong.</p>}
          {preview.length > 0 && <ul className="decision-preview">
            {preview.map(p => <li key={p.sid}><span>{name(p.sid)}</span><span className="preview-change">{p.before === null ? '—' : p.before.toFixed(2)} <Icon name="arrow" size={13}/> <b>{p.after === null ? 'no rating' : p.after.toFixed(2)}</b></span><small className="muted">{p.removed} vote{p.removed === 1 ? '' : 's'} removed</small></li>)}
          </ul>}
          <label className="decision-reason">Reason<textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="What the evidence shows"/></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="decision-actions">
            <button className="button danger" disabled={saving || !reason.trim() || (countable.length > 0 && !picked.length)} onClick={() => decide('confirmed', picked, reason)}>{countable.length ? `Exclude ${picked.length || ''} ${picked.length === 1 ? 'vote' : 'votes'}`.replace('  ', ' ') : 'Confirm abuse'}</button>
            <button className="button" disabled={saving || !reason.trim()} onClick={() => decide('dismissed', [], reason)}>Not abuse, dismiss</button>
          </div>
          <p className="decision-fineprint">Excluded votes stop counting immediately. Voters don’t get their vote back.</p>
        </>}
      </div>}
      {nextOpen && <button className="button next-case" onClick={() => openCase(nextOpen.id)}>Next case in this lane <Icon name="arrow" size={16}/></button>}
    </aside>
  </div>;
}
