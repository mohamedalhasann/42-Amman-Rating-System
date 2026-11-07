import React, {useEffect, useState} from 'react';
import {useStaff} from './context';
import {activitySeries, average, counted, filterRatings, fullName, groupsFor, participation, ratingsIn, searchReceivedRatings, stateOfWindow, stats} from './model';
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
  const {db, windowId, selectedStudent, goStudent, rosterState, setRosterState} = useStaff();
  const {query,filter,page}=rosterState;
  const setQuery=value=>setRosterState(state=>({...state,query:value,page:1}));
  const setFilter=value=>setRosterState(state=>({...state,filter:value,page:1}));
  const setPage=value=>setRosterState(state=>({...state,page:value}));
  const window=db.windows.find(w=>w.id===windowId), roster=participation(db,windowId);
  const scope=window&&rosterState.scope==='window'?'window':'directory';
  const directory=db.students.filter(student=>student.active&&(fullName(student)+' '+student.intra_username).toLowerCase().includes(query.trim().toLowerCase()));
  const matches=roster.filter(person=>(fullName(person.student)+' '+person.student.intra_username).toLowerCase().includes(query.trim().toLowerCase())&&(filter==='all'||(filter==='rated'?person.submitted>0:person.submitted===0)));
  const previousWindow=React.useRef(windowId);
  useEffect(()=>{if(previousWindow.current!==windowId){setRosterState(state=>({...state,page:1}));previousWindow.current=windowId;}},[windowId,setRosterState]);
  const safePage=Math.min(page,Math.max(1,Math.ceil(matches.length/8)));
  return <><div className="student-scope"><Tabs label="Student view" value={scope} onChange={scope=>setRosterState(state=>({...state,scope,page:1}))} options={window?[["directory","Student directory"],["window","Window participation"]]:[["directory","Student directory"]]}/></div>{scope==='directory'?<section className="panel student-roster">
    <PanelHeading title="Student directory" description="Active 42cursus students from the imported campus roster."><span className="roster-total">{db.students.filter(student=>student.active).length} students</span></PanelHeading>
    <div className="table-toolbar"><Search value={query} onChange={setQuery} label="Search students" placeholder="Search name or username"/></div>
    {directory.length?<><div className="table-scroll"><table><thead><tr><th>Student</th><th>Account status</th><th><span className="sr-only">Student record</span></th></tr></thead><tbody>{directory.slice((Math.min(page,Math.ceil(directory.length/8))-1)*8,Math.min(page,Math.ceil(directory.length/8))*8).map(student=><tr key={student.id}><td><Person id={student.id}/></td><td><Badge tone={student.approved_at?'green':student.email_verified_at?'amber':'neutral'}>{student.approved_at?'Approved':student.email_verified_at?'Awaiting approval':'Setup required'}</Badge></td><td><button className="text-button view-record" data-student-id={student.id} onClick={()=>goStudent(student.id)}>View record <Icon name="arrow" size={16}/></button></td></tr>)}</tbody></table></div><PageControls page={Math.min(page,Math.ceil(directory.length/8))} setPage={setPage} total={directory.length}/></>:<Empty>No students match your search.</Empty>}
  </section>:<section className="panel student-roster">
    <PanelHeading title="Window roster" description="Check participation or open a student’s rating record."><span className="roster-total">{roster.length} students</span></PanelHeading>
    <div className="table-toolbar"><Search value={query} onChange={setQuery} label="Search students" placeholder="Search name or username"/><Tabs label="Participation filter" value={filter} onChange={setFilter} options={[["all",`Everyone (${roster.length})`],["rated",`Rated (${roster.filter(person=>person.submitted).length})`],["not",`Not rated (${roster.filter(person=>!person.submitted).length})`]]}/></div>
    {matches.length?<>
      <div className="table-scroll"><table><thead><tr><th>Student</th><th>Votes given</th><th>Votes remaining</th><th>Participation</th><th><span className="sr-only">Student record</span></th></tr></thead><tbody>{matches.slice((safePage-1)*8,safePage*8).map(person=><tr className={selectedStudent===person.student.id?'record-selected':''} key={person.student.id}><td><Person id={person.student.id}/></td><td><span className="vote-count">{person.submitted}</span>{person.counted!==person.submitted&&<small className="block muted">{person.counted} counted</small>}</td><td>{person.remaining}</td><td><div className="participation-cell"><Badge tone={!person.submitted?'neutral':person.submitted>=window.min_votes?'green':'amber'}>{!person.submitted?'Not rated':person.submitted>=window.min_votes?'Target met':`${window.min_votes-person.submitted} below target`}</Badge><small>{person.submitted} / {window.min_votes} target</small></div></td><td><button className="text-button view-record" data-student-id={person.student.id} aria-label={`View record for ${fullName(person.student)}`} onClick={()=>goStudent(person.student.id)}>View record <Icon name="arrow" size={16}/></button></td></tr>)}</tbody></table></div>
      <PageControls page={safePage} setPage={setPage} total={matches.length}/>
    </>:<Empty>{roster.length?'No students match these filters.':window.roster_captured_at?'No approved students were eligible when this window opened.':'The participation roster will be captured when this window opens.'}</Empty>}
    <p className="panel-note">The minimum is a participation target. Invalidated votes still use voting allowance.</p>
  </section>}</>;
}

export function StudentRecord({id}) {
  const {db,windowId,recordDirection:direction,setRecordDirection:setDirection,recordScope:scope,setRecordScope:setScope}=useStaff();
  const student=db.students.find(student=>student.id===id);
  if(!student)return <section className="panel"><Empty>This student record could not be found.</Empty></section>;
  const window=db.windows.find(window=>window.id===windowId);
  const rows=db.ratings.filter(r=>(scope==='all'||r.window_id===windowId)&&(direction==='received'?r.recipient_id===id:r.voter_id===id));
  const received=db.ratings.filter(r=>r.recipient_id===id&&(scope==='all'||r.window_id===windowId));
  const labelGroups=groupsFor(db,received,'label').filter(group=>group.id!=='none');
  return <div className="routed-student-record">
    {window&&<div className="student-record-context"><span>{window.name}</span><span>{shortDate(window.starts_at)} – {shortDate(window.ends_at)}</span></div>}
    <section className="student-record-summary">
      <div className="record-heading">
        <div className="record-identity"><Avatar student={student}/><div><h2>{fullName(student)}</h2><p>{student.intra_username}</p></div></div>
        <Badge tone={student.approved_at?'green':'amber'}>{student.approved_at?'Approved':'Awaiting approval'}</Badge>
      </div>
      <div className="record-metrics">
        <div><span>Overall average</span><strong>{displayAverage(average(db,id))}<small> / 3</small></strong><p>All voting windows</p></div>
        <div><span>Window average</span><strong>{window?displayAverage(average(db,id,windowId)):'—'}<small> / 3</small></strong><p>{window?.name||'No voting window'}</p></div>
        <div><span>Ratings given</span><strong>{ratingsIn(db,windowId).filter(r=>r.voter_id===id).length}</strong><p>{window?.name||'No voting window'}</p></div>
      </div>
    </section>
    <section className="panel record-history">
      <PanelHeading title="Rating history"><select aria-label="Student rating scope" value={scope} onChange={event=>setScope(event.target.value)}><option value="window">Selected window</option><option value="all">All windows</option></select></PanelHeading>
      <div className="inner-tabs"><Tabs label="Rating direction" value={direction} onChange={setDirection} options={[["received","Received"],["given","Given"]]}/><span className="muted">{rows.length} {rows.length===1?'rating':'ratings'}</span></div>
      <RatingTable rows={[...rows].sort((a,b)=>b.submitted_at.localeCompare(a.submitted_at))} studentDirection={direction} showWindow={scope==='all'} pageSize={5}/>
    </section>
    <section className="record-label-section"><PanelHeading title="Labels received" description={scope==='all'?'Across all voting windows':window?.name}/><div className="received-labels">{labelGroups.map(group=>{const valid=group.rows.filter(counted).length;return <span key={group.id}>{group.name}<b>{valid===group.rows.length?valid+' '+(valid===1?'rating':'ratings'):valid+' counted · '+(group.rows.length-valid)+' invalidated'}</b></span>;})}{!labelGroups.length&&<p className="muted">No received labels in this scope.</p>}</div></section>
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

export function AbuseReview() {
  const {db,windowId,openCase,reviewInboxState,setReviewInboxState}=useStaff();
  const {status,mechanism,scope,query,page}=reviewInboxState;
  const update=(key,value)=>setReviewInboxState(state=>({...state,[key]:value,...(key==='page'?{}:{page:1})}));
  const mechanisms=[...new Set(db.cases.flatMap(c=>c.findings.map(f=>f.mechanism)))];
  const cases=db.cases.filter(c=>(scope==='all'||c.window_id===windowId)&&(!status||c.status===status)&&(!mechanism||c.findings.some(f=>f.mechanism===mechanism))&&(c.title+' '+c.student_ids.map(id=>{const s=db.students.find(s=>s.id===id);return fullName(s)+' '+s.intra_username}).join(' ')).toLowerCase().includes(query.toLowerCase()));
  const safePage=Math.min(page,Math.max(1,Math.ceil(cases.length/6)));
  const openCount=db.cases.filter(c=>c.status==='open').length;
  const people = c => {
    const names=c.student_ids.map(id=>fullName(db.students.find(s=>s.id===id)));
    return names.length<3?names.join(' & '):`${names.slice(0,2).join(' & ')} +${names.length-2} more`;
  };
  return <section className="panel review-inbox">
    <PanelHeading title="Review queue" description="Review suspicious activity, then decide whether any linked ratings need to be excluded.">
      <div className="review-heading-state"><Badge tone={openCount?'amber':'green'}>{openCount} awaiting review</Badge><label><span>Show cases from</span><select aria-label="Case window scope" value={scope} onChange={e=>update('scope',e.target.value)}><option value="all">All voting windows</option><option value="window">Selected window</option></select></label></div>
    </PanelHeading>
    <div className="review-filters">
      <Search value={query} onChange={value=>update('query',value)} label="Search abuse cases" placeholder="Search case or student"/>
      <div className="review-filter-selects"><label><span>Pattern</span><select aria-label="Case mechanism" value={mechanism} onChange={e=>update('mechanism',e.target.value)}><option value="">Every pattern</option>{mechanisms.map(m=><option key={m}>{m}</option>)}</select></label><label><span>Decision status</span><select aria-label="Case status" value={status} onChange={e=>update('status',e.target.value)}><option value="open">Needs review</option><option value="confirmed">Abuse confirmed</option><option value="dismissed">Dismissed</option><option value="">All statuses</option></select></label></div>
    </div>
    <div className="case-list">
      {cases.slice((safePage-1)*6,safePage*6).map(c=><button key={c.id} data-case-id={c.id} className="case-item" onClick={()=>openCase(c.id)}>
        <div className="case-item-top"><span className="case-id">{c.findings.map(f=>f.mechanism).join(' · ')}</span>{c.status!=='open'&&<Badge tone={c.status==='confirmed'?'red':'neutral'}>{c.status==='confirmed'?'Abuse confirmed':'Dismissed'}</Badge>}<time dateTime={c.detected_at}>Flagged {dateTime(c.detected_at)} · Amman</time></div>
        <div className="case-item-body"><div><h3>{c.title}</h3><p className="case-explanation-preview">{c.findings.map(f=>f.explanation).join(' ')}</p><p className="case-people-preview"><span>Involves</span> {people(c)}</p><div className="case-facts"><span>{c.findings.length} {c.findings.length===1?'pattern':'patterns'} matched</span><span>{c.rating_ids.length} linked {c.rating_ids.length===1?'rating':'ratings'}</span>{c.attempt_ids.length>0&&<span>{c.attempt_ids.length} blocked {c.attempt_ids.length===1?'attempt':'attempts'}</span>}</div></div><span className="case-open">Review case <Icon name="arrow" size={17}/></span></div>
      </button>)}
      {!cases.length&&<Empty>No cases match these filters.</Empty>}
    </div>
    {cases.length>0&&<PageControls page={safePage} setPage={value=>update('page',value)} total={cases.length} size={6}/>} 
  </section>;
}
