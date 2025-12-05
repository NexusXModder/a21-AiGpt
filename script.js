/* === CONFIG (embedded) === */
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

const GEMINI_KEY = "AIzaSyAvMiWCYmWbGLfr4HZSEayJ61tBhOLUBik";
const ADMIN_PASSWORD = "arafmahbub@16";
/* ========================= */

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();

// UI refs
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const modelSelect = document.getElementById('model');
const adminBtn = document.getElementById('adminBtn');
const toast = document.getElementById('toast');

function showToast(msg, ms=3000){
  toast.innerText = msg;
  toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'), ms);
}

function renderMessage(text, cls='bot'){
  const el = document.createElement('div');
  el.className = 'msg ' + cls;
  el.innerText = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

// Load admin training pieces
let trainingPieces = [];
async function loadTraining(){
  const snap = await db.ref('prompts/training').once('value');
  const data = snap.val() || {};
  trainingPieces = Object.keys(data).map(k => data[k].text);
}
loadTraining();

function buildPrompt(userMessage){
  const trainingText = trainingPieces.join('\n---\n');
  return (trainingText ? trainingText + '\n\n' : '') +
         'User: ' + userMessage + '\nAssistant:';
}

/* =========================================
   🔥 FIXED GEMINI v1 API — CORRECT FORMAT
========================================= */
async function callGemini(prompt, model='gemini-1.5-flash') {
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_KEY}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Gemini HTTP " + res.status + ": " + errText);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text
         || "No response from Gemini.";
}

/* SEND MESSAGE */
async function sendMessage(){
  const text = input.value.trim();
  if(!text) return;

  input.value = '';
  renderMessage(text, 'user');
  showToast('Thinking...');

  const finalPrompt = buildPrompt(text);
  const model = modelSelect.value || 'gemini-1.5-flash';

  const placeholder = renderMessage('...', 'bot');

  try {
    const reply = await callGemini(finalPrompt, model);
    placeholder.innerText = reply;
    showToast('Response ready');
  } catch (err) {
    console.error(err);
    placeholder.innerText = '❌ Error: ' + err.message;
    showToast('Error talking to Gemini');
  }
}

// events
sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', e => {
  if(e.key === 'Enter') sendMessage();
});

// Admin panel
adminBtn.addEventListener('click', async ()=>{
  const pass = prompt('Enter admin password:');
  if(pass !== ADMIN_PASSWORD){ alert('Wrong password'); return; }

  const action = prompt(
    'Admin actions:\n1) Add training\n2) View training\n3) Clear training', 
    '1'
  );

  if(action === '1'){
    const t = prompt('Enter training text:');
    if(t){
      await db.ref('prompts/training').push({ text: t, createdAt: Date.now() });
      await loadTraining();
      alert('Training added.');
    }
  }
  else if(action === '2'){
    await loadTraining();
    alert(trainingPieces.join('\n\n---\n\n') || 'No training saved');
  }
  else if(action === '3'){
    if(confirm('Clear ALL training?')){
      await db.ref('prompts/training').remove();
      await loadTraining();
      alert('Training cleared.');
    }
  }
});