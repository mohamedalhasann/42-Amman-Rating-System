import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StaffContext} from './context';
import {counted, fullName, ratingsIn, stateOfWindow} from './model';
import {clearCredentials, request} from './api';
import {SessionBoundary} from './session';
import {Badge, Icon, Modal, RatingDetail, shortDate} from './components';
import {AbuseReview, Explorer, Overview, RatingGroup, StudentRecord, Students} from './screens';
import {CaseDetail} from './case-review';
import {Accounts, AuditLog, Configuration} from './management';
// Fonts ship as real files: the server's CSP allows fonts from 'self' only, not data: URLs.
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '../styles.css';
import './theme.css';
import campusLogo from '../../docs/42-logo.jpeg';
import campusMark from './assets/logo-42-amman.svg';

const navigation=[['overview','Overview','grid'],['students','Students','people'],['explorer','Ratings','chart'],['review','Abuse review','flag'],['settings','Configuration','settings'],['accounts','Accounts','lock'],['activity','Activity log','clock']];
const routeView = value => /^students\/[^/]+$/.test(value)?'student-record':/^explorer\/(student|stars|label)\/[^/]+$/.test(value)?'rating-group':/^review\/[^/]+$/.test(value)?'case-review':value==='participation'?'students':navigation.some(item=>item[0]===value)?value:'overview';
function routeStudent(value){try{return routeView(value)==='student-record'?decodeURIComponent(value.split('/')[1]):null}catch{return null}}
function routeCase(value){try{return routeView(value)==='case-review'?decodeURIComponent(value.split('/')[1]):null}catch{return null}}
function routeRatingGroup(value){try{const [,category,id]=value.split('/');return routeView(value)==='rating-group'?{category,id:decodeURIComponent(id)}:null}catch{return null}}
function App({db:initialDb,identity}){
 const [db,setDb]=useState(initialDb),[view,setView]=useState(()=>routeView(location.hash.slice(1)));
 const [windowId,setWindowId]=useState(initialDb.windows.find(w=>stateOfWindow(w)==='Open')?.id||initialDb.windows[0]?.id||''),[selectedStudent,setSelectedStudent]=useState(()=>routeStudent(location.hash.slice(1))),[explorerFilters,setExplorerFilters]=useState({});
 const [rosterState,setRosterState]=useState({query:'',filter:'all',page:1,scope:'directory'});
 const [ratingBrowseState,setRatingBrowseState]=useState(()=>({category:routeRatingGroup(location.hash.slice(1))?.category||'student',studentQuery:'',selectedGroup:null,groupPage:1}));
 const [selectedRatingGroup,setSelectedRatingGroup]=useState(()=>routeRatingGroup(location.hash.slice(1)));
 const [reviewInboxState,setReviewInboxState]=useState({status:'open',mechanism:'',scope:'all',query:'',page:1});
 const [caseId,setCaseId]=useState(()=>routeCase(location.hash.slice(1))),[ratingId,setRatingId]=useState(null),[exportIds,setExportIds]=useState(null),[message,setMessage]=useState(''),[loadError,setLoadError]=useState(''),[now,setNow]=useState(Date.now());
 const [saving,setSaving]=useState(false),[refreshing,setRefreshing]=useState(false),[exportError,setExportError]=useState('');
 const busy=useRef(false),requestSequence=useRef(0),mounted=useRef(true);
 const [recordDirection,setRecordDirection]=useState('received'),[recordScope,setRecordScope]=useState('window');
 const ref=useRef(db), headingRef=useRef(null), previousView=useRef(view), rosterScroll=useRef(0), rosterStudent=useRef(null), ratingsScroll=useRef(0), ratingsGroup=useRef(null), inboxScroll=useRef(0), inboxCase=useRef(null);
 const notify=useCallback(text=>setMessage(text),[]);
 const [updatedAt,setUpdatedAt]=useState(()=>Date.now()),[newWindowRequest,setNewWindowRequest]=useState(false);
 const commit=useCallback(next=>{if(mounted.current){ref.current=next;setDb(next);setLoadError('');setUpdatedAt(Date.now());}},[]);
 const refresh=useCallback(async()=>{
   if(busy.current)return;
   const sequence=++requestSequence.current;
   setRefreshing(true);
   try{const next=await request('/staff/workspace');if(sequence===requestSequence.current)commit(next);}
   catch(error){if(mounted.current&&sequence===requestSequence.current)setLoadError(error.message);}
   finally{if(mounted.current&&sequence===requestSequence.current)setRefreshing(false);}
 },[commit]);
 const dispatch=useCallback(async action=>{
   if(busy.current)throw new Error('Wait for the current action to finish.');
   busy.current=true;setSaving(true);++requestSequence.current;
   try{
     let next;
     if(action.type==='approve'){
       await request('/staff/account-approvals/'+encodeURIComponent(action.id)+'/approve',{method:'POST',body:{}});
     }else if(action.type==='approval-setting'){
       await request('/staff/settings',{method:'PATCH',body:{manual_student_approval_enabled:action.enabled,version:ref.current.settings.version}});
     }else{
       next=await request('/staff/actions',{method:'POST',body:{...action,version:ref.current.version}});
     }
     if(next)commit(next);
     else {try{commit(await request('/staff/workspace'));}catch(error){if(mounted.current)setLoadError('The action was saved, but the workspace could not be refreshed. '+error.message);}}
   }catch(error){
     if(error.status===409){try{commit(await request('/staff/workspace'));}catch{}}
     throw error;
   }finally{busy.current=false;if(mounted.current){setSaving(false);setRefreshing(false);}}
 },[commit]);
 useEffect(()=>()=>{mounted.current=false;++requestSequence.current;},[]);
 useEffect(()=>{
   const update=()=>{if(!document.hidden)refresh();};
   const interval=setInterval(update,60000);window.addEventListener('focus',update);
   return()=>{clearInterval(interval);window.removeEventListener('focus',update);};
 },[refresh]);
 async function signOut(){
   if(busy.current)return;
   busy.current=true;setSaving(true);
   try{await request('/auth/logout',{method:'POST',body:{}});clearCredentials();window.dispatchEvent(new CustomEvent('fairly:access-ended',{detail:{status:401,message:'Sign in to continue.'}}));window.location.assign('/login');}
   catch(error){setLoadError(error.message);}
   finally{busy.current=false;if(mounted.current)setSaving(false);}
 }
 useEffect(()=>{const onHash=()=>{const id=location.hash.slice(1);setView(routeView(id));setSelectedStudent(routeStudent(id));setSelectedRatingGroup(routeRatingGroup(id));setCaseId(routeCase(id));setRatingId(null);if(id==='participation')history.replaceState(null,'','#students');};onHash();window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash)},[]);
 useEffect(()=>{if(!message)return;const timeout=setTimeout(()=>setMessage(''),5000);return()=>clearTimeout(timeout)},[message]);
 useEffect(()=>{const interval=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(interval)},[]);
 useEffect(()=>{if(previousView.current!==view){const returning=view==='students'&&previousView.current==='student-record';const returningToRatings=view==='explorer'&&previousView.current==='rating-group';const returningToInbox=view==='review'&&previousView.current==='case-review';headingRef.current?.focus({preventScroll:true});if(returning||returningToRatings||returningToInbox){requestAnimationFrame(()=>{const attribute=returning?'data-student-id':returningToRatings?'data-rating-group':'data-case-id';const item=returning?rosterStudent.current:returningToRatings?ratingsGroup.current:inboxCase.current;document.querySelector(`[${attribute}="${CSS.escape(item||'')}"]`)?.focus({preventScroll:true});window.scrollTo({top:returning?rosterScroll.current:returningToRatings?ratingsScroll.current:inboxScroll.current,behavior:'instant'});});}else window.scrollTo({top:0,behavior:'instant'});previousView.current=view;}},[view]);
 useEffect(()=>{if(view==='case-review'){headingRef.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}},[view,caseId]);
 const go=useCallback(id=>{setView(routeView(id));location.hash=routeView(id);setSelectedStudent(null);setSelectedRatingGroup(null);setCaseId(null);setRatingId(null)},[]);
 const goStudent=useCallback(id=>{if(view==='students'){rosterScroll.current=window.scrollY;rosterStudent.current=id;}setCaseId(null);setRatingId(null);setSelectedStudent(id);setRecordDirection('received');setRecordScope('window');setView('student-record');location.hash='students/'+encodeURIComponent(id);},[view]);
 const goRatingGroup=useCallback((category,id)=>{if(view==='explorer'){ratingsScroll.current=window.scrollY;ratingsGroup.current=category+'/'+id;}setCaseId(null);setRatingId(null);setSelectedStudent(null);setSelectedRatingGroup({category,id});setView('rating-group');location.hash='explorer/'+category+'/'+encodeURIComponent(id);},[view]);
 const openCase=useCallback(id=>{if(view==='review'){inboxScroll.current=window.scrollY;inboxCase.current=id;}setRatingId(null);setSelectedStudent(null);setSelectedRatingGroup(null);setCaseId(id);setView('case-review');location.hash='review/'+encodeURIComponent(id)},[view]);
 const closeRating=useCallback(()=>setRatingId(null),[]),closeExport=useCallback(()=>setExportIds(null),[]);
 const w=db.windows.find(w=>w.id===windowId)||db.windows[0];
 const currentWindowId=w?.id||'';
 const exportRows=useCallback(rows=>{setExportError('');setExportIds(rows.map(r=>r.id));},[]);
 async function download(){
   if(busy.current)return;
   busy.current=true;setSaving(true);setExportError('');++requestSequence.current;
   try{
     const blob=await request('/staff/ratings/export.csv',{method:'POST',body:{window_id:w.id,rating_ids:exportIds},blob:true});
     const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='fairly-ratings.csv';
     document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
     setExportIds(null);notify(exportIds.length+' ratings exported.');
     try{commit(await request('/staff/workspace'));}catch(error){setLoadError('The export was downloaded, but activity could not be refreshed. '+error.message);}
   }catch(error){setExportError(error.message);}
   finally{busy.current=false;if(mounted.current){setSaving(false);setRefreshing(false);}}
 }
 const context={db,dispatch,saving,notify,go,windowId:currentWindowId,setWindowId,selectedStudent,setSelectedStudent,goStudent,openCase,openRating:setRatingId,explorerFilters,setExplorerFilters,exportRows,now,recordDirection,setRecordDirection,recordScope,setRecordScope,rosterState,setRosterState,ratingBrowseState,setRatingBrowseState,selectedRatingGroup,goRatingGroup,reviewInboxState,setReviewInboxState,newWindowRequest,setNewWindowRequest};
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
  <aside className="sidebar"><a href="#overview" aria-label="Fairly overview" className="brand" onClick={()=>go('overview')}>Fairly<span>.</span></a><div className="workspace"><span className="campus-mark-svg" role="img" aria-label="42 Amman" style={{'--logo':`url(${campusMark})`}}/><div className="campus-caption"><small>Staff workspace</small></div></div><nav aria-label="Staff navigation">{navigation.map(([id,label,icon])=><a key={id} className={(activeNav===id?'active ':'')+(id==='settings'?'nav-divider':'')} href={'#'+id} aria-current={activeNav===id?'page':undefined} title={label} onClick={e=>{e.preventDefault();go(id)}}><Icon name={icon} size={19}/><span>{label}</span>{id==='review'&&openCount>0&&<b>{openCount}</b>}</a>)}</nav><div className="sidebar-footer"><button className="updated-button" disabled={saving||refreshing} onClick={refresh} title="Data refreshes every minute. Click to refresh now.">{refreshing?'Updating…':'Updated '+new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Amman'}).format(updatedAt)}<Icon name="refresh" size={13}/></button><div className="staff-identity"><strong>{fullName(identity).trim()||identity.intra_username}</strong><small>@{identity.intra_username}</small></div><button className="text-button" disabled={saving} onClick={signOut}><Icon name="logout" size={17}/>Sign out</button></div></aside>
  <div className="main-shell">
  <main id="main-content" tabIndex={-1}>
  <header className={'page-heading'+(view==='case-review'?' case-page-heading':'')}>
    <div className="page-heading-copy">
      {view==='student-record'&&<button className="text-button record-header-back" onClick={()=>go('students')}><span className="back-arrow"><Icon name="arrow" size={17}/></span>Back to students</button>}
      {view==='rating-group'&&<button className="text-button record-header-back" onClick={()=>go('explorer')}><span className="back-arrow"><Icon name="arrow" size={17}/></span>Back to ratings</button>}
      {view==='case-review'&&<button className="text-button record-header-back" onClick={()=>go('review')}><span className="back-arrow"><Icon name="arrow" size={17}/></span>Back to review inbox</button>}
      <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
      {view==='case-review'&&activeCase?<div className="case-page-meta"><Badge tone={activeCase.status==='open'?'amber':activeCase.status==='confirmed'?'red':'neutral'}>{activeCase.status==='open'?'Needs review':activeCase.status==='confirmed'?'Abuse confirmed':'Dismissed'}</Badge></div>:view!=='overview'&&view!=='case-review'&&<p>{subtitles[view]}</p>}
    </div>
    <div className="page-heading-actions">
      <span className="topbar-logo campus-symbol" role="img" aria-label="42"><img src={campusLogo} alt="" width="300" height="100"/></span>
      {w&&['overview','students','student-record','explorer','rating-group','review'].includes(view)&&<div className="window-pill">
        <label className="window-pill-label" htmlFor="selected-window">Window</label>
        <select id="selected-window" value={currentWindowId} onChange={e=>{setWindowId(e.target.value);setExplorerFilters({});setRatingBrowseState(state=>({...state,selectedGroup:null,groupPage:1}));setReviewInboxState(state=>({...state,page:1}))}}>
          {[...db.windows].sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).map(window=><option key={window.id} value={window.id}>{window.name}</option>)}
        </select>
        <Badge tone={stateOfWindow(w,now)==='Open'?'green':'neutral'}>{stateOfWindow(w,now)}</Badge>
        <span className="window-pill-dates">{shortDate(w.starts_at)} – {shortDate(w.ends_at)}</span>
      </div>}
      {['overview','students'].includes(view)&&<button className="button primary" disabled={!ratingsIn(db,currentWindowId).length} title="Export all ratings in the selected window" onClick={()=>exportRows(ratingsIn(db,currentWindowId))}><Icon name="download" size={18}/>Export ratings</button>}
    </div>
  </header>
  {loadError&&<div className="storage-warning" role="alert">{loadError} <button className="text-button" disabled={saving||refreshing} onClick={refresh}>Retry</button></div>}
  <div className="page-content" key={view}>{!w&&['overview','explorer','rating-group'].includes(view)?<section className="panel no-window"><Icon name="clock" size={30}/><h2>No voting windows yet</h2><p>Create a window to start tracking ratings and participation.</p><button className="button primary" onClick={()=>go('settings')}>Configure a voting window</button></section>:pages[view]}</div><footer><span>Fairly / 42 Amman</span><span>{saving?'Saving…':'Connected to your campus database'}</span></footer></main></div>
  {ratingId&&<RatingDetail id={ratingId} onClose={closeRating}/>}
  {exportIds&&<Modal title="Export ratings" onClose={saving?()=>{}:closeExport}><p className="export-description">Download {exportIds.length} rating records from <strong>{w?.name}</strong>. The export includes voter and recipient identities, stars, labels, explanations, status, and invalidation reasons.</p><div className="export-summary"><Icon name="download" size={28}/><div><strong>Ratings · CSV</strong><small>{exportIds.length} records · {db.ratings.filter(r=>exportIds.includes(r.id)&&!counted(r)).length} invalidated</small></div></div><p className="muted">This file contains staff-only records. Export activity is recorded in the activity log.</p>{exportError&&<p className="form-error" role="alert">{exportError}</p>}<div className="modal-actions"><button className="button" disabled={saving} onClick={closeExport}>Cancel</button><button className="button primary" disabled={saving} onClick={download}>{saving?'Exporting…':'Download CSV'}</button></div></Modal>}
  {message&&<div className="toast" role="status"><Icon name="check" size={18}/>{message}<button aria-label="Dismiss notification" onClick={()=>setMessage('')}><Icon name="close" size={16}/></button></div>}
 </div></StaffContext.Provider>;
}
createRoot(document.getElementById('root')).render(<SessionBoundary>{state=><App {...state}/>}</SessionBoundary>);
