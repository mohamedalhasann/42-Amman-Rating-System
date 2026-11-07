// Capture once, before React StrictMode mounts components, then remove the
// secret from the address bar. Never persist it to browser storage.
let token='',tokenPath='';
function capture(){
  const url=new URL(window.location.href);
  if(!/^\/(setup|reset)\/complete\/?$/.test(url.pathname))return;
  const value=new URLSearchParams(url.hash.slice(1)).get('token')||url.searchParams.get('token');
  if(value){token=value;tokenPath=url.pathname;}
  if(url.hash||url.searchParams.has('token')){
    url.hash='';url.searchParams.delete('token');
    window.history.replaceState(window.history.state,'',url.pathname+url.search);
  }
}
capture();
export const readLinkToken=()=>{capture();return window.location.pathname===tokenPath?token:'';};
export function clearLinkToken(){token='';tokenPath='';}
