async function sendMessage() {
  const input = document.getElementById("userInput").value.trim();
  if (!input) return;

  addMessage(input, "user");
  document.getElementById("userInput").value = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input })
    });

    const data = await res.json();

    if (!data.reply) {
      addMessage("Error generating response.", "bot");
      console.error(data);
      return;
    }

    addMessage(data.reply, "bot");
  } catch (err) {
    addMessage("Error generating response.", "bot");
    console.error(err);
  }
}

function addMessage(text, sender) {
  const box = document.getElementById("chatBox");
  const msg = document.createElement("div");
  msg.className = sender === "user" ? "userMsg" : "botMsg";
  msg.innerText = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}