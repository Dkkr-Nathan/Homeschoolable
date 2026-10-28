import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,doc,getDoc,onSnapshot,runTransaction} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {firebaseConfig,familyId} from "./firebase-config.js";
const root=document.getElementById("cloud");
if(!firebaseConfig.apiKey||!firebaseConfig.projectId||!firebaseConfig.appId){
  root.textContent="Cloud sync not configured yet. Local planner remains available.";
}else{
  const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
  const email=document.createElement("input");email.type="email";email.placeholder="Email";email.autocomplete="username";email.setAttribute("aria-label","Email");
  const password=document.createElement("input");password.type="password";password.placeholder="Password";password.autocomplete="current-password";password.setAttribute("aria-label","Password");
  const login=document.createElement("button");login.className="btn";login.textContent="Sign in";
  const logout=document.createElement("button");logout.className="btn";logout.textContent="Sign out";logout.hidden=true;
  const upload=document.createElement("button");upload.className="btn";upload.textContent="Upload this day";upload.hidden=true;
  const state=document.createElement("p");state.setAttribute("role","status");state.textContent="Sign in to synchronize.";
  root.replaceChildren(email,password,login,logout,upload,state);
  const bridge=window.familyPlannerBridge,profiles=["dad","14","13","9"];
  let unsubscribe=null,allowed=false,loaded=false,base=null,dirty=false,working=false,timer=null,generation=0;
  const clone=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function show(s){state.textContent=s}
  function ref(date){return doc(db,"families",familyId,"days",date)}
  function reset(){generation++;clearTimeout(timer);if(unsubscribe){unsubscribe();unsubscribe=null}loaded=false;base=null;dirty=false;working=false}
  function tasks(day,key){return day?.[key]||[]}
  // Three-way merge by task ID. Distinct tasks merge; competing edits to one task stop safely.
  function merge(baseDay,localDay,remoteDay){
    const result={};
    for(const key of profiles){
      const old=new Map(tasks(baseDay,key).map(t=>[t.id,t]));
      const local=new Map(tasks(localDay,key).map(t=>[t.id,t]));
      const remote=new Map(tasks(remoteDay,key).map(t=>[t.id,t]));
      const merged=new Map(remote);
      for(const id of new Set([...old.keys(),...local.keys()])){
        const before=old.get(id),mine=local.get(id),theirs=remote.get(id);
        if(same(mine,before))continue;
        if(!same(theirs,before)&&!same(mine,theirs))throw Error("CONFLICT");
        if(mine===undefined)merged.delete(id);else merged.set(id,mine);
      }
      result[key]=[...merged.values()];
    }
    return result;
  }
  async function save(force=false){
    if(!allowed||!loaded||working||(!dirty&&!force))return;
    const date=bridge.getDate(),token=generation,local=bridge.getDay(),starting=clone(base);
    working=true;
    try{
      const result=await runTransaction(db,async tx=>{
        const snap=await tx.get(ref(date));
        const current=snap.exists()?snap.data():null;
        if(force&&current)throw Error("ALREADY_EXISTS");
        if(!force&&!current)throw Error("MISSING");
        const next=force?local:merge(starting,local,current);
        tx.set(ref(date),next);
        return next;
      });
      if(token!==generation)return;
      base=clone(result);dirty=false;bridge.setDay(result);
      show("Synced · Changes protected against simultaneous edits");
    }catch(e){
      if(token!==generation)return;
      dirty=true;
      if(e.message==="CONFLICT")show("Edit conflict: someone changed the same task. Your changes remain on this device. Export a backup before reloading.");
      else if(e.message==="ALREADY_EXISTS")show("A shared schedule already exists. Upload cancelled to protect it.");
      else if(e.message==="MISSING")show("Cloud schedule missing. Your changes are still local.");
      else show("Cloud save failed; local changes retained: "+e.message);
    }finally{if(token===generation)working=false}
  }
  function queue(){if(!allowed||!loaded)return;dirty=true;clearTimeout(timer);timer=setTimeout(()=>save(),600)}
  async function watch(){
    reset();if(!allowed)return;
    const date=bridge.getDate(),token=generation;show("Loading shared schedule...");
    unsubscribe=onSnapshot(ref(date),snap=>{
      if(token!==generation||bridge.getDate()!==date)return;
      loaded=true;
      if(!snap.exists()){
        if(!dirty){base=null;show("No shared schedule for this date. Choose Upload this day to initialize it.")}
        return;
      }
      const incoming=snap.data();
      if(base===null){base=clone(incoming);bridge.setDay(incoming);show("Synced · Changes protected against simultaneous edits");return}
      if(same(incoming,base))return;
      if(dirty||working){
        // Do not overwrite local unsaved edits; transaction will merge against latest server state.
        if(!working){clearTimeout(timer);timer=setTimeout(()=>save(),250)}
        return;
      }
      base=clone(incoming);bridge.setDay(incoming);show("Synced · Changes protected against simultaneous edits");
    },e=>{loaded=false;show("Sync unavailable: "+e.message)});
  }
  bridge.onChange=queue;
  bridge.onDateChange=watch;
  login.onclick=async()=>{try{show("Signing in...");await signInWithEmailAndPassword(auth,email.value,password.value);password.value=""}catch(e){show("Sign in failed: "+e.message)}};
  logout.onclick=()=>signOut(auth);
  upload.onclick=async()=>{
    if(!allowed||!loaded)return;
    if(base!==null){show("Cloud schedule already exists; upload blocked to prevent overwriting it.");return}
    if(!confirm("Create this date's shared schedule using the tasks on this device?"))return;
    await save(true);
  };
  onAuthStateChanged(auth,async user=>{
    reset();allowed=false;logout.hidden=!user;upload.hidden=true;login.hidden=!!user;email.hidden=!!user;password.hidden=!!user;
    if(!user){show("Sign in to synchronize. Local mode is still available.");return}
    const token=generation;
    try{
      const membership=await getDoc(doc(db,"families",familyId,"members",user.uid));
      if(token!==generation)return;
      if(!membership.exists()){show("Account has no family membership. Ask the administrator to add your UID.");return}
      allowed=true;upload.hidden=false;await watch();
    }catch(e){if(token===generation)show("Membership check failed: "+e.message)}
  });
}
