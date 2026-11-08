import React, {useEffect, useState} from 'react';
import {useStaff} from './context';
import {Badge, dateTime, Empty, Icon, Modal, PageControls, Person, Search} from './components';
import {fullName, stateOfWindow} from './model';

const toLocalInput=value=>new Date(Date.parse(value)+3*3600000).toISOString().slice(0,16);
const toUTC=value=>new Date(value+':00+03:00').toISOString();

export function Configuration() {
  const {db,windowId,setWindowId,dispatch,notify,now,saving}=useStaff();
  const [editWindow,setEditWindow]=useState(null),[editLabel,setEditLabel]=useState(null),[error,setError]=useState('');
  const {newWindowRequest,setNewWindowRequest}=useStaff();
  // arriving from the overview's "plan the next window" prompt opens the form straight away
  useEffect(()=>{if(newWindowRequest){setNewWindowRequest(false);openWindow(null);}},[newWindowRequest]);
  function openWindow(window) {
    setError('');
    setEditWindow(window?{...window,start:toLocalInput(window.starts_at),end:toLocalInput(window.ends_at)}:
      {id:crypto.randomUUID(),name:'',start:'',end:'',min_votes:0,max_votes:8,version:0});
  }
  async function saveWindow(event) {
    event.preventDefault();setError('');
    try {
      const {start,end,...value}=editWindow;
      await dispatch({type:'window',value:{...value,name:value.name.trim(),starts_at:toUTC(start),ends_at:toUTC(end)}});
      setWindowId(value.id);setEditWindow(null);notify('Voting window saved.');
    }catch(error){setError(error.message);}
  }
  async function saveLabel(event) {
    event.preventDefault();setError('');
    try {await dispatch({type:'label',value:editLabel});setEditLabel(null);notify('Label saved.');}
    catch(error){setError(error.message);}
  }
  async function toggleLabel(label) {
    setError('');
    try {await dispatch({type:'label',value:{...label,active:!label.active}});notify(label.active?'Label deactivated.':'Label activated.');}
    catch(error){setError(error.message);}
  }
  return <>
    {error&&!editWindow&&!editLabel&&<p className="form-error" role="alert">{error}</p>}
    <section className="panel">
      <div className="panel-heading"><div><h2>Voting windows</h2><p>Dates and vote limits · Asia/Amman (UTC+3)</p></div><button className="button primary" disabled={saving} onClick={()=>openWindow(null)}><Icon name="plus" size={18}/>New window</button></div>
      {db.windows.length?<div className="table-scroll"><table><thead><tr><th>Window</th><th>Schedule · Amman</th><th>Limits</th><th>Status</th><th/></tr></thead><tbody>{[...db.windows].sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).map(window=><tr key={window.id}>
        <td><button className="text-button" onClick={()=>setWindowId(window.id)}>{window.name}</button>{windowId===window.id&&<span className="selected-note">Selected</span>}</td>
        <td>{dateTime(window.starts_at)}<br/><span className="muted">to {dateTime(window.ends_at)}</span></td><td>{window.min_votes} min / {window.max_votes} max</td>
        <td><Badge tone={stateOfWindow(window,now)==='Open'?'green':'neutral'}>{stateOfWindow(window,now)}</Badge></td><td><button className="button small" disabled={saving} onClick={()=>openWindow(window)}>Edit window</button></td>
      </tr>)}</tbody></table></div>:<Empty>Create your first voting window.</Empty>}
      <p className="panel-note">Windows cannot overlap. Date edits preserve ratings and captured rosters. Invalidated votes still use voting allowance.</p>
    </section>
    <section className="panel">
      <div className="panel-heading"><div><h2>Labels & star availability</h2><p>Choose the labels available at each rating level.</p></div><button className="button" disabled={saving} onClick={()=>{setError('');setEditLabel({id:crypto.randomUUID(),name:'',allowed_stars:[3],active:true,version:0});}}><Icon name="plus" size={18}/>Add label</button></div>
      {db.labels.length?<div className="table-scroll"><table><thead><tr><th>Label</th><th>Available at</th><th>Status</th><th/></tr></thead><tbody>{db.labels.map(label=><tr key={label.id}>
        <td>{label.name}</td><td><div className="inline-badges">{label.allowed_stars.slice().sort().map(stars=><Badge key={stars}>{stars} ★</Badge>)}</div></td><td><Badge tone={label.active?'green':'neutral'}>{label.active?'Active':'Inactive'}</Badge></td>
        <td><div className="action-row"><button className="text-button" disabled={saving} onClick={()=>{setError('');setEditLabel({...label,allowed_stars:[...label.allowed_stars]});}}>Edit</button><button className="text-button muted" disabled={saving} onClick={()=>toggleLabel(label)}>{label.active?'Deactivate':'Activate'}</button></div></td>
      </tr>)}</tbody></table></div>:<Empty>No labels configured yet.</Empty>}
      <p className="panel-note">Deactivate a label to remove it from future voting. Create a replacement to change its wording.</p>
    </section>
    {editWindow&&<Modal title={editWindow.version?'Edit voting window':'New voting window'} onClose={()=>{if(!saving)setEditWindow(null);}}>
      <form className="form-stack" onSubmit={saveWindow}><fieldset className="form-fields" disabled={saving}>
        <label>Window name<input maxLength={150} autoComplete="off" required value={editWindow.name} onChange={event=>setEditWindow({...editWindow,name:event.target.value})}/></label>
        <div className="form-pair"><label>Starts · Amman<input type="datetime-local" required value={editWindow.start} onChange={event=>setEditWindow({...editWindow,start:event.target.value})}/></label><label>Ends · Amman<input type="datetime-local" required value={editWindow.end} onChange={event=>setEditWindow({...editWindow,end:event.target.value})}/></label></div>
        <div className="form-pair"><label>Minimum participation target<input type="number" required min="0" max="10000" step="1" value={editWindow.min_votes} onChange={event=>setEditWindow({...editWindow,min_votes:Number(event.target.value)})}/></label><label>Maximum votes per student<input type="number" required min={editWindow.min_votes} max="10000" step="1" value={editWindow.max_votes} onChange={event=>setEditWindow({...editWindow,max_votes:Number(event.target.value)})}/></label></div>
        <p className="muted">The minimum is a reporting target. Only approved students at the opening time join the window roster.</p>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button" onClick={()=>setEditWindow(null)}>Cancel</button><button className="button primary">{saving?'Saving…':'Save window'}</button></div>
      </fieldset></form>
    </Modal>}
    {editLabel&&<Modal title={editLabel.version?'Edit label':'Add label'} onClose={()=>{if(!saving)setEditLabel(null);}}>
      <form className="form-stack" onSubmit={saveLabel}><fieldset className="form-fields" disabled={saving}>
        <label>Label name<input maxLength={150} required readOnly={Boolean(editLabel.version)} value={editLabel.name} onChange={event=>setEditLabel({...editLabel,name:event.target.value})}/></label>
        <fieldset><legend>Available at these star levels</legend><div className="star-options">{[1,2,3].map(stars=><label key={stars}><input type="checkbox" checked={editLabel.allowed_stars.includes(stars)} onChange={()=>setEditLabel({...editLabel,allowed_stars:editLabel.allowed_stars.includes(stars)?editLabel.allowed_stars.filter(value=>value!==stars):[...editLabel.allowed_stars,stars]})}/>{stars} {stars===1?'star':'stars'}</label>)}</div></fieldset>
        <label className="check-label"><input type="checkbox" checked={editLabel.active} onChange={event=>setEditLabel({...editLabel,active:event.target.checked})}/>Active for new ratings</label>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button" onClick={()=>setEditLabel(null)}>Cancel</button><button className="button primary">{saving?'Saving…':'Save label'}</button></div>
      </fieldset></form>
    </Modal>}
  </>;
}

export function Accounts() {
  const {db,dispatch,notify,saving}=useStaff();
  const [query,setQuery]=useState(''),[scope,setScope]=useState('pending'),[error,setError]=useState(''),[page,setPage]=useState(1);
  const pending=db.students.filter(student=>student.active&&student.email_verified_at&&!student.approved_at);
  const rows=db.students.filter(student=>(scope==='all'||pending.includes(student))&&(fullName(student)+' '+student.intra_username).toLowerCase().includes(query.toLowerCase()));
  const safePage=Math.min(page,Math.max(1,Math.ceil(rows.length/10)));
  async function approve(id) {
    setError('');
    try {await dispatch({type:'approve',id});notify('Student account approved.');}catch(error){setError(error.message);}
  }
  async function changeApproval(enabled) {
    setError('');
    try {await dispatch({type:'approval-setting',enabled});notify(enabled?'Manual student approval enabled.':'Manual approval disabled. Existing pending accounts still need approval.');}
    catch(error){setError(error.message);}
  }
  return <>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <section className="panel approval-settings"><div><h2>Student account approval</h2><p>Require staff approval after students verify their email and create a password.</p><small>Existing approvals and pending accounts keep their current status.</small></div><label className="switch"><input type="checkbox" disabled={saving} checked={db.settings.manual_student_approval_enabled} onChange={event=>changeApproval(event.target.checked)}/><span/><b>{db.settings.manual_student_approval_enabled?'Enabled':'Disabled'}</b></label></section>
    <section className="panel">
      <div className="panel-heading"><div><h2>Student accounts <Badge>{pending.length} pending</Badge></h2><p>Only verified, active accounts can be approved.</p></div><select aria-label="Account status" value={scope} onChange={event=>{setScope(event.target.value);setPage(1);}}><option value="pending">Awaiting approval</option><option value="all">All accounts</option></select></div>
      <div className="table-toolbar"><Search label="Search accounts" value={query} onChange={value=>{setQuery(value);setPage(1);}} placeholder="Search name or username"/></div>
      {rows.length?<><div className="table-scroll"><table><thead><tr><th>Student</th><th>Email verification</th><th>Approval</th><th/></tr></thead><tbody>{rows.slice((safePage-1)*10,safePage*10).map(student=><tr key={student.id}>
        <td><Person id={student.id}/>{!student.active&&<Badge>Inactive</Badge>}</td><td><Badge tone={student.email_verified_at?'green':'neutral'}>{student.email_verified_at?'Verified':'Unverified'}</Badge></td><td>{student.approved_at?dateTime(student.approved_at):<Badge tone="amber">Pending</Badge>}</td>
        <td>{!student.approved_at&&<button className="button primary small" disabled={saving||!student.active||!student.email_verified_at} onClick={()=>approve(student.id)}>Approve account</button>}</td>
      </tr>)}</tbody></table></div><PageControls page={safePage} setPage={setPage} total={rows.length} size={10}/></>:<Empty>No accounts match this view.</Empty>}
      <p className="panel-note">Approvals do not change a voting window’s captured roster.</p>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Staff access</h2><p>Staff accounts are provisioned from the approved Intra roster.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Staff member</th><th>Intra username</th><th>Account status</th></tr></thead><tbody>{db.staff.map(staff=><tr key={staff.id}><td>{fullName(staff).trim()||staff.intra_username}</td><td>@{staff.intra_username}</td><td><Badge tone={!staff.active?'neutral':staff.email_verified_at?'green':'amber'}>{!staff.active?'Disabled':staff.email_verified_at?'Ready':'Setup required'}</Badge></td></tr>)}</tbody></table></div>
    </section>
  </>;
}

export function AuditLog() {
  const {db}=useStaff();
  const [query,setQuery]=useState(''),[page,setPage]=useState(1);
  const rows=db.audit.filter(event=>(event.action+' '+event.target+' '+event.detail+' '+event.actor).toLowerCase().includes(query.toLowerCase()));
  const safePage=Math.min(page,Math.max(1,Math.ceil(rows.length/10)));
  return <section className="panel"><div className="panel-heading"><div><h2>Staff activity</h2><p>Configuration, approvals, case decisions, exports, and staff account activity.</p></div></div><div className="table-toolbar"><Search value={query} onChange={value=>{setQuery(value);setPage(1);}} label="Search activity" placeholder="Search activity"/></div>
    {rows.length?<><div className="table-scroll"><table><thead><tr><th>Action</th><th>Details</th><th>Staff</th><th>Time · Amman</th></tr></thead><tbody>{rows.slice((safePage-1)*10,safePage*10).map(event=><tr key={event.id}><td><strong>{event.action}</strong><small className="block muted">{event.target}</small></td><td className="wrap-cell">{event.detail}</td><td>{event.actor}</td><td>{dateTime(event.at)}</td></tr>)}</tbody></table></div><PageControls page={safePage} setPage={setPage} total={rows.length} size={10}/></>:<Empty>No staff actions match this view.</Empty>}
  </section>;
}
