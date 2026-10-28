import {initializeApp,getApps} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,EmailAuthProvider,reauthenticateWithCredential} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,doc,getDoc} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {firebaseConfig,familyId} from "./firebase-config.js";
const app=getApps()[0]||initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const profiles=[["dad","Dad","dad.webp"],["mom","Mom","mom.webp"],["14","Age 14","age-14.webp"],["13","Age 13","age-13.webp"],["9","Age 9","age-9.webp"]];
const gate=document.getElementById("familyGate"),ui=document.getElementById("familyGateUI");
let selected=null,mode="unlock",parent=null,member=null,authProblem="";
const storageKey="homeschoolable-family-pin-v1";
const getPins=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||"{}")}catch{return {}}};
const savePins=x=>localStorage.setItem(storageKey,JSON.stringify(x));
const salt=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,"0")).join("");
async function hash(pin,s){const data=new TextEncoder().encode(s+":"+pin);const d=await crypto.subtle.digest("SHA-256",data);return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,"0")).join("")}
function msg(t){const el=document.getElementById("pinMessage");if(el)el.textContent=t}
function lock(){document.body.classList.remove("family-unlocked");selected=null;mode="unlock";render()}
function unlock(id){document.body.classList.add("family-unlocked");document.getElementById("activeFamilyProfile").textContent=profiles.find(x=>x[0]===id)?.[1]||id;window.familyPlannerActiveProfile=id;window.familyPlannerSelectProfile?.(id)}
async function verifyParent(){if(!auth.currentUser||!parent)return false;const password=prompt("Enter your parent account password to authorize this change:");if(!password)return false;try{await reauthenticateWithCredential(auth.currentUser,EmailAuthProvider.credential(auth.currentUser.email,password));return true}catch{alert("Parent password verification failed.");return false}}
function render(){
if(!auth.currentUser){ui.innerHTML='<p>Sign in with Dad or Mom’s Firebase account.</p><form id="familyEmailForm"><input id="familyEmail" type="email" required placeholder="Parent email" autocomplete="username"><input id="familyPassword" type="password" required placeholder="Password" autocomplete="current-password"><button type="submit">Sign in</button></form><p id="pinMessage" role="status"></p>';document.getElementById("familyEmailForm").onsubmit=async e=>{e.preventDefault();msg("Signing in…");try{await signInWithEmailAndPassword(auth,document.getElementById("familyEmail").value,document.getElementById("familyPassword").value)}catch{msg("Sign-in failed. Check your email and password.")}};return}
if(!member){ui.innerHTML='<p>Signed in as: '+auth.currentUser.email+'</p><p id="pinMessage" role="status">'+authProblem+'</p><button id="familyAccountSwitch">Switch account</button>';document.getElementById("familyAccountSwitch").onclick=()=>signOut(auth);return}
const items=profiles.map(([id,name,image])=>'<button type="button" class="familyAvatar" data-profile="'+id+'"><img src="'+image+'" alt="" width="85" height="85"><span>'+name+'</span></button>').join("");
ui.innerHTML='<p>Choose a profile. PIN required each time you open the planner.</p><div class="familyAvatars">'+items+'</div><div id="familyPinPanel"></div><p id="pinMessage" role="status"></p><button id="familyAccountSwitch" type="button">Switch parent account</button>';
document.querySelectorAll(".familyAvatar").forEach(b=>b.onclick=()=>choose(b.dataset.profile));
document.getElementById("familyAccountSwitch").onclick=()=>signOut(auth);
if(selected)choose(selected)
}
function choose(id){
selected=id;const record=getPins()[id];mode=record?"unlock":"setup";
const label=profiles.find(p=>p[0]===id)[1],panel=document.getElementById("familyPinPanel");
document.querySelectorAll(".familyAvatar").forEach(b=>b.classList.toggle("selected",b.dataset.profile===id));
panel.innerHTML='<h2>'+label+'</h2><p>'+(record?"Enter your six-digit PIN.":"Set a six-digit PIN. Parent approval is required.")+'</p><form id="familyPinForm"><input id="familyPinInput" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" required autocomplete="off" placeholder="Six-digit PIN"><button type="submit">'+(record?"Unlock":"Set PIN")+'</button></form>'+(record?'<button type="button" id="familyPinReset">Reset PIN (parent)</button>':'');
document.getElementById("familyPinForm").onsubmit=submit;
const reset=document.getElementById("familyPinReset");if(reset)reset.onclick=async()=>{if(!await verifyParent())return;const pins=getPins();delete pins[id];savePins(pins);choose(id);msg("PIN reset. Choose a new PIN.")};
document.getElementById("familyPinInput").focus()
}
async function submit(e){
e.preventDefault();const id=selected,pin=document.getElementById("familyPinInput").value;if(!/^\d{6}$/.test(pin)){msg("Enter exactly six digits.");return}
const pins=getPins(),record=pins[id];
if(record){
const digest=await hash(pin,record.salt);
if(digest!==record.hash){msg("Incorrect PIN.");document.getElementById("familyPinInput").value="";return}
if((id==="dad"||id==="mom")&&parent!==id){msg("This parent profile requires its own Firebase account.");return}
unlock(id);return
}

if((id==="dad"||id==="mom")&&parent!==id){msg("Sign in with this parent's Firebase account to create their PIN.");return}
if(!await verifyParent())return;
const s=salt();pins[id]={salt:s,hash:await hash(pin,s)};savePins(pins);msg("PIN created.");unlock(id)
}
onAuthStateChanged(auth,async user=>{
document.body.classList.remove("family-unlocked");member=null;parent=null;selected=null;authProblem="";
if(user){
try{
const m=await getDoc(doc(db,"families",familyId,"members",user.uid));
if(!m.exists())authProblem="No family membership document found for this account.";
else{
member=m.data();
const email=(user.email||"").trim().toLowerCase();
if(email==="dekkah2000@gmail.com")parent="dad";
else if(email==="channie_bananie@yahoo.ca")parent="mom";
else authProblem="This member is not one of the configured parent accounts.";
if(!parent)member=null;
}
}catch(e){authProblem="Could not read membership: "+(e.code||e.message)}
}
render();
});

document.getElementById("lockFamily").onclick=lock;
document.getElementById("changeFamilyPin").onclick=async()=>{const id=window.familyPlannerActiveProfile;if(!id||!await verifyParent())return;const pins=getPins();delete pins[id];savePins(pins);lock();selected=id;choose(id);msg("Choose a new PIN.")};
