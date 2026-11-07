import {useEffect,useState} from 'react';
import {initials} from './bits';

export function ProfilePicture({first,last,picture}:{first:string;last:string;picture?:string|null}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[picture]);
  return picture&&!failed?<img src={picture} alt="" onError={()=>setFailed(true)}/>:<span>{initials(first,last)}</span>;
}
