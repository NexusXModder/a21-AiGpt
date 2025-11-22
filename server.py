# server.py (FINAL FIXED VERSION)
import os
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
from google import genai as gemini
import base64

load_dotenv()

# Set the template folder to the current directory for easy access to HTML files
app = Flask(__name__, template_folder='.') 

# Configuration
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

# Client Initialisation
try:
    # Initialize the client using the environment variable
    client = gemini.Client(api_key=os.getenv("GEMINI_API_KEY"))
except Exception as e:
    # This prevents the server from crashing if API key is missing during deployment
    print(f"Warning: Gemini Client initialization failed. Check API Key. Error: {e}")
    client = None 

# Simple in-memory knowledge base (RAG Simulation)
knowledge_base = [] 

# --- Admin (Learning) Endpoint ---

@app.route('/admin_login', methods=['POST'])
def admin_login():
    """Handles admin login for accessing the learning panel."""
    data = request.json
    password = data.get('password')
    
    # Check against the secure server-side environment variable
    if password == ADMIN_PASSWORD:
        return jsonify({"success": True, "message": "Login successful!"})
    return jsonify({"success": False, "message": "Incorrect password."}), 401

@app.route('/learn', methods=['POST'])
def learn_content():
    """Endpoint for the admin to upload text or images to teach the AI."""
    # Authenticate using the password sent from the admin panel
    if request.form.get('admin_pass') != ADMIN_PASSWORD:
        return jsonify({"error": "Unauthorized Access"}), 401
    
    if not client:
        return jsonify({"error": "AI Client not initialized. Check API Key."}), 500

    text_input = request.form.get('text_input')
    uploaded_file = request.files.get('file')

    global knowledge_base

    # Check for image content (currently disabled for stability)
    if uploaded_file:
        return jsonify({"error": "Image learning functionality is disabled for stability during deployment fix."}), 501
    
    # Process text content
    if text_input:
        knowledge_base.append(f"Learned from text: {text_input}")
        return jsonify({"success": True, "message": "Learned from text successfully."})
        
    return jsonify({"error": "No content provided."}), 400


# --- User (Question) Endpoint ---

@app.route('/ask', methods=['POST'])
def ask_ai():
    """Endpoint for users to ask math/physics questions."""
    data = request.json
    question = data.get('question')

    if not question:
        return jsonify({"error": "No question provided."}), 400
    
    if not client:
        return jsonify({"error": "AI Client not initialized. Check API Key."}), 500


    # Retrieve knowledge and add it to the prompt (RAG Simulation)
    context = "\n".join(knowledge_base)
    
    full_prompt = (
        f"You are an HSC-level Math and Physics Tutor for students in Bangladesh. "
        f"You have the following supplementary information from textbooks/notes that you MUST use to answer the question: \n---Knowledge Base---\n{context}\n---\n"
        f"Now, provide a detailed and accurate solution to the question below. Respond in Bengali (Bangla) for the user's ease of understanding. "
        f"Question: {question}"
    )

    try:
        # Call the Gemini API
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=full_prompt 
        ) 
        return jsonify({"answer": response.text})
    except Exception as e:
        # Catch any API errors
        return jsonify({"error": f"AI error: {str(e)}"}), 500

# --- Routes for HTML Pages ---

@app.route('/')
def index():
    # Renders the main chat/landing page
    return render_template('index.html')

@app.route('/admin')
def admin():
    # Renders the admin login/learning page
    return render_template('admin.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
