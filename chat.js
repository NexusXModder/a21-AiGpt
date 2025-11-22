// Chat UI client — sends POST JSON to /ask with {"question": "..."}
const chatWindow = document.getElementById('chatWindow');
const chatForm = document.getElementById('chatForm');
const questionInput = document.getElementById('question');
const sendBtn = document.getElementById('sendBtn');

function appendBubble(text, cls){
  const div = document.createElement('div');
  div.className = 'chat-bubble ' + cls;
  div.innerHTML = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendLoading(){
  const div = document.createElement('div');
  div.className = 'chat-bubble bubble-ai';
  div.id = 'loadingDots';
  div.innerHTML = '<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeLoading(){
  const d = document.getElementById('loadingDots');
  if(d) d.remove();
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = questionInput.value.trim();
  if(!q) return;
  appendBubble(escapeHtml(q), 'bubble-user');
  questionInput.value = '';
  appendLoading();

  try{
    const res = await fetch('/ask', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({question: q})
    });

    if(!res.ok){
      removeLoading();
      appendBubble('Server error: ' + res.statusText, 'bubble-ai');
      return;
    }

    const data = await res.json();
    // Expecting { answer: "..." } or {response: "..."}; pick best available
    const answer = data.answer || data.response || data.result || JSON.stringify(data);
    removeLoading();
    appendBubble(escapeHtml(answer), 'bubble-ai');
  }catch(err){
    removeLoading();
    appendBubble('Network error: ' + err.message, 'bubble-ai');
  }
});

function escapeHtml(unsafe){
  return unsafe.replace(/[&<"'>]/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]; });
}
