import React, {useEffect, useState} from 'react';
import {ApiError, request} from './api';

// Shared login is owned by feat/student-frontend. This is an access boundary,
// not another credential form or an alternative login flow.
export function SessionBoundary({children}) {
  const [state,setState]=useState({loading:true}),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setState({loading:true});
    (async()=>{
      try {
        const identity=await request('/me',{signal:controller.signal});
        if(identity.role!=='staff')throw new ApiError('This workspace is available to staff accounts.',403,'FORBIDDEN');
        const db=await request('/staff/workspace',{signal:controller.signal});
        if(!controller.signal.aborted)setState({identity,db});
      }catch(error){if(!controller.signal.aborted)setState({error});}
    })();
    const ended=event=>{controller.abort();setState({error:event.detail});};
    window.addEventListener('fairly:access-ended',ended);
    return()=>{controller.abort();window.removeEventListener('fairly:access-ended',ended);};
  },[attempt]);
  if(state.db)return children(state);
  const signedOut=state.error?.status===401;
  return <main className="session-boundary"><a className="brand" href="/staff/">Fairly<span>.</span></a><section className="panel" aria-live="polite" aria-busy={state.loading||undefined}>
    <h1>{state.loading?'Opening staff workspace…':signedOut?'Sign in required':state.error?.status===403?'Staff access required':'Workspace unavailable'}</h1>
    <p>{state.loading?'Checking your account and loading your workspace.':signedOut?'Sign in through the shared Fairly login, then return here.':state.error.message}</p>
    {!state.loading&&<>{signedOut&&<a className="button primary" href="/login">Sign in</a>}<button className="button" onClick={()=>setAttempt(value=>value+1)}>{signedOut?'Check sign-in':'Try again'}</button></>}
  </section></main>;
}
