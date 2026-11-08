import React, {useEffect, useState} from 'react';
import {useStaff} from './context';
import {activitySeries, average, counted, filterRatings, fullName, groupsFor, participation, ratingsIn, searchReceivedRatings, stateOfWindow, stats} from './model';
import {indicators, studentInsights, toneOf, dimensionOf} from './insights';
import {Avatar, Badge, dateTime, Empty, Icon, PageControls, Person, RatingTable, Search, shortDate, Tabs} from './components';

function PanelHeading({title, children, description}) {return <div className="panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</div>;}
const displayAverage = value => value === null ? '—' : value.toFixed(2);

const ammanDay = value => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Amman', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(value));
const ammanTime = value => new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Amman', hour:'2-digit', minute:'2-digit'}).format(new Date(value));

// Who voted on one day of the chart: one row per voter, with their votes and time span that day.
function DayVoters({rows, period, onClose}) {
  const voters = Object.values(rows.reduce((acc, r) => {
    const v = acc[r.voter_id] ||= {id: r.voter_id, count: 0, first: r.submitted_at, last: r.submitted_at};
    v.count++;
    if (r.submitted_at < v.first) v.first = r.submitted_at;
    if (r.submitted_at > v.last) v.last = r.submitted_at;
    return acc;
  }, {})).sort((a, b) => b.count - a.count || a.first.localeCompare(b.first));
  return <div className="day-voters">
    <div className="day-voters-head">
      <p><strong>{period}</strong> · {rows.length} rating{rows.length===1?'':'s'} from {voters.length} student{voters.length===1?'':'s'}</p>
      <button className="text-button" onClick={onClose}>Close</button>
    </div>
    <ul>
      {voters.map(v => <li key={v.id}>
        <Person id={v.id}/>
        <span className="day-voters-count">{v.count} vote{v.count===1?'':'s'}</span>
        <span className="day-voters-time">{v.count===1 ? ammanTime(v.first) : `${ammanTime(v.first)}–${ammanTime(v.last)}`}</span>
      </li>)}
    </ul>
  </div>;
}

function MetricCard({label, value, note, action, onOpen, attention = false, children}) {
  return <article className="metric-card">
    <button className="metric-cover" aria-label={action} onClick={onOpen}/>
    <span className="metric-label">{attention && <i className="metric-attention" aria-hidden="true"/>}{label}<Icon name="arrow" size={16}/></span>
    <strong className="metric-value">{value}</strong>
    {children}
    <p className="metric-note">{note}</p>
  </article>;
}

export function Overview() {
  const {db, windowId, go, setExplorerFilters, setRosterState, setNewWindowRequest, now} = useStaff();
  // Only when nothing is open or scheduled does the overview ask staff to plan the next window.
  const nothingPlanned = !db.windows.some(w => ['Open', 'Upcoming'].includes(stateOfWindow(w, now)));
  const rows = ratingsIn(db, windowId), summary = stats(db, windowId);
  const cases = db.cases.filter(c => c.window_id === windowId && c.status === 'open').sort((a,b)=>b.detected_at.localeCompare(a.detected_at));
  const series = activitySeries(db,windowId);
  const grouped = series.some(b => b.startDay !== b.endDay);
  const bars = series.map(b => {const label=shortDate(`${b.startDay}T12:00:00Z`);return {...b,label,period:b.startDay===b.endDay?label:`${label} – ${shortDate(`${b.endDay}T12:00:00Z`)}`};});
  const max = Math.max(1, ...bars.map(b=>b.count));
  // today's day in Amman, to draw the unfinished day lighter than complete ones
  const todayKey = ammanDay(new Date());
  // Clicking a day opens who voted on it; a new window starts closed.
  const [day, setDay] = useState(null);
  useEffect(() => setDay(null), [windowId]);
  const picked = day === null ? null : bars[day];
  return <>
    {nothingPlanned && <section className="plan-window" aria-label="Next voting window">
      <div><strong>No voting window is open or scheduled.</strong><p>Students can’t vote until you plan the next one.</p></div>
      <button className="button primary" onClick={()=>{setNewWindowRequest(true);go('settings');}}>Plan the next window <Icon name="arrow" size={16}/></button>
    </section>}
    <section className="overview-metrics overview-cards" aria-label="Window totals">
      {/* One card language: label, number, one line of context, and the same arrow. Each card opens its list. */}
      <MetricCard label="Ratings submitted" value={summary.submitted} note={`${summary.counted} counted · ${summary.invalidated} invalidated`} action="Browse ratings in this window" onOpen={()=>{setExplorerFilters({});go('explorer')}}/>
      <MetricCard label="Student participation" value={<>{summary.total ? Math.round(summary.rated/summary.total*100) : 0}<small>%</small></>} note={`${summary.rated} of ${summary.total} students have rated`} action="See who rated in this window" onOpen={()=>{setRosterState(state=>({...state,scope:'window',filter:'all',page:1}));go('students')}}>
        <div className="participation-track" aria-hidden="true"><i style={{width:`${summary.total ? summary.rated/summary.total*100 : 0}%`}}/></div>
      </MetricCard>
      <MetricCard label="Still to participate" value={Math.max(0,summary.total-summary.rated)} note={!summary.total?'No students in this window’s roster':summary.total===summary.rated?'Everyone has rated':'Students who haven’t rated yet'} action="See students who have not rated" onOpen={()=>{setRosterState(state=>({...state,scope:'window',filter:'not',page:1}));go('students')}}/>
      <MetricCard label="Open abuse cases" attention={cases.length>0} value={cases.length} note={cases.length ? 'Waiting for a staff decision' : 'Nothing waiting for review'} action="Open abuse review" onOpen={()=>go('review')}/>
    </section>
    <section className="panel"><PanelHeading title="Rating activity" description={grouped?"Accepted ratings, grouped across this window":"Accepted ratings by day"}><span className="chart-legend"><i/>Submitted</span></PanelHeading>{rows.length ? <><div className="activity-chart" role="img" aria-label={bars.map(b=>`${b.period}: ${b.count} ratings`).join('; ')}><div className="chart-y"><span>{max}</span><span>{Math.round(max/2)}</span><span>0</span></div><div className="chart-bars">{bars.map((b,i)=><button type="button" className={`chart-day ${day===i?'selected':''}`} key={i} disabled={!b.count} aria-pressed={day===i} aria-label={`${b.period}: ${b.count} ratings. Show who voted`} onClick={()=>setDay(day===i?null:i)}><span className="bar-number">{b.count || ''}</span><div className={`bar ${b.startDay<=todayKey&&todayKey<=b.endDay?'today':''} ${b.count===0?'zero':''}`} title={`${b.period}: ${b.count} ratings`} style={{height:b.count?b.count/max*150:0}}/><span className="bar-label">{b.label}</span></button>)}</div></div>{picked && <DayVoters rows={rows.filter(r=>{const k=ammanDay(r.submitted_at);return picked.startDay<=k&&k<=picked.endDay;})} period={picked.period} onClose={()=>setDay(null)}/>}<div className="chart-note">All accepted votes count immediately. Only invalidated votes are excluded from averages.</div></> : <Empty>This window has no ratings yet.</Empty>}</section>
    <section className="panel"><PanelHeading title="Recent ratings" description="Latest accepted ratings in this window"><button className="text-button" onClick={()=>{setExplorerFilters({});go('explorer')}}>Browse ratings <Icon name="arrow" size={17}/></button></PanelHeading><RatingTable rows={[...rows].sort((a,b)=>b.submitted_at.localeCompare(a.submitted_at)).slice(0,5)} pageSize={5}/></section>
  </>;
}

export function Students() {
  const {db, windowId, goStudent, rosterState, setRosterState} = useStaff();
  const {query, page} = rosterState;
  // the overview's cards send 'all' / 'not'; this roster also has 'look' and 'below'
  const filter = ({all: 'all', not: 'none', rated: 'all'})[rosterState.filter] || rosterState.filter || 'all';
  const sort = rosterState.sort || 'look';
  const set = patch => setRosterState(state => ({...state, ...patch}));
  const w = db.windows.find(w => w.id === windowId);
  const inWindow = new Map(participation(db, windowId).map(p => [p.student.id, p]));
  const min = w?.min_votes || 0, max = w?.max_votes || 0;

  // One row per active student: overall rating, this window's votes, and reasons to look.
  const rows = db.students.filter(s => s.active).map(student => {
    const p = inWindow.get(student.id);
    const signals = indicators(db, student.id, windowId);
    return {student, p, rating: average(db, student.id), signals, weight: signals.reduce((sum, x) => sum + x.weight, 0)};
  });
  const counts = {
    all: rows.length,
    look: rows.filter(r => r.weight > 0).length,
    none: rows.filter(r => r.p && r.p.submitted === 0).length,
    below: rows.filter(r => r.p && r.p.submitted > 0 && r.p.submitted < min).length,
  };
  const q = query.trim().toLowerCase();
  const shown = rows
    .filter(r => (fullName(r.student) + ' ' + r.student.intra_username).toLowerCase().includes(q))
    .filter(r => filter === 'all' || (filter === 'look' ? r.weight > 0 : filter === 'none' ? r.p && r.p.submitted === 0 : r.p && r.p.submitted > 0 && r.p.submitted < min))
    .sort((a, b) => sort === 'name' ? fullName(a.student).localeCompare(fullName(b.student))
      : sort === 'rating' ? (a.rating ?? 9) - (b.rating ?? 9)
      : sort === 'votes' ? (a.p?.submitted ?? -1) - (b.p?.submitted ?? -1)
      : b.weight - a.weight || fullName(a.student).localeCompare(fullName(b.student)));
  const size = 20, pages = Math.max(1, Math.ceil(shown.length / size)), safePage = Math.min(page, pages);
  const rosterSize = inWindow.size, voted = [...inWindow.values()].filter(p => p.submitted > 0).length;
  const pct = rosterSize ? Math.round(voted / rosterSize * 100) : 0;
  const header = (key, label) => <th aria-sort={sort === key ? 'ascending' : undefined}><button className="th-sort" onClick={() => set({sort: key, page: 1})}>{label}{sort === key && <span aria-hidden="true"> ↓</span>}</button></th>;

  return <section className="panel roster">
    <div className="roster-head">
      <div>
        <h2>Roster</h2>
        <p>{rows.length} active students{w ? ` · ${rosterSize} in ${w.name}` : ''}</p>
      </div>
      {w && <div className="roster-participation" aria-label={`${pct}% of ${w.name}'s roster have voted`}>
        <strong>{pct}<small>%</small></strong>
        <div><span>have voted in {w.name}</span><div className="participation-track"><i style={{width: `${pct}%`}}/></div><small>{voted} of {rosterSize} · target {min} vote{min === 1 ? '' : 's'}</small></div>
      </div>}
    </div>
    <div className="table-toolbar roster-toolbar">
      <Search value={query} onChange={value => set({query: value, page: 1})} label="Search students" placeholder="Search name or username"/>
      <Tabs label="Show" value={filter} onChange={value => set({filter: value, page: 1})} options={[
        ['all', `Everyone · ${counts.all}`], ['look', `Needs a look · ${counts.look}`], ['none', `Haven’t voted · ${counts.none}`], ['below', `Below target · ${counts.below}`]]}/>
    </div>
    {shown.length ? <>
      <div className="table-scroll"><table className="roster-table">
        <thead><tr>{header('name', 'Student')}{header('rating', 'Rating')}{header('votes', w ? `${w.name} votes` : 'Votes')}{header('look', 'Indicators')}</tr></thead>
        <tbody>{shown.slice((safePage - 1) * size, safePage * size).map(r => <tr key={r.student.id} data-student-id={r.student.id} className="row-link" onClick={() => goStudent(r.student.id)}>
          <td><button className="row-open" onClick={e => { e.stopPropagation(); goStudent(r.student.id); }}><Person id={r.student.id} clickable={false}/></button></td>
          <td className="num">{r.rating === null ? <span className="muted">—</span> : <><b>{r.rating.toFixed(2)}</b><span className="muted"> / 3</span></>}</td>
          <td>{!r.p ? <span className="muted">Not in this window</span> : <span className="votes-cell">
            <b>{r.p.submitted}</b><span className="muted"> of {max}</span>
            {min > 0 && <Badge tone={r.p.submitted >= min ? 'green' : r.p.submitted === 0 ? '' : 'amber'}>{r.p.submitted >= min ? 'target met' : r.p.submitted === 0 ? 'not voted' : `${min - r.p.submitted} below target`}</Badge>}
          </span>}</td>
          <td><div className="signals">{r.signals.length ? r.signals.map((x, i) => <span key={i} className={`signal signal-${x.kind}`}>{x.text}</span>) : <span className="muted">—</span>}</div></td>
        </tr>)}</tbody>
      </table></div>
      <PageControls page={safePage} setPage={value => set({page: value})} total={shown.length} size={size}/>
    </> : <Empty>No students match these filters.</Empty>}
    <p className="panel-note">Indicators count different people, not repeated labels, and only counted ratings. They are reasons to look, not verdicts. The vote minimum is a participation target.</p>
  </section>;
}

export function StudentRecord({id}) {
  const {db, windowId, openCase, recordDirection: direction, setRecordDirection: setDirection} = useStaff();
  const [dimension, setDimension] = useState(null);
  useEffect(() => setDimension(null), [id]);
  const student = db.students.find(student => student.id === id);
  if (!student) return <section className="panel"><Empty>This student record could not be found.</Empty></section>;
  const w = db.windows.find(window => window.id === windowId);
  const info = studentInsights(db, id);
  const signals = indicators(db, id, windowId);
  const picked = dimension && info.dimensions.find(d => d.dimension === dimension);
  const history = db.ratings
    .filter(r => direction === 'received' ? r.recipient_id === id : r.voter_id === id)
    .filter(r => !picked || direction !== 'received' || picked.ratingIds.includes(r.id))
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  const targets = db.windows.filter(win => win.roster?.includes(id) && win.min_votes > 0);
  const metTarget = targets.filter(win => db.ratings.filter(r => r.window_id === win.id && r.voter_id === id).length >= win.min_votes).length;
  const givenTotal = info.given.total || 1;

  return <div className="record">
    <section className="panel record-summary">
      <div className="record-who">
        <Avatar student={student}/>
        <div><h2>{fullName(student)}</h2><p className="mono">{student.intra_username}</p>{!student.approved_at && <Badge tone="amber">Awaiting approval</Badge>}</div>
      </div>
      <div className="record-rating">
        <span className="record-label">Overall rating</span>
        <strong>{info.average === null ? '—' : info.average.toFixed(2)}<small> / 3</small></strong>
        <p>{info.received ? `${info.received} rating${info.received === 1 ? '' : 's'} from ${info.raters} ${info.raters === 1 ? 'person' : 'people'}` : 'No counted ratings yet'}</p>
      </div>
      <div className="record-trend" aria-label="Rating by window">
        <span className="record-label">Average per window</span>
        <div className="trend-bars">{info.perWindow.map(p => <div key={p.window.id} className={'trend-col' + (p.window.id === windowId ? ' selected' : '') + (stateOfWindow(p.window) === 'Open' ? ' open' : '')} title={`${p.window.name}: ${p.average === null ? 'no ratings' : p.average.toFixed(2)} (${p.count} ratings)`}>
          <span className="trend-value">{p.average === null ? '–' : p.average.toFixed(1)}</span>
          <i style={{height: p.average === null ? 2 : 6 + (p.average - 1) / 2 * 40}}/>
          <span className="trend-name">{p.window.name.replace(/^Window\s*/i, 'W')}{stateOfWindow(p.window) === 'Open' && <em>open</em>}</span>
        </div>)}</div>
      </div>
      <div className="record-stars">
        <span className="record-label">Stars received</span>
        {info.stars.map(x => <div key={x.stars} className="star-row"><span>{x.stars}★</span><div className="star-track"><i style={{width: `${info.received ? x.count / info.received * 100 : 0}%`}}/></div><b>{x.count}</b></div>)}
      </div>
    </section>

    {signals.filter(x => x.kind !== 'case').length > 0 && <section className="record-signals">
      {signals.filter(x => x.kind !== 'case').map((x, i) => <span key={i} className={`signal signal-${x.kind}`}>{x.text}</span>)}
    </section>}

    {info.cases.length > 0 && <section className="panel record-cases">
      <PanelHeading title="Abuse cases" description={`${info.cases.filter(c => c.status === 'open').length} open · ${info.cases.filter(c => c.status !== 'open').length} decided`}/>
      <ul className="record-case-list">
        {[...info.cases].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.detected_at.localeCompare(a.detected_at)).map(c => {
          const role = c.roles?.[id];
          const side = role === 'target' ? 'About votes they received' : role === 'voter' ? 'About votes they gave' : 'Involved';
          return <li key={c.id}><button className="record-case" onClick={() => openCase(c.id)}>
            <span className="pattern-chip">{c.findings[0]?.mechanism}</span>
            <span className="record-case-title">{c.title}</span>
            <span className="record-case-side">{side}</span>
            <span className={'record-case-status ' + c.status}>{c.status === 'open' ? 'Needs a decision' : c.status === 'confirmed' ? 'Votes excluded' : 'Dismissed'}</span>
            <Icon name="arrow" size={15}/>
          </button></li>;
        })}
      </ul>
    </section>}

    <section className="panel record-dimensions">
      <PanelHeading title="How peers describe them" description="Labels received across all windows, grouped by what they describe. Select a row to see those ratings below."/>
      {info.dimensions.some(d => d.positive + d.negative) ? <div className="dimension-list" role="list">
        {info.dimensions.map(d => {
          const labels = info.labels.filter(l => dimensionOf(l.label) === d.dimension);
          const empty = !d.positive && !d.negative;
          return <button key={d.dimension} role="listitem" className={'dimension-item' + (dimension === d.dimension ? ' active' : '')} disabled={empty} aria-pressed={dimension === d.dimension} onClick={() => { setDirection('received'); setDimension(dimension === d.dimension ? null : d.dimension); }}>
            <span className="dimension-name">{d.dimension}</span>
            <span className="dimension-labels">{empty ? <span className="muted">Not mentioned yet</span> : labels.map(l => <span key={l.label.id} className={`label-chip tone-${l.tone}`}>{l.label.name}<b>{l.people === 1 ? '1 person' : `${l.people} people`}</b></span>)}</span>
          </button>;
        })}
      </div> : <Empty>No labels received yet.</Empty>}
    </section>

    <section className="panel record-history">
      <PanelHeading title="Rating history" description="All voting windows, newest first.">
        <Tabs label="Rating direction" value={direction} onChange={value => { setDirection(value); setDimension(null); }} options={[["received", "Received"], ["given", "Given"]]}/>
      </PanelHeading>
      {picked && direction === 'received' && <div className="history-filter"><span>Showing ratings with <b>{picked.dimension}</b> labels</span><button className="text-button" onClick={() => setDimension(null)}>Show all</button></div>}
      <RatingTable rows={history} studentDirection={direction} showWindow pageSize={6}/>
    </section>

    <section className="panel record-voter">
      <PanelHeading title="As a voter"/>
      <div className="voter-facts">
        <div><span className="record-label">Ratings given</span><strong>{info.given.total}</strong></div>
        <div><span className="record-label">Stars given</span><div className="given-split">{info.given.stars.map(x => <span key={x.stars}><b>{x.stars}★</b> {Math.round(x.count / givenTotal * 100)}%</span>)}</div></div>
        <div><span className="record-label">Met the vote target</span><strong>{metTarget}<small> of {targets.length} window{targets.length === 1 ? '' : 's'}</small></strong></div>
      </div>
    </section>
  </div>;
}

function RatingStatusFilter() {
  const {explorerFilters,setExplorerFilters,setRatingBrowseState}=useStaff();
  return <div className="ratings-status-control"><label><span>Status</span><select aria-label="Filter by rating status" value={explorerFilters.state||''} onChange={event=>{setExplorerFilters({state:event.target.value});setRatingBrowseState(state=>({...state,groupPage:1}));}}><option value="">All statuses</option><option value="counted">Counted</option><option value="invalidated">Invalidated</option></select></label></div>;
}

export function Explorer() {
  const {db,windowId,explorerFilters,setExplorerFilters,exportRows,ratingBrowseState,setRatingBrowseState,goRatingGroup}=useStaff();
  const {category,selectedGroup,studentQuery,groupPage}=ratingBrowseState;
  const status=explorerFilters.state||'';
  const statusRows=filterRatings(db,windowId,{state:status});
  const rows=category==='student'?searchReceivedRatings(db,statusRows,studentQuery):statusRows;
  const groups=groupsFor(db,rows,category).filter(group=>!selectedGroup||group.id===selectedGroup);
  if(category==='stars')groups.sort((a,b)=>Number(b.id)-Number(a.id));
  const valueOptions=category==='student'?[]:
    category==='stars'?[3,2,1].map(stars=>({id:String(stars),name:`${stars} ${stars===1?'star':'stars'}`})):
    [...db.labels.map(label=>({id:label.id,name:label.name+(label.active?'':' (inactive)')})),{id:'none',name:'No labels'}];
  const shown=[...(selectedGroup?groups.flatMap(group=>group.rows):rows)].sort((a,b)=>b.submitted_at.localeCompare(a.submitted_at));
  const valid=shown.filter(counted).length;
  const categoryLabels={student:'student',stars:'star',label:'label'};
  const titles={student:'Students receiving ratings',stars:'Ratings by stars',label:'Labels received'};
  const groupPageSize=10;
  const safeGroupPage=Math.min(groupPage,Math.max(1,Math.ceil(groups.length/groupPageSize)));
  const visibleGroups=groups.slice((safeGroupPage-1)*groupPageSize,safeGroupPage*groupPageSize);
  const hasFilters=Boolean(status||selectedGroup||(category==='student'&&studentQuery.trim()));
  function changeCategory(value){setRatingBrowseState({category:value,selectedGroup:null,studentQuery:'',groupPage:1});}
  function clearFilters(){setExplorerFilters({});setRatingBrowseState(state=>({...state,selectedGroup:null,studentQuery:'',groupPage:1}));}
  function searchStudents(value){setRatingBrowseState(state=>({...state,studentQuery:value,selectedGroup:null,groupPage:1}));}
  return <div className="ratings-explorer">
    <section className="panel ratings-browser" aria-label="Browse ratings">
      <div className="ratings-browser-heading"><h2>Browse ratings</h2><p>Search for a student, or browse ratings by stars and labels.</p></div>
      <div className="ratings-browser-controls">
        <Tabs label="Browse ratings by" value={category} onChange={changeCategory} options={[["student","Student"],["stars","Stars"],["label","Label"]]}/>
        <div className="ratings-browser-filters">
          {category==='student'?<div className="ratings-student-search"><Search label="Search rating recipients" placeholder="Search name or Intra username" value={studentQuery} onChange={searchStudents}/></div>:<label className="ratings-value-filter"><span>{category==='stars'?'Stars':'Label'}</span><select aria-label={`Filter ${categoryLabels[category]} value`} value={selectedGroup||''} onChange={event=>setRatingBrowseState(state=>({...state,selectedGroup:event.target.value||null,groupPage:1}))}><option value="">{category==='stars'?'All stars':'All labels'}</option>{valueOptions.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
          <RatingStatusFilter/>
          {hasFilters&&<button className="text-button ratings-clear-filters" onClick={clearFilters}>Clear filters</button>}
        </div>
      </div>
    </section>
    <section className="panel ratings-results" aria-label="Rating results">
      <div className="ratings-results-heading">
        <div className="ratings-result-title"><h2>{titles[category]}</h2><p role="status">{category==='student'&&<>{groups.length} {groups.length===1?'student':'students'} <span>·</span> </>}{shown.length} submitted <span>·</span> {valid} counted <span>·</span> {shown.length-valid} invalidated</p></div>
        <button className="button ratings-export" disabled={!shown.length} title="Export all ratings matching the search and filters" onClick={()=>exportRows(shown)}><Icon name="download" size={17}/>Export results</button>
      </div>
      {!shown.length?<div className="ratings-no-results"><Empty>{hasFilters?'No ratings match your search or filters in the selected window.':'No ratings have been submitted in this window.'}</Empty>{hasFilters&&<button className="button" onClick={clearFilters}>Clear filters</button>}</div>:
        <><div className="table-scroll ratings-group-table"><table><thead><tr><th>{category==='label'?'Label':category==='stars'?'Stars':'Student receiving ratings'}</th><th>Submitted</th><th>Counted</th><th>Invalidated</th><th><span className="sr-only">Open item</span></th></tr></thead><tbody>{visibleGroups.map(group=>{const countedTotal=group.rows.filter(counted).length;return <tr key={group.id}><td><button className="rating-group-name" onClick={()=>goRatingGroup(category,group.id)}>{category==='student'?<Person id={group.id} clickable={false}/>:group.name}</button></td><td>{group.rows.length}</td><td>{countedTotal}</td><td>{group.rows.length-countedTotal}</td><td><button className="text-button" data-rating-group={category+'/'+group.id} aria-label={`View ratings for ${group.name}`} onClick={()=>goRatingGroup(category,group.id)}>View ratings <Icon name="arrow" size={16}/></button></td></tr>;})}</tbody></table></div>{groups.length>groupPageSize&&<PageControls page={safeGroupPage} setPage={page=>setRatingBrowseState(state=>({...state,groupPage:page}))} total={groups.length} size={groupPageSize}/>}{category==='label'&&<p className="ratings-group-note">A rating can have several labels, so label totals can overlap.</p>}{category==='student'&&<p className="ratings-group-note">Each row is a student who received ratings, not the person who submitted them.</p>}</>
      }
    </section>
  </div>;
}

export function RatingGroup() {
  const {db,windowId,selectedRatingGroup,explorerFilters,setExplorerFilters,exportRows}=useStaff();
  const {category,id}=selectedRatingGroup||{};
  const exists=category==='student'?db.students.some(student=>student.id===id):category==='stars'?['1','2','3'].includes(id):category==='label'&&(id==='none'||db.labels.some(label=>label.id===id));
  const rows=exists?(groupsFor(db,filterRatings(db,windowId,{state:explorerFilters.state||''}),category).find(group=>group.id===id)?.rows||[]):[];
  const shown=[...rows].sort((a,b)=>b.submitted_at.localeCompare(a.submitted_at));
  const valid=shown.filter(counted).length;
  return <section className="panel ratings-results ratings-detail" aria-label="Selected ratings">
    <div className="ratings-results-heading">
      <div className="ratings-result-title"><h2>Rating history</h2><p role="status">{shown.length} submitted <span>·</span> {valid} counted <span>·</span> {shown.length-valid} invalidated</p></div>
      <div className="ratings-detail-actions"><RatingStatusFilter/><button className="button ratings-export" disabled={!shown.length} title="Export the ratings shown for this item" onClick={()=>exportRows(shown)}><Icon name="download" size={17}/>Export results</button></div>
    </div>
    {shown.length?<RatingTable rows={shown} studentDirection={category==='student'?'received':null}/>:<div className="ratings-no-results"><Empty>{!exists?'This item could not be found.':explorerFilters.state?'No ratings match this status in the selected voting window.':'No ratings for this item in the selected voting window.'}</Empty>{exists&&explorerFilters.state&&<button className="button" onClick={()=>setExplorerFilters({})}>Show all statuses</button>}</div>}
  </section>;
}

