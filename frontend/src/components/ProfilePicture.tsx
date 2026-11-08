import {useEffect,useState} from 'react';
import {catFor} from './cat';

// The student's photo, or their cat when there is none (or it fails to load).
export function ProfilePicture({picture,seed}:{first?:string;last?:string;picture?:string|null;seed?:string|null}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[picture]);
  return <img src={picture&&!failed?picture:catFor(seed)} alt="" onError={()=>setFailed(true)}/>;
}
