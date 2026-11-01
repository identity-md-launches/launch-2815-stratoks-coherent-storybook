import { useEffect, useState } from 'react';
import ExpanseApp from './expanse/App';
import ArtSheet from './expanse/ArtSheet';
// The archived writable settlement UI is never bundled into this observer.
// Backend recovery tools and historical records remain available to the owner.
export default function Router(){
 const [hash,setHash]=useState(location.hash);
 useEffect(()=>{const change=()=>setHash(location.hash);addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change);},[]);
 if(hash==='#settlement')return <main className="fatal"><h1>The settlement is part of the Expanse</h1><p>The persistent world continues at its original coordinates. The archived client is unavailable (legacyAvailable: false).</p><a href="#">Explore the Expanse</a></main>;
 if(hash==='#art-sheet')return <ArtSheet/>;
 return <ExpanseApp/>;
}
