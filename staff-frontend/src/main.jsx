import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StaffContext} from './context';
import {createData} from './data';
import {applyAction, counted, fullName, ratingsCsv, ratingsIn, stateOfWindow} from './model';
import {Badge, Icon, Modal, RatingDetail, shortDate} from './components';
import {AbuseReview, Explorer, Overview, RatingGroup, StudentRecord, Students} from './screens';
import {CaseDetail} from './case-review';
import {Accounts, AuditLog, Configuration} from './management';
import './fonts.css';
import '../styles.css';
import campusLogo from '../../docs/42-logo.jpeg';

const storageKey='fairly.staff.preview.v3';
const navigation=[['overview','Overview','grid'],['students','Students','people'],['explorer','Ratings','chart'],['review','Abuse review','flag'],['settings','Configuration','settings'],['accounts','Accounts','lock'],['activity','Activity log','clock']];
const routeView = value => /^students\/[^/]+$/.test(value)?'student-record':/^explorer\/(student|stars|label)\/[^/]+$/.test(value)?'rating-group':/^review\/[^/]+$/.test(value)?'case-review':value==='participation'?'students':navigation.some(item=>item[0]===value)?value:'overview';
function routeStudent(value){try{return routeView(value)==='student-record'?decodeURIComponent(value.split('/')[1]):null}catch{return null}}
function routeCase(value){try{return routeView(value)==='case-review'?decodeURIComponent(value.split('/')[1]):null}catch{return null}}
function routeRatingGroup(value){try{const [,category,id]=value.split('/');return routeView(value)==='rating-group'?{category,id:decodeURIComponent(id)}:null}catch{return null}}
function loadData(){try{const value=JSON.parse(localStorage.getItem(storageKey));if(value?.schema===3&&Array.isArray(value.ratings)&&Array.isArray(value.windows)&&value.windows.length)return value;}catch{}return createData();}
function App(){
 const [db,setDb]=useState(loadData),[view,setView]=useState(()=>routeView(location.hash.slice(1)));
 const [windowId,setWindowId]=useState(()=>{try{return localStorage.getItem('fairly.staff.selected-window')||'w7'}catch{return 'w7'}}),[selectedStudent,setSelectedStudent]=useState(()=>routeStudent(location.hash.slice(1))),[explorerFilters,setExplorerFilters]=useState({});
 const [rosterState,setRosterState]=useState({query:'',filter:'all',page:1});
 const [ratingBrowseState,setRatingBrowseState]=useState(()=>({category:routeRatingGroup(location.hash.slice(1))?.category||'student',studentQuery:'',selectedGroup:null,groupPage:1}));
 const [selectedRatingGroup,setSelectedRatingGroup]=useState(()=>routeRatingGroup(location.hash.slice(1)));
 const [reviewInboxState,setReviewInboxState]=useState({status:'open',mechanism:'',scope:'all',query:'',page:1});
 const [caseId,setCaseId]=useState(()=>routeCase(location.hash.slice(1))),[ratingId,setRatingId]=useState(null),[exportIds,setExportIds]=useState(null),[message,setMessage]=useState(''),[storageError,setStorageError]=useState(''),[now,setNow]=useState(Date.now());
 const [recordDirection,setRecordDirection]=useState('received'),[recordScope,setRecordScope]=useState('window');
 const ref=useRef(db), headingRef=useRef(null), previousView=useRef(view), rosterScroll=useRef(0), rosterStudent=useRef(null), ratingsScroll=useRef(0), ratingsGroup=useRef(null), inboxScroll=useRef(0), inboxCase=useRef(null);
 const notify=useCallback(text=>setMessage(text),[]);
 const dispatch=useCallback(action=>{
   const next=applyAction(ref.current,action);
   ref.current=next;setDb(next);
   try{localStorage.setItem(storageKey,JSON.stringify(next));setStorageError('');}catch{setStorageError('Browser storage is unavailable. Changes in this preview will not survive a refresh.');}
   return next;
 },[]);
 useEffect(()=>{const onHash=()=>{const id=location.hash.slice(1);setView(routeView(id));setSelectedStudent(routeStudent(id));setSelectedRatingGroup(routeRatingGroup(id));setCaseId(routeCase(id));setRatingId(null);if(id==='participation')history.replaceState(null,'','#students');};onHash();window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash)},[]);
 useEffect(()=>{if(!message)return;const timeout=setTimeout(()=>setMessage(''),5000);return()=>clearTimeout(timeout)},[message]);
 useEffect(()=>{const interval=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(interval)},[]);
 useEffect(()=>{try{localStorage.setItem('fairly.staff.selected-window',windowId)}catch{}},[windowId]);
 useEffect(()=>{if(previousView.current!==view){const returning=view==='students'&&previousView.current==='student-record';const returningToRatings=view==='explorer'&&previousView.current==='rating-group';const returningToInbox=view==='review'&&previousView.current==='case-review';headingRef.current?.focus({preventScroll:true});if(returning||returningToRatings||returningToInbox){requestAnimationFrame(()=>{const attribute=returning?'data-student-id':returningToRatings?'data-rating-group':'data-case-id';const item=returning?rosterStudent.current:returningToRatings?ratingsGroup.current:inboxCase.current;document.querySelector(`[${attribute}="${CSS.escape(item||'')}"]`)?.focus({preventScroll:true});window.scrollTo({top:returning?rosterScroll.current:returningToRatings?ratingsScroll.current:inboxScroll.current,behavior:'instant'});});}else window.scrollTo({top:0,behavior:'instant'});previousView.current=view;}},[view]);
 useEffect(()=>{if(view==='case-review'){headingRef.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}},[view,caseId]);
 useEffect(()=>{const onStorage=e=>{if(e.key===storageKey&&e.newValue){try{const next=JSON.parse(e.newValue);if(next.schema===3){ref.current=next;setDb(next)}}catch{}}};window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage)},[]);
 useEffect(()=>{const missing=db.windows.some(w=>Date.parse(w.starts_at)<=now&&!w.roster_captured_at);if(missing)dispatch({type:'capture-rosters'});},[db.windows,now,dispatch]);
 const go=useCallback(id=>{setView(routeView(id));location.hash=routeView(id);setSelectedStudent(null);setSelectedRatingGroup(null);setCaseId(null);setRatingId(null)},[]);
 const goStudent=useCallback(id=>{if(view==='students'){rosterScroll.current=window.scrollY;rosterStudent.current=id;}setCaseId(null);setRatingId(null);setSelectedStudent(id);setRecordDirection('received');setRecordScope('window');setView('student-record');location.hash='students/'+encodeURIComponent(id);},[view]);
 const goRatingGroup=useCallback((category,id)=>{if(view==='explorer'){ratingsScroll.current=window.scrollY;ratingsGroup.current=category+'/'+id;}setCaseId(null);setRatingId(null);setSelectedStudent(null);setSelectedRatingGroup({category,id});setView('rating-group');location.hash='explorer/'+category+'/'+encodeURIComponent(id);},[view]);
 const openCase=useCallback(id=>{if(view==='review'){inboxScroll.current=window.scrollY;inboxCase.current=id;}setRatingId(null);setSelectedStudent(null);setSelectedRatingGroup(null);setCaseId(id);setView('case-review');location.hash='review/'+encodeURIComponent(id)},[view]);
 const closeRating=useCallback(()=>setRatingId(null),[]),closeExport=useCallback(()=>setExportIds(null),[]);
 const w=db.windows.find(w=>w.id===windowId)||db.windows[0];
 const currentWindowId=w.id;
 const exportRows=useCallback(rows=>setExportIds(rows.map(r=>r.id)),[]);
 function download(){
   const rows=db.ratings.filter(r=>exportIds.includes(r.id));
   const csv=ratingsCsv(db,rows),blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob);
   const link=document.createElement('a');link.href=url;link.download='fairly-ratings-'+w.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.csv';
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   dispatch({type:'export',windowId:w.id,count:rows.length});setExportIds(null);notify(rows.length+' ratings exported.');
 }
 const context={db,dispatch,notify,go,windowId:currentWindowId,setWindowId,selectedStudent,setSelectedStudent,goStudent,openCase,openRating:setRatingId,explorerFilters,setExplorerFilters,exportRows,now,recordDirection,setRecordDirection,recordScope,setRecordScope,rosterState,setRosterState,ratingBrowseState,setRatingBrowseState,selectedRatingGroup,goRatingGroup,reviewInboxState,setReviewInboxState};
 const openCount=db.cases.filter(c=>c.status==='open').length;
 const groupStudent=db.students.find(student=>student.id===selectedRatingGroup?.id);
 const groupTitle=selectedRatingGroup?.category==='student'?fullName(groupStudent):selectedRatingGroup?.category==='stars'?selectedRatingGroup.id+'-star ratings':selectedRatingGroup?.id==='none'?'No labels':db.labels.find(label=>label.id===selectedRatingGroup?.id)?.name||'Unknown label';
 const activeCase=db.cases.find(item=>item.id===caseId);
 const title=view==='student-record'?'Student record':view==='rating-group'?groupTitle:view==='case-review'?activeCase?.title||'Case not found':navigation.find(n=>n[0]===view)?.[1]||'Overview';
 const activeNav=view==='student-record'?'students':view==='rating-group'?'explorer':view==='case-review'?'review':view;
 const groupSubtitle=selectedRatingGroup?.category==='student'?(groupStudent?'@'+groupStudent.intra_username+' · ':'')+'Ratings received in the selected voting window.':selectedRatingGroup?.category==='stars'?'Ratings with this star level in the selected voting window.':selectedRatingGroup?.id==='none'?'Ratings without labels in the selected voting window.':'Ratings with this label in the selected voting window.';
 const subtitles={overview:'Ratings and participation for the selected voting window.',students:'Track participation and open an individual student’s record.','student-record':'Ratings, labels, and voting history for this student.',explorer:'Review individual ratings or compare them by label, stars, or recipient.','rating-group':groupSubtitle,review:'Review unusual voting and decide which ratings need action.',settings:'Manage voting windows, vote limits, and labels.',accounts:'Review verified student accounts and approval settings.',activity:'A record of staff actions in this workspace.'};
 const pages={overview:<Overview/>,students:<Students/>,'student-record':<StudentRecord id={selectedStudent}/>,explorer:<Explorer/>,'rating-group':<RatingGroup key={selectedRatingGroup?.category+'/'+selectedRatingGroup?.id}/>,review:<AbuseReview/>,'case-review':<CaseDetail key={caseId} id={caseId}/>,settings:<Configuration/>,accounts:<Accounts/>,activity:<AuditLog/>};
 return <StaffContext.Provider value={context}><div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a>
  <aside className="sidebar"><a href="#overview" aria-label="Fairly overview" className="brand" onClick={()=>go('overview')}>Fairly<span>.</span></a><div className="workspace"><span className="campus-symbol" role="img" aria-label="42"><img src={campusLogo} alt="" width="300" height="100"/></span><div className="campus-caption"><strong>Amman</strong><small>Staff workspace</small></div></div><span className="nav-caption">Workspace</span><nav aria-label="Staff navigation">{navigation.map(([id,label,icon],i)=><a key={id} className={(activeNav===id?'active ':'')+(id==='settings'?'nav-divider':'')} href={'#'+id} aria-current={activeNav===id?'page':undefined} title={label} onClick={e=>{e.preventDefault();go(id)}}><Icon name={icon} size={19}/><span>{label}</span>{id==='review'&&openCount>0&&<b>{openCount}</b>}</a>)}</nav><div className="sidebar-footer"><div className="demo-note"><i className="dot teal"/>Demo workspace<small>Synthetic student records</small></div></div></aside>
  <div className="main-shell">
  <main id="main-content" tabIndex={-1}>
  <header className={'page-heading'+(view==='case-review'?' case-page-heading':'')}>
    <div className="page-heading-copy">
      {view==='student-record'&&<button className="text-button record-header-back" onClick={()=>go('students')}><span className="back-arrow"><Icon name="arrow" size={17}/></span>Back to students</button>}
      {view==='rating-group'&&<button className="text-button record-header-back" onClick={()=>go('explorer')}><span className="back-arrow"><Icon name="arrow" size={17}/></span>Back to ratings</button>}
      {view==='case-review'&&<button className="text-button record-header-back" onClick={()=>go('review')}><span className="back-arrow"><Icon name="arrow" size={17}/></span>Back to review inbox</button>}
      <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
      {view==='case-review'&&activeCase?<div className="case-page-meta"><span>Case {activeCase.id.toUpperCase()}</span><Badge tone={activeCase.status==='open'?'amber':activeCase.status==='confirmed'?'red':'neutral'}>{activeCase.status==='open'?'Needs review':activeCase.status==='confirmed'?'Abuse confirmed':'Dismissed'}</Badge></div>:view!=='overview'&&view!=='case-review'&&<p>{subtitles[view]}</p>}
    </div>
    <div className="page-heading-actions">
      <span className="topbar-logo campus-symbol" role="img" aria-label="42"><img src={campusLogo} alt="" width="300" height="100"/></span>
      {['overview','students'].includes(view)&&<button className="button primary" disabled={!ratingsIn(db,currentWindowId).length} title="Export all ratings in the selected window" onClick={()=>exportRows(ratingsIn(db,currentWindowId))}><Icon name="download" size={18}/>Export ratings</button>}
    </div>
  </header>
  {storageError&&<p className="storage-warning" role="alert">{storageError}</p>}
  {['overview','students','student-record','explorer','rating-group','review'].includes(view)&&<section className="window-toolbar" aria-label="Voting window context">
    <div className="window-context">
      <div className="window-selector">
        <label className="window-label" htmlFor="selected-window">Voting window</label>
        <div className="window-value">
          <select id="selected-window" value={currentWindowId} onChange={e=>{setWindowId(e.target.value);setExplorerFilters({});setRatingBrowseState(state=>({...state,selectedGroup:null,groupPage:1}));setReviewInboxState(state=>({...state,page:1}))}}>
            {[...db.windows].sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).map(window=><option key={window.id} value={window.id}>{window.name}</option>)}
          </select>
          <Badge tone={stateOfWindow(w,now)==='Open'?'green':'neutral'}>{stateOfWindow(w,now)}</Badge>
        </div>
      </div>
      <div className="window-dates"><span className="context-label">Dates</span><span className="window-range">{shortDate(w.starts_at)} – {shortDate(w.ends_at)}</span></div>
    </div>
    <button className="text-button window-manage" onClick={()=>go('settings')}><Icon name="settings" size={17}/>Manage windows</button>
  </section>}
  <div className="page-content" key={view}>{pages[view]}</div><footer><span>Fairly / 42 Amman</span><span>Local frontend preview · Changes saved in this browser</span></footer></main></div>
  {ratingId&&<RatingDetail id={ratingId} onClose={closeRating}/>}
  {exportIds&&<Modal title="Export ratings" onClose={closeExport}><p className="export-description">Download {exportIds.length} rating records from <strong>{w.name}</strong>. The export includes voter and recipient identities, stars, labels, explanations, status, and invalidation reasons.</p><div className="export-summary"><Icon name="download" size={28}/><div><strong>Ratings · CSV</strong><small>{exportIds.length} records · {db.ratings.filter(r=>exportIds.includes(r.id)&&!counted(r)).length} invalidated</small></div></div><p className="muted">This file contains staff-only records. Export activity is recorded in the activity log.</p><div className="modal-actions"><button className="button" onClick={closeExport}>Cancel</button><button className="button primary" onClick={download}>Download CSV</button></div></Modal>}
  {message&&<div className="toast" role="status"><Icon name="check" size={18}/>{message}<button aria-label="Dismiss notification" onClick={()=>setMessage('')}><Icon name="close" size={16}/></button></div>}
 </div></StaffContext.Provider>;
}
createRoot(document.getElementById('root')).render(<App/>);
