import React, {useState} from 'react';
import {useStaff} from './context';
import {counted, fullName} from './model';
import {Badge, dateTime, Empty, Icon, Modal, PageControls, Person, RatingLabels, RatingStars, Tabs} from './components';
import './case-review.css';

export function CaseDetail({id}) {
  const {db,dispatch,notify,go}=useStaff();
  const [tab,setTab]=useState('ratings'),[page,setPage]=useState(1);
  const [selected,setSelected]=useState([]),[dialog,setDialog]=useState(null);
  const [reason,setReason]=useState(''),[error,setError]=useState('');
  const c=db.cases.find(item=>item.id===id);
  if(!c)return <section className="panel case-missing"><Empty>This case could not be found.</Empty><button className="button" onClick={()=>go('review')}>Return to review inbox</button></section>;
  const ratings=db.ratings.filter(r=>c.rating_ids.includes(r.id)).sort((a,b)=>a.submitted_at.localeCompare(b.submitted_at));
  const attempts=db.attempts.filter(a=>c.attempt_ids.includes(a.id)&&!a.is_retry).sort((a,b)=>a.attempted_at.localeCompare(b.attempted_at));
  const people=[...new Set([...c.student_ids,...ratings.flatMap(r=>[r.voter_id,r.recipient_id]),...attempts.flatMap(a=>[a.voter_id,a.recipient_id])])];
  const selectedIds=selected.filter(id=>ratings.some(r=>r.id===id&&counted(r)));
  const valid=ratings.filter(counted).length;
  const canResolve=c.status!=='dismissed'&&!c.resolved_at;
  const entries=tab==='ratings'?ratings:tab==='attempts'?attempts:people;
  const safePage=Math.min(page,Math.max(1,Math.ceil(entries.length/6)));
  const windowName=id=>db.windows.find(w=>w.id===id)?.name||'Unknown window';
  const name=id=>fullName(db.students.find(s=>s.id===id));
  function openDialog(value){setDialog(value);setReason('');setError('');}
  function save(){
    try{
      dispatch({type:'resolve-case',id:c.id,status:dialog==='dismissed'?'dismissed':'confirmed',ids:dialog==='dismissed'?[]:selectedIds,reason});
      setDialog(null);setSelected([]);
      if(dialog==='confirmed'){setTab('ratings');setPage(1);}
      notify(dialog==='dismissed'?'Case dismissed. Ratings are unchanged.':'Case closed. Selected ratings excluded and scores updated.');
    }catch(e){setError(e.message);}
  }
  return <div className="investigation">
    <div className="investigation-toolbar"><div><Icon name="clock" size={16}/><span>Flagged {dateTime(c.detected_at)} · Amman</span><span>·</span><span>{windowName(c.window_id)}</span></div>{canResolve&&<button className="button primary" onClick={()=>openDialog(selectedIds.length||!valid?'confirmed':'dismissed')}>Resolve case <Icon name="arrow" size={16}/></button>}</div>
    <section className="investigation-summary" aria-labelledby="investigation-summary-title"><div className="investigation-summary-icon"><Icon name="flag" size={22}/></div><div><h2 id="investigation-summary-title">Why this was flagged</h2>{c.findings.map(f=><div className="investigation-finding" key={f.mechanism}><span>{f.mechanism}</span><p>{f.explanation}</p></div>)}<p className="investigation-caution">A flagged pattern is a reason to investigate. It does not establish misconduct.</p></div></section>
    {c.review&&<section className={`investigation-decision ${c.status}`} aria-label="Recorded staff decision"><Icon name={c.status==='dismissed'?'check':'flag'} size={20}/><div><h2>{c.status==='dismissed'?'Case dismissed':'Abuse confirmed'}</h2><p>{c.review.reason}</p><small>{c.review.by} · {dateTime(c.review.at)} · Amman</small></div><span>{ratings.length-valid} of {ratings.length} ratings excluded</span></section>}
    <section className="investigation-evidence" aria-label="Case evidence">
      <div className="investigation-evidence-heading"><div><h2>Case evidence</h2><p>Follow the sequence and compare the students’ reports.</p></div><span>{valid} counted · {ratings.length-valid} excluded</span></div>
      <div className="investigation-tabs"><Tabs label="Case evidence" value={tab} onChange={value=>{setTab(value);setPage(1);}} options={[["ratings",`Ratings (${ratings.length})`],["attempts",`Blocked attempts (${attempts.length})`],["people",`Students (${people.length})`]]}/><span><Icon name="clock" size={14}/>{tab==='people'?'Involved students':'Oldest first'}</span></div>
      {canResolve&&valid>0&&tab==='ratings'&&<div className="investigation-selection"><div><strong>Select any ratings you found abusive</strong><p>Resolve the case once: exclude your selection, or dismiss without changing ratings.</p></div><span>{selectedIds.length} selected</span></div>}
      {tab==='ratings'&&<div className="evidence-timeline">{ratings.slice((safePage-1)*6,safePage*6).map((r,index)=><article className={`evidence-entry ${selectedIds.includes(r.id)?'selected':''}`} key={r.id} aria-label={`Rating ${r.id.toUpperCase()}`}><div className="evidence-marker">{(safePage-1)*6+index+1}</div><div className="evidence-entry-content">
        <div className="evidence-entry-meta"><time dateTime={r.submitted_at}>{dateTime(r.submitted_at)} · Amman</time><span>{windowName(r.window_id)}</span><Badge tone={counted(r)?'green':'neutral'}>{counted(r)?'Counted':'Excluded'}</Badge></div>
        <div className="evidence-relationship"><div><span>Rated by</span><Person id={r.voter_id}/></div><Icon name="arrow" size={20}/><div><span>Received by</span><Person id={r.recipient_id}/></div><div className="evidence-score"><RatingStars stars={r.stars}/><span>{r.stars} / 3</span></div></div>
        <div className="evidence-report"><div><span>Labels</span><RatingLabels rating={r}/></div><div><span>Student’s explanation</span><p className={!r.explanation?'evidence-no-explanation':''}>{r.explanation||'No explanation provided.'}</p></div></div>
        <div className="evidence-entry-footer"><span>Rating {r.id.toUpperCase()}</span>{canResolve&&counted(r)&&<label><input type="checkbox" aria-label={`Select rating ${r.id.toUpperCase()}`} checked={selectedIds.includes(r.id)} onChange={()=>setSelected(ids=>ids.includes(r.id)?ids.filter(id=>id!==r.id):[...ids,r.id])}/>Select as abusive</label>}</div>
        {r.invalidation&&<details className="evidence-exclusion"><summary>Exclusion reason</summary><p>{r.invalidation.reason}</p><small>{r.invalidation.by} · {dateTime(r.invalidation.at)} · Amman</small></details>}
      </div></article>)}</div>}
      {tab==='attempts'&&<div className="investigation-attempts"><p>Stopped before a rating was created. These attempts do not affect scores or votes remaining.</p>{attempts.slice((safePage-1)*6,safePage*6).map(a=><article key={a.id}><Badge>Blocked</Badge><div><p><strong>{name(a.voter_id)}</strong> tried to rate <strong>{name(a.recipient_id)}</strong></p><p>{a.reason}</p><small>{dateTime(a.attempted_at)} · Amman · {windowName(a.window_id)}</small></div></article>)}</div>}
      {tab==='people'&&<div className="investigation-people">{people.slice((safePage-1)*6,safePage*6).map(id=><div key={id}><Person id={id}/><span>{ratings.filter(r=>r.voter_id===id).length} given · {ratings.filter(r=>r.recipient_id===id).length} received{attempts.some(a=>a.voter_id===id)&&' · attempted to rate'}{attempts.some(a=>a.recipient_id===id)&&' · received attempts'}</span></div>)}</div>}
      {!entries.length&&<Empty>{tab==='ratings'?'No accepted ratings are linked to this case.':'No blocked attempts are linked to this case.'}</Empty>}
      {entries.length>6&&<PageControls page={safePage} setPage={setPage} total={entries.length} size={6}/>}
    </section>
    {canResolve&&<div className="investigation-bottom"><div><strong>{selectedIds.length?`${selectedIds.length} ratings selected for exclusion`:'Finished reviewing the evidence?'}</strong><p>One decision closes the case and applies any exclusions.</p></div><button className="button primary" onClick={()=>openDialog(selectedIds.length||!valid?'confirmed':'dismissed')}>Resolve case <Icon name="arrow" size={16}/></button></div>}
    {dialog&&<Modal title="Resolve case" onClose={()=>setDialog(null)} className="investigation-dialog">
      <p>Choose the outcome and add one reason. Everything is saved together.</p><div className="investigation-outcome-options">{[['confirmed',valid?'Exclude selected & close':'Confirm abuse & close',valid?`${selectedIds.length} selected ratings will stop counting toward scores.`:'Close this case without changing any scores.'],['dismissed','Dismiss case','Close without changing any ratings.']].map(([value,title,description])=><label key={value} className={dialog===value?'chosen':''}><input type="radio" name="case-outcome" checked={dialog===value} onChange={()=>{setDialog(value);setError('');}}/><span><strong>{title}</strong><small>{description}</small></span></label>)}</div>
      {dialog==='confirmed'&&valid>0&&!selectedIds.length&&<p className="form-error">Select the abusive ratings in the evidence first, or choose Dismiss case.</p>}
      {dialog==='confirmed'&&selectedIds.length>0&&<ul className="investigation-exclusion-list">{ratings.filter(r=>selectedIds.includes(r.id)).map(r=><li key={r.id}><span>{name(r.voter_id)} → {name(r.recipient_id)}</span><RatingStars stars={r.stars}/></li>)}</ul>}
      <label className="investigation-reason" htmlFor="investigation-reason">Decision reason <span>Required</span><textarea id="investigation-reason" rows={4} value={reason} onChange={e=>{setReason(e.target.value);setError('');}} placeholder="Describe what you found in the evidence."/></label>
      <p className="investigation-dialog-note">{dialog==='confirmed'?'Closing confirms abuse and excludes only the listed ratings. Your reason and the original records are retained. Voting allowance stays unchanged.':'No ratings will change, including any you selected. Your reason will be saved.'}</p>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="button" onClick={()=>setDialog(null)}>Cancel</button><button className={`button ${dialog==='confirmed'?'danger':'primary'}`} disabled={!reason.trim()||(dialog==='confirmed'&&valid>0&&!selectedIds.length)} onClick={save}>{dialog==='dismissed'?'Dismiss case':valid?'Exclude selected & close case':'Confirm abuse & close case'}</button></div>
    </Modal>}
  </div>;
}
