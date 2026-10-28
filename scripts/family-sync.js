import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,doc,getDoc,onSnapshot,setDoc} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
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
  let unsubscribe=null,allowed=false,loaded=false,writing=false,remotePending=false;
  let lastCloud=null;
  const bridge=window.familyPlannerBridge;
  function show(s){state.textContent=s}
  function dayRef(){return doc(db,"families",familyId,"days",bridge.getDate())}
  function disconnect(){if(unsubscribe){unsubscribe();unsubscribe=null}loaded=false;lastCloud=null}
  async function watch(){
    disconnect();if(!allowed)return;
    const target=bridge.getDate();show("Loading shared schedule...");
    unsubscribe=onSnapshot(dayRef(),snap=>{
      if(bridge.getDate()!==target)return;
      loaded=true;
      if(snap.exists()){
        const value=snap.data();lastCloud=JSON.stringify(value);
        if(!writing){remotePending=true;bridge.setDay(value);remotePending=false}
        show("Synced · Changes update across signed-in devices");
      }else{lastCloud=null;show("No shared schedule for this date. Choose Upload this day to initialize it.")}
    },err=>{loaded=false;show("Sync unavailable: "+err.message)});
  }
  async function push(){
    if(!allowed||!loaded||remotePending)return;
    const data=bridge.getDay(),json=JSON.stringify(data);
    if(json===lastCloud)return;
    writing=true;
    try{await setDoc(dayRef(),data);lastCloud=json;show("Saved to family cloud")}catch(e){show("Cloud save failed; local copy retained: "+e.message)}
    finally{writing=false}
  }
  // Serialized, debounced writes. Another device may overwrite concurrent edits to the same day.
  let timer=null;
  bridge.onChange=()=>{if(!allowed||!loaded)return;clearTimeout(timer);timer=setTimeout(push,550)};
  bridge.onDateChange=()=>{clearTimeout(timer);watch()};
  login.onclick=async()=>{try{show("Signing in...");await signInWithEmailAndPassword(auth,email.value,password.value);password.value=""}catch(e){show("Sign in failed: "+e.message)}};
  logout.onclick=()=>signOut(auth);
  upload.onclick=async()=>{if(!allowed)return;if(!confirm("Replace the shared schedule for this date with this device's local schedule?"))return;loaded=true;await push()};
  onAuthStateChanged(auth,async user=>{
    disconnect();allowed=false;logout.hidden=!user;upload.hidden=true;login.hidden=!!user;email.hidden=!!user;password.hidden=!!user;
    if(!user){show("Sign in to synchronize. Local mode is still available.");return}
    try{
      const membership=await getDoc(doc(db,"families",familyId,"members",user.uid));
      if(!membership.exists()){show("Account has no family membership. Ask the administrator to add your UID.");return}
      allowed=true;upload.hidden=false;await watch();
    }catch(e){show("Membership check failed: "+e.message)}
  });
}
