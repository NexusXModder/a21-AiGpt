/* === CONFIG === */
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

function showToast(msg, ms = 2000) {
  toast.innerText = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), ms);
}

function renderMessage(text, cls = 'bot') {
  const el = document.createElement('div');
  el.className = 'msg ' + cls;
  el.innerText = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

// Load admin training
let trainingPieces = [];
async function loadTraining() {
  const snap = await db.ref('prompts/training').once('value');
  const data = snap.val() || {};
  trainingPieces = Object.keys(data).map(k => data[k].text);
}
loadTraining();

function buildPrompt(userMsg) {
  const training = trainingPieces.join("\n---\n");
  return training + "\nUser: " + userMsg + "\nAssistant:";
}

// FIXED GEMINI CALL (NO INVALID FIELDS)
async function callGemini(prompt, model) {

  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${GEMINI_KEY}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw await res.text();
  }

  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.content?.[0]?.text ||
    "No response"
  );
}

// Send message
async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  renderMessage(text, "user");

  const prompt = buildPrompt(text);
  const model = modelSelect.value;

  const placeholder = renderMessage("...", "bot");

  try {
    const reply = await callGemini(prompt, model);
    placeholder.innerText = reply;
  } catch (err) {
    placeholder.innerText = "Error generating response.";
    console.error(err);
  }
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", e => e.key === "Enter" && sendMessage());

// Admin panel
adminBtn.addEventListener("click", async () => {
  const pass = prompt("Enter admin password:");
  if (pass !== ADMIN_PASSWORD) return alert("Wrong password");

  const action = prompt("1) Add\n2) View\n3) Clear", "1");

  if (action === "1") {
    const t = prompt("Enter training:");
    if (t) {
      await db.ref("prompts/training").push({
        text: t,
        createdAt: Date.now()
      });
      await loadTraining();
      alert("Saved");
    }
  }

  if (action === "2") {
    await loadTraining();
    alert(trainingPieces.join("\n---\n") || "No training saved");
  }

  if (action === "3") {
    if (confirm("Delete all?")) {
      await db.ref("prompts/training").remove();
      await loadTraining();
      alert("Cleared");
    }
  }
});