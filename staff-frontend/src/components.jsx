import React, {useEffect, useRef, useState} from 'react';
import {useStaff} from './context';
import {counted, fullName} from './model';

export function Icon({name, size = 20}) {
  const paths = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    person: 'M5 21v-2a7 7 0 0 1 14 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    chart: 'M4 3v17h17 M8 15v-4 M13 15V6 M18 15V9',
    flag: 'M5 21V3 M5 4c6-4 8 4 15 0v11c-7 4-9-4-15 0',
    settings: 'M4 7h16 M4 17h16 M9 4v6 M16 14v6',
    arrow: 'M5 12h14 M13 6l6 6-6 6',
    download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
    search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    close: 'M6 6l12 12 M6 18L18 6', plus: 'M12 5v14 M5 12h14',
    logout: 'M9 3H4v18h5 M9 12h12 M16 7l5 5-5 5',
    check: 'M5 12l4 4L19 6', clock: 'M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    list: 'M9 5h12 M9 12h12 M9 19h12 M3 5h1 M3 12h1 M3 19h1',
    lock: 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.grid}/></svg>;
}
export function Badge({children, tone = ''}) {return <span className={`badge ${tone}`}>{children}</span>;}
export function Avatar({student}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[student.photo_url]);
  const color=[...student.id].reduce((sum,letter)=>sum+letter.charCodeAt(0),0)%5;
  return <span className={`avatar avatar-${color}`} aria-hidden="true">{student.photo_url&&!failed?
    <img src={student.photo_url} alt="" loading="lazy" onError={()=>setFailed(true)}/>:
    `${student.first_name?.[0]||''}${student.last_name?.[0]||''}`||student.intra_username.slice(0,2).toUpperCase()}</span>;
}
export function Person({id, compact = false, clickable = true}) {
  const {db, goStudent} = useStaff();
  const student = db.students.find(s => s.id === id);
  if (!student) return <span>Unknown student</span>;
  const content = <><Avatar student={student}/><span className="person-name">{fullName(student)}{!compact && <small>{student.intra_username}</small>}</span></>;
  return clickable ? <button className="person" onClick={() => goStudent(id)}>{content}</button> : <span className="person static">{content}</span>;
}
export function Search({value, onChange, placeholder = 'Search students…', label = 'Search', inputRef}) {
  const localRef = useRef(null);
  const ref = inputRef || localRef;
  return <div className="search-box"><Icon name="search" size={18}/><input ref={ref} type="search" aria-label={label} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/>{value && <button className="clear-search" type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => {onChange('');ref.current?.focus();}}><Icon name="close" size={15}/></button>}</div>;
}
export function RatingStars({stars}) {
  return <span className={`rating-stars stars-${stars}`} role="img" aria-label={`${stars} out of 3 stars`}><span aria-hidden="true" className="stars-filled">{'★'.repeat(stars)}</span><span aria-hidden="true">{'★'.repeat(3-stars)}</span></span>;
}
export function Empty({children = 'No records to show.'}) {return <div className="empty"><Icon name="list" size={26}/><p>{children}</p></div>;}
export function Tabs({value, onChange, options, label = 'View'}) {
  return <div className="tabs" role="group" aria-label={label}>{options.map(([id, text]) => <button key={id} className={value === id ? 'active' : ''} aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>)}</div>;
}
export function PageControls({page, setPage, total, size = 8}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="pagination"><span>{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}` : '0 records'}</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>;
}
export function Modal({title, children, onClose, wide = false, drawer = false, className = ''}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const focusables = () => [...ref.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')];
    focusables()[0]?.focus();
    const onKey = e => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab') return;
      const items = focusables(), first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {e.preventDefault(); last?.focus();}
      if (!e.shiftKey && document.activeElement === last) {e.preventDefault(); first?.focus();}
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => {document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus();};
  }, []);
  return <div className={`modal-backdrop ${drawer ? 'drawer-backdrop' : ''}`} onClick={onClose}><section ref={ref} className={`modal ${wide ? 'wide' : ''} ${drawer ? 'drawer' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close"/></button></div>{children}</section></div>;
}
export const dateTime = value => value ? new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Amman'}).format(new Date(value)) : '—';
export const shortDate = value => new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', timeZone: 'Asia/Amman'}).format(new Date(value));
export function RatingTable({rows, selectIds, setSelectIds, pageSize = 8, studentDirection = null, showWindow = false}) {
  const {db, openRating} = useStaff();
  const [page, setPage] = useState(1);
  const signature = rows.map(r => r.id).join(',');
  useEffect(() => setPage(1), [signature]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  if (!rows.length) return <Empty>No ratings match this view.</Empty>;
  return <><div className="table-scroll" tabIndex={0} role="region" aria-label="Rating records"><table><thead><tr>{setSelectIds && <th><span className="sr-only">Select ratings</span></th>}{studentDirection!=='given'&&<th>Rated by</th>}{studentDirection!=='received'&&<th>Recipient</th>}<th>Rating</th><th>Labels</th>{studentDirection&&<th>Submitted</th>}{showWindow&&<th>Window</th>}<th>Status</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{rows.slice((safePage-1)*pageSize, safePage*pageSize).map(r => <tr key={r.id}>{setSelectIds && <td><input aria-label={`Select rating ${r.id}`} type="checkbox" disabled={!counted(r)} checked={selectIds.includes(r.id)} onChange={() => setSelectIds(selectIds.includes(r.id) ? selectIds.filter(id => id !== r.id) : [...selectIds, r.id])}/></td>}{studentDirection!=='given'&&<td><Person id={r.voter_id}/></td>}{studentDirection!=='received'&&<td><Person id={r.recipient_id}/></td>}<td><RatingStars stars={r.stars}/></td><td><RatingLabels rating={r}/></td>{studentDirection&&<td><time dateTime={r.submitted_at} title={dateTime(r.submitted_at)+' · Amman'}>{shortDate(r.submitted_at)}</time></td>}{showWindow&&<td>{db.windows.find(window=>window.id===r.window_id)?.name}</td>}<td><Badge tone={counted(r) ? 'green' : 'red'}>{counted(r) ? 'Counted' : 'Invalidated'}</Badge></td><td><button className="text-button" aria-label={`View rating ${r.id.toUpperCase()}`} onClick={() => openRating(r.id)}>Details <Icon name="arrow" size={15}/></button></td></tr>)}</tbody></table></div><PageControls page={safePage} setPage={setPage} total={rows.length} size={pageSize}/></>;
}
export function RatingLabels({rating}) {
  const {db} = useStaff();
  return <div className="inline-labels">{rating.label_ids.length ? rating.label_ids.map(id => <span key={id}>{db.labels.find(l => l.id === id)?.name || 'Unknown label'}</span>) : <span className="muted">No labels</span>}</div>;
}
export function RatingDetail({id, onClose}) {
  const {db, openCase} = useStaff();
  const r = db.ratings.find(r => r.id === id);
  if (!r) return null;
  const related = db.cases.filter(c => c.rating_ids.includes(id));
  return <Modal title={`Rating ${id.toUpperCase()}`} onClose={onClose} drawer><div className="detail-status"><Badge tone={counted(r) ? 'green' : 'red'}>{counted(r) ? 'Counted' : 'Invalidated'}</Badge><RatingStars stars={r.stars}/></div><dl className="detail-list"><div><dt>From</dt><dd><Person id={r.voter_id}/></dd></div><div><dt>To</dt><dd><Person id={r.recipient_id}/></dd></div><div><dt>Window</dt><dd>{db.windows.find(w => w.id === r.window_id)?.name}</dd></div><div><dt>Submitted</dt><dd>{dateTime(r.submitted_at)} <small>Amman</small></dd></div><div><dt>Labels</dt><dd><RatingLabels rating={r}/></dd></div></dl><h3 className="detail-subheading">Student explanation</h3><blockquote>{r.explanation || 'No explanation was provided.'}</blockquote>{r.invalidation && <div className="decision-box"><h3>Invalidation</h3><p>{r.invalidation.reason}</p><small>{r.invalidation.by} · {dateTime(r.invalidation.at)}</small></div>}<h3 className="detail-subheading">Related cases</h3>{related.length ? related.map(c => <button key={c.id} className="related-case" onClick={() => {onClose(); openCase(c.id);}}><span>{c.title}</span><Badge>{c.status}</Badge><Icon name="arrow" size={16}/></button>) : <p className="muted">No linked abuse cases.</p>}</Modal>;
}
