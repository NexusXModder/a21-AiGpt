/* FRONTEND - calls Render backend at /api/generate
   Keeps Firebase training (admin) client-side (Option A)
*/

/* Firebase config (client-side) */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCSgJ3dP9iOcp-yc-pZqh2e8kynygrs2sk",
  authDomain: "ai-21gpt.firebaseapp.com",
  projectId: "ai-21gpt",
  storageBucket: "ai-21gpt.firebasestorage.app",
  messagingSenderId: "1032282591164",
  appId: "1:1032282591164:web:1d99408401f0e8025165b9",
  measurementId: "G-FSEJP366FD",
  databaseURL: "https://ai-21gpt-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();

/* DOM refs */
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const modelSelect = document.getElementById('model');
const adminBtn = document.getElementById('adminBtn');
const toast = document.getElementById('toast');

function showToast(msg, ms=2500){ toast.innerText = msg; toast.classList.remove('hidden'); setTimeout(()=>toast.classList.add('hidden'), ms); }
function addMsg(text, cls='bot'){ const el=document.createElement('div'); el.className='msg '+cls; el.innerText=text; chat.appendChild(el); chat.scrollTop=chat.scrollHeight; return el; }

/* Load training */
let training = [];
async function loadTraining(){ const s = await db.ref('prompts/training').once('value'); const d = s.val() || {}; training = Object.keys(d).map(k=>d[k].text); }
loadTraining();

function buildPrompt(userMessage){ const t = training.join('\n---\n'); return (t ? t + '\n\n' : '') + 'User: ' + userMessage + '\nAssistant:'; }

/* Call our backend on Render */
async function callBackend(prompt, model){
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model })
  });
  if(!res.ok){
    const txt = await res.text();
    throw new Error(txt || ('HTTP ' + res.status));
  }
  return await res.json(); // { text, raw }
}

async function sendMessage(){
  const text = input.value.trim(); if(!text) return; input.value=''; addMsg(text,'user'); showToast('Thinking...');
  const prompt = buildPrompt(text); const model = modelSelect.value;
  const placeholder = addMsg('...', 'bot');
  try{
    const result = await callBackend(prompt, model);
    placeholder.innerText = result.text || 'No response';
  }catch(e){
    placeholder.innerText = 'Error generating response.';
    console.error(e);
    showToast('Error: '+(e.message||e));
  }
}

sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', e=>{ if(e.key==='Enter') sendMessage(); });

/* Admin actions (Option A) */
adminBtn.addEventListener('click', async ()=>{
  const pass = prompt('Enter admin password:');
  if(pass !== 'arafmahbub@16'){ alert('Wrong'); return; }
  const action = prompt('1 Add training\\n2 View training\\n3 Clear training','1');
  if(action === '1'){ const t = prompt('Enter training text:'); if(t){ await db.ref('prompts/training').push({ text: t, createdAt: Date.now() }); await loadTraining(); alert('Saved'); } }
  if(action === '2'){ await loadTraining(); alert(training.join('\\n\\n---\\n\\n') || 'No training'); }
  if(action === '3'){ if(confirm('Clear all training?')){ await db.ref('prompts/training').remove(); training=[]; alert('Cleared'); } }
});