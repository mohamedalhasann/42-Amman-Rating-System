import React, {useState} from 'react';
import {useStaff} from './context';
import {counted, fullName} from './model';
import {Badge, dateTime, Empty, Icon, Modal, PageControls, Person, RatingLabels, RatingStars} from './components';

function jumpTo(id) {
  const heading=document.getElementById(id);
  heading?.focus({preventScroll:true});
  heading?.scrollIntoView({block:'start',behavior:'instant'});
}

function CaseRating({rating,canSelect,selected,onSelect}) {
  const {db}=useStaff();
  return <article className={'case-rating'+(selected?' is-selected':'')} aria-label={`Rating ${rating.id.toUpperCase()}`}>
    <div className="case-rating-top">
      <div className="case-rating-value"><RatingStars stars={rating.stars}/><RatingLabels rating={rating}/></div>
      <Badge tone={counted(rating)?'green':'red'}>{counted(rating)?'Counted':'Excluded'}</Badge>
    </div>
    <div className="case-rating-people"><div><span>Rated by</span><Person id={rating.voter_id}/></div><Icon name="arrow" size={18}/><div><span>Received by</span><Person id={rating.recipient_id}/></div></div>
    <div className="case-explanation"><span>Student’s explanation</span><p>{rating.explanation||'No explanation was provided.'}</p></div>
    <div className="case-rating-meta"><span>{rating.id.toUpperCase()}</span><time dateTime={rating.submitted_at}>{dateTime(rating.submitted_at)} · Amman</time><span>{db.windows.find(window=>window.id===rating.window_id)?.name||'Unknown window'}</span></div>
    {rating.invalidation&&<details className="case-exclusion-detail"><summary>Why this rating was excluded</summary><p>{rating.invalidation.reason}</p><small>{rating.invalidation.by} · {dateTime(rating.invalidation.at)} · Amman</small></details>}
    {canSelect&&counted(rating)&&<label className="case-rating-select"><input type="checkbox" aria-label={`Select rating ${rating.id.toUpperCase()}`} checked={selected} onChange={onSelect}/>Select for exclusion</label>}
  </article>;
}

export function CaseDetail({id}) {
  const {db,dispatch,notify,go}=useStaff();
  const [reason,setReason]=useState(''),[invalidationReason,setInvalidationReason]=useState('');
  const [selected,setSelected]=useState([]),[confirm,setConfirm]=useState(false),[error,setError]=useState('');
  const [ratingPage,setRatingPage]=useState(1),[attemptPage,setAttemptPage]=useState(1);
  const c=db.cases.find(item=>item.id===id);
  if(!c)return <section className="panel case-missing"><Empty>This case could not be found.</Empty><button className="button" onClick={()=>go('review')}>Return to review inbox</button></section>;
  const rows=db.ratings.filter(rating=>c.rating_ids.includes(rating.id)).sort((a,b)=>a.submitted_at.localeCompare(b.submitted_at));
  const attempts=db.attempts.filter(attempt=>c.attempt_ids.includes(attempt.id)&&!attempt.is_retry).sort((a,b)=>a.attempted_at.localeCompare(b.attempted_at));
  const currentIds=selected.filter(id=>rows.some(rating=>rating.id===id&&counted(rating)));
  const countedTotal=rows.filter(counted).length;
  const studentIds=[...new Set([...c.student_ids,...rows.flatMap(rating=>[rating.voter_id,rating.recipient_id]),...attempts.flatMap(attempt=>[attempt.voter_id,attempt.recipient_id])])];
  const safeRatingPage=Math.min(ratingPage,Math.max(1,Math.ceil(rows.length/6)));
  const safeAttemptPage=Math.min(attemptPage,Math.max(1,Math.ceil(attempts.length/6)));
  function review(status) {
    try {
      dispatch({type:'review',id:c.id,status,reason});setError('');
      notify(status==='confirmed'?'Abuse confirmed. Choose which ratings to exclude.':'Case dismissed. Ratings are unchanged.');
      if(status==='confirmed'&&countedTotal)requestAnimationFrame(()=>jumpTo('case-ratings'));
    }catch(error){setError(error.message);}
  }
  function invalidate() {
    try {
      dispatch({type:'invalidate',caseId:c.id,ids:currentIds,reason:invalidationReason});
      setSelected([]);setConfirm(false);setInvalidationReason('');setError('');
      notify('Selected ratings excluded. Scores and totals have been updated.');
    }catch(error){setConfirm(false);setError(error.message);}
  }
  return <div className="case-review">
    <div className="case-review-main">
      <section className="panel case-summary" aria-labelledby="case-summary-title">
        <h2 id="case-summary-title">Why this needs review</h2>
        <div className="case-findings">{c.findings.map(finding=><div key={finding.mechanism}>
          {c.findings.length>1&&<h3>{finding.mechanism}</h3>}
          <p>{finding.explanation}</p>
        </div>)}</div>
        <p className="case-summary-note">A flagged pattern alone does not prove abuse.</p>
      </section>

      <section className="panel case-evidence" aria-labelledby="case-ratings">
        <div className="case-section-heading"><h2 id="case-ratings" tabIndex={-1}>Ratings involved <span>{rows.length}</span></h2><p>Read what each student submitted, in time order.</p></div>
        {c.status==='confirmed'&&countedTotal>0&&<div className="case-selection-bar"><p>Select only the ratings you confirmed as abusive.</p><button className="text-button" onClick={()=>jumpTo('case-decision')}>{currentIds.length} selected · Continue <Icon name="arrow" size={16}/></button></div>}
        {rows.slice((safeRatingPage-1)*6,safeRatingPage*6).map(rating=><CaseRating key={rating.id} rating={rating} canSelect={c.status==='confirmed'} selected={currentIds.includes(rating.id)} onSelect={()=>setSelected(ids=>ids.includes(rating.id)?ids.filter(id=>id!==rating.id):[...ids,rating.id])}/>)}
        {!rows.length&&<Empty>No submitted ratings are linked to this case.</Empty>}
        {rows.length>6&&<PageControls page={safeRatingPage} setPage={page=>{setRatingPage(page);jumpTo('case-ratings');}} total={rows.length} size={6}/>}
        {c.status==='confirmed'&&countedTotal>0&&<div className="case-selection-footer"><button className="button" disabled={!currentIds.length} onClick={()=>jumpTo('case-decision')}>Continue with {currentIds.length} selected <Icon name="arrow" size={16}/></button></div>}
      </section>

      {attempts.length>0&&<section className="panel case-attempts" aria-labelledby="case-attempts-title">
        <div className="case-section-heading"><h2 id="case-attempts-title">Blocked attempts <span>{attempts.length}</span></h2><p>These attempts were stopped before a rating was created. They do not affect scores or votes remaining.</p></div>
        <ol>{attempts.slice((safeAttemptPage-1)*6,safeAttemptPage*6).map(attempt=><li key={attempt.id}><div><strong>{fullName(db.students.find(student=>student.id===attempt.voter_id))}</strong><span> tried to rate </span><strong>{fullName(db.students.find(student=>student.id===attempt.recipient_id))}</strong></div><p>{attempt.reason}</p><time dateTime={attempt.attempted_at}>{dateTime(attempt.attempted_at)} · Amman</time><span className="case-attempt-window">{db.windows.find(window=>window.id===attempt.window_id)?.name||'Unknown window'}</span></li>)}</ol>
        {attempts.length>6&&<PageControls page={safeAttemptPage} setPage={setAttemptPage} total={attempts.length} size={6}/>}
      </section>}

      <section className="panel case-resolution" aria-labelledby="case-decision">
        <div className="case-section-heading"><h2 id="case-decision" tabIndex={-1}>Staff decision</h2><p>{c.status==='open'?'Decide whether the evidence supports abuse.':c.status==='dismissed'?'This case was dismissed. Ratings are unchanged.':'Abuse was confirmed. Only ratings you explicitly exclude are removed from scores.'}</p></div>
        <div className="case-resolution-body">
          {c.review?<div className="case-saved-decision"><span>{c.status==='confirmed'?'Abuse confirmed':'Case dismissed'}</span><p>{c.review.reason}</p><small>{c.review.by} · {dateTime(c.review.at)} · Amman</small></div>:<form onSubmit={event=>event.preventDefault()}>
            <label htmlFor="case-review-reason">Decision reason <span>Required</span></label>
            <textarea id="case-review-reason" rows="3" value={reason} onChange={event=>{setReason(event.target.value);setError('');}} placeholder="What did you find after reviewing the evidence?" required/>
            <p className="case-action-help">Confirming abuse lets you choose which ratings to exclude next.</p>
            <div className="case-resolution-actions"><button type="button" className="button" disabled={!reason.trim()} onClick={()=>review('dismissed')}>Dismiss case</button><button type="button" className="button primary" disabled={!reason.trim()} onClick={()=>review('confirmed')}>Confirm abuse</button></div>
          </form>}
          {c.status==='confirmed'&&(countedTotal?<div className="case-exclude-form">
            <h3>Exclude abusive ratings</h3>
            <p>{currentIds.length?`${currentIds.length} ${currentIds.length===1?'rating selected':'ratings selected'}. Add a reason to exclude them from scores.`:'Choose the abusive ratings in the list above, then record why they should be excluded.'}</p>
            {!currentIds.length&&<button className="text-button" onClick={()=>jumpTo('case-ratings')}>Choose ratings <Icon name="arrow" size={16}/></button>}
            <label htmlFor="case-exclusion-reason">Reason for excluding ratings <span>Required</span></label>
            <textarea id="case-exclusion-reason" rows="3" value={invalidationReason} onChange={event=>{setInvalidationReason(event.target.value);setError('');}} placeholder="Why should these specific ratings be removed from scores?"/>
            <p className="case-action-help">Original records are kept. Students’ voting allowance stays the same.</p>
            <button className="button danger" disabled={!currentIds.length||!invalidationReason.trim()} onClick={()=>setConfirm(true)}>Review exclusion ({currentIds.length})</button>
          </div>:<p className="case-complete"><Icon name="check" size={18}/>{rows.length?'All linked ratings have been excluded.':'There are no accepted ratings to exclude in this case.'}</p>)}
          {error&&<p className="form-error" role="alert">{error}</p>}
        </div>
      </section>
    </div>

    <aside className="case-context" aria-label="Case context">
      <section className="panel case-context-summary"><h2>Case details</h2><dl><div><dt>Voting window</dt><dd>{db.windows.find(window=>window.id===c.window_id)?.name||'Unknown window'}</dd></div><div><dt>Flagged</dt><dd><time dateTime={c.detected_at}>{dateTime(c.detected_at)}</time><small>Amman time</small></dd></div><div><dt>{c.findings.length===1?'Flagged pattern':'Flagged patterns'}</dt><dd>{c.findings.map(finding=><span key={finding.mechanism}>{finding.mechanism}</span>)}</dd></div><div><dt>Linked ratings</dt><dd>{countedTotal} counted · {rows.length-countedTotal} excluded</dd></div></dl><button className="text-button" onClick={()=>jumpTo('case-decision')}>{c.status==='open'?'Go to decision':'View decision'}<Icon name="arrow" size={16}/></button></section>
      <section className="panel case-people"><h2>Students involved <span>{studentIds.length}</span></h2><ul>{studentIds.map(studentId=>{
        const gave=rows.some(rating=>rating.voter_id===studentId),received=rows.some(rating=>rating.recipient_id===studentId);
        const attempted=attempts.some(attempt=>attempt.voter_id===studentId),targeted=attempts.some(attempt=>attempt.recipient_id===studentId);
        return <li key={studentId}><Person id={studentId}/><span>{gave&&received?'Gave & received ratings':gave?'Voter':received?'Recipient':attempted&&targeted?'Sent & received attempts':attempted?'Attempted to rate':targeted?'Target of an attempt':'Linked student'}</span></li>;
      })}</ul></section>
    </aside>

    {confirm&&<Modal title="Exclude selected ratings?" onClose={()=>setConfirm(false)}>
      <p className="case-confirm-intro">These {currentIds.length} {currentIds.length===1?'rating will':'ratings will'} stop contributing to scores.</p>
      <ul className="case-confirm-list">{rows.filter(rating=>currentIds.includes(rating.id)).map(rating=><li key={rating.id}><strong>{rating.id.toUpperCase()}</strong><span>{fullName(db.students.find(student=>student.id===rating.voter_id))} → {fullName(db.students.find(student=>student.id===rating.recipient_id))}</span><RatingStars stars={rating.stars}/></li>)}</ul>
      <div className="case-confirm-reason"><strong>Reason</strong><p>{invalidationReason}</p></div>
      <p className="case-action-help">Original records and your reason will be saved. Voting allowance stays the same.</p>
      <div className="modal-actions"><button className="button" onClick={()=>setConfirm(false)}>Cancel</button><button className="button danger" disabled={!currentIds.length||!invalidationReason.trim()} onClick={invalidate}>Confirm exclusion</button></div>
    </Modal>}
  </div>;
}
