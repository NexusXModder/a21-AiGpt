
// Firebase Config (Public as requested)
const firebaseConfig = {
  apiKey: "AIzaSyCSgJ3dP9iOcp-yc-pZqh2e8kynygrs2sk",
  authDomain: "ai-21gpt.firebaseapp.com",
  projectId: "ai-21gpt",
  storageBucket: "ai-21gpt.firebasestorage.app",
  messagingSenderId: "1032282591164",
  appId: "1:1032282591164:web:1d99408401f0e8025165b9",
  measurementId: "G-FSEJP366FD",
  databaseURL: "https://ai-21gpt-default-rtdb.firebaseio.com"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Admin Password
const ADMIN_PASS = "arafmahbub@16";
const GEMINI_KEY = "AIzaSyAvMiWCYmWbGLfr4HZSEayJ61tBhOLUBik";

// Teaching storage
let teaching = "";
db.ref("teaching").on("value", snap => {
  if (snap.exists()) teaching = snap.val();
});

// Chat system
function addMessage(text, isUser = false) {
  const c = document.getElementById("chat");
  const div = document.createElement("div");

  div.className =
    "max-w-[80%] p-3 rounded-2xl whitespace-pre-wrap " +
    (isUser
      ? "ml-auto bg-gradient-to-br from-indigo-500 to-pink-600"
      : "bg-white/10 border border-white/10");

  div.innerText = text;
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}

async function send() {
  const input = document.getElementById("msg");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  addMessage(text, true);

  const fullPrompt = teaching + "\nUser: " + text + "\nAI:";

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }]
      })
    }
  );

  const data = await res.json();
  const ai =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || "Error generating response.";

  addMessage(ai, false);
}

document.getElementById("sendBtn").onclick = send;
document.getElementById("msg").onkeydown = e => { if (e.key === "Enter") send(); };

// Admin Panel Trigger
document.getElementById("adminBtn").onclick = () => {
  const pass = prompt("Enter admin password:");
  if (pass === ADMIN_PASS) {
    const newTeach = prompt("Enter new training data:", teaching);
    if (newTeach !== null) {
      db.ref("teaching").set(newTeach);
      alert("AI retrained successfully!");
    }
  } else {
    alert("Wrong password.");
  }
};
