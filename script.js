
/* CONFIG - Keys embedded as requested */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCSgJ3dP9iOcp-yc-pZqh2e8kynygrs2sk",
  authDomain: "ai-21gpt.firebaseapp.com",
  projectId: "ai-21gpt",
  storageBucket: "ai-21gpt.firebasestorage.app",
  messagingSenderId: "1032282591164",
  appId: "1:1032282591164:web:1d99408401f0e8025165b9",
  measurementId: "G-FSEJP366FD",
  databaseURL: "https://ai-21gpt-default-rtdb.firebaseio.com"
};
const GEMINI_KEY = "AIzaSyAvMiWCYmWbGLfr4HZSEayJ61tBhOLUBik";
const ADMIN_PASSWORD = "arafmahbub@16";
/* END CONFIG */

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();

// UI refs
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const modelSelect = document.getElementById('model');
const adminBtn = document.getElementById('adminBtn');
const toast = document.getElementById('toast');

function showToast(msg, ms=2500){ toast.innerText = msg; toast.classList.remove('hidden'); setTimeout(()=>toast.classList.add('hidden'), ms) }

// push & render helpers
function renderMessage(text, cls='bot'){
  const el = document.createElement('div');
  el.className = 'msg ' + cls;
  el.innerText = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function pushToFirebase(role, text){
  const ref = db.ref('chats/default').push();
  return ref.set({ role, text, createdAt: Date.now() });
}

// listen for realtime updates (live mirror)
db.ref('chats/default').on('value', snap => {
  const data = snap.val() || {};
  chat.innerHTML = '';
  const arr = Object.keys(data).map(k => ({ id:k, ...data[k] }));
  arr.sort((a,b)=>a.createdAt - b.createdAt);
  for(const m of arr) {
    renderMessage(m.text, m.role === 'user' ? 'user' : 'bot');
  }
});

// read system prompt
let systemPrompt = '';
db.ref('prompts/system').on('value', s => { const v = s.val(); if(v && v.text) systemPrompt = v.text; });

// Gemini request function for generateContent
async function callGemini(prompt, model='gemini-1.5-flash'){
  // Use generateContent endpoint with correct body shape
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const body = {
    "prompt": {
      "text": prompt
    },
    "temperature": 0.2,
    "maxOutputTokens": 512
  };
  try {
    const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    if(!res.ok){
      const txt = await res.text();
      throw new Error('HTTP ' + res.status + ': ' + txt);
    }
    const j = await res.json();
    // parse text from different possible shapes
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || j?.output?.text || (j?.candidates?.[0]?.content?.text) || JSON.stringify(j);
    return text;
  } catch(e){
    console.error('Gemini error', e);
    throw e;
  }
}

async function sendMessage(){
  const text = input.value.trim();
  if(!text) return;
  input.value = '';
  // optimistic render + push
  renderMessage(text, 'user');
  await pushToFirebase('user', text);
  // compose prompt
  // fetch last 8 messages to include context
  const snap = await db.ref('chats/default').once('value');
  const data = snap.val() || {};
  const arr = Object.keys(data).map(k => ({ id:k, ...data[k] }));
  arr.sort((a,b)=>a.createdAt - b.createdAt);
  const last = arr.slice(-8).map(m => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.text).join('\n');
  const finalPrompt = (systemPrompt ? 'System: ' + systemPrompt + '\n\n' : '') + last + '\nUser: ' + text;
  // show typing placeholder
  const typing = renderMessage('...', 'bot');
  try{
    const model = modelSelect.value || 'gemini-1.5-flash';
    const ai = await callGemini(finalPrompt, model);
    typing.innerText = ai;
    await pushToFirebase('assistant', ai);
  } catch(e){
    typing.innerText = 'Error generating response. See console.';
    showToast('Failed to reach Gemini: ' + (e.message || e));
  }
}

sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', e => { if(e.key === 'Enter') sendMessage(); });

// Admin quick modal using prompt()
adminBtn.addEventListener('click', async ()=>{
  const pass = prompt('Enter admin password:');
  if(pass !== ADMIN_PASSWORD){ alert('Wrong password'); return; }
  const action = prompt('Type: 1 to set system prompt, 2 to clear chat, 3 to view/edit teaching data (training)');
  if(action === '1'){
    const s = prompt('Enter system prompt:', systemPrompt);
    if(s !== null) { await db.ref('prompts/system').set({ text: s, updatedAt: Date.now() }); alert('Saved'); }
  } else if(action === '2'){
    if(confirm('Clear all chat?')){ await db.ref('chats/default').remove(); alert('Cleared'); }
  } else if(action === '3'){
    const tSnap = await db.ref('prompts/training').once('value');
    const curr = tSnap.val() || {};
    const currText = Object.keys(curr).map(k=>curr[k].text).join('\n---\n');
    const newText = prompt('Edit training examples (separate with \n---\n):', currText);
    if(newText !== null){
      // replace training with new items
      await db.ref('prompts/training').remove();
      const parts = newText.split('\n---\n').map(s=>s.trim()).filter(Boolean);
      for(const p of parts){ await db.ref('prompts/training').push({ text: p, createdAt: Date.now() }); }
      alert('Training updated'); 
    }
  }
});
