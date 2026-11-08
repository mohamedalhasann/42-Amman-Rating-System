// Cookie sessions only. Sensitive workspace data never goes into browser storage.
export class ApiError extends Error {
  constructor(message, status, code) {super(message);this.status=status;this.code=code;}
}
let csrfToken;
export async function request(path, {method='GET', body, blob=false, signal}={}) {
  const headers={Accept:blob?'text/csv':'application/json'};
  if(method!=='GET') {
    if(!csrfToken) csrfToken=(await request('/auth/csrf')).csrf_token;
    headers['X-CSRFToken']=csrfToken;
    headers['Content-Type']='application/json';
  }
  let response;
  try {response=await fetch('/api/v1'+path,{method,headers,credentials:'same-origin',cache:'no-store',
    body:body===undefined?undefined:JSON.stringify(body),signal});}
  catch(error) {if(error.name==='AbortError')throw error;throw new ApiError('Cannot reach the server. Check the connection and try again.',0,'NETWORK_ERROR');}
  if(!response.ok) {
    const data=await response.json().catch(()=>null);
    if(data?.error?.code==='CSRF_FAILED')csrfToken=undefined;
    const error=new ApiError(data?.error?.message||'The request could not be completed.',response.status,data?.error?.code);
    if(response.status===401||(response.status===403&&['ACCESS_DENIED','FORBIDDEN'].includes(error.code))) {
      window.dispatchEvent(new CustomEvent('fairly:access-ended',{detail:error}));
    }
    throw error;
  }
  return blob?response.blob():response.json();
}
export function clearCredentials(){csrfToken=undefined;}
