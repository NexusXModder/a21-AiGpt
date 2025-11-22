# server.py (FINAL FIXED VERSION - Persistence Added)
import os
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
from google import genai as gemini
from google.genai.errors import APIError
import base64

load_dotenv()

# Set the template folder to the current directory for easy access to HTML files
app = Flask(__name__, template_folder='.') 

# Configuration
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
KNOWLEDGE_FILE = "knowledge_base.txt" # 💡 নতুন: ডেটা সংরক্ষণের জন্য ফাইলের নাম

# --- Persistence Functions ---

def load_knowledge():
    """Loads knowledge from the persistence file on server startup."""
    if os.path.exists(KNOWLEDGE_FILE):
        try:
            with open(KNOWLEDGE_FILE, 'r', encoding='utf-8') as f:
                # Read lines and strip any blank spaces, ignoring empty lines
                return [line.strip() for line in f.readlines() if line.strip()]
        except Exception as e:
            print(f"Error loading knowledge file: {e}")
            return []
    return []

def save_knowledge(knowledge_list):
    """Saves the current knowledge list to the persistence file."""
    try:
        with open(KNOWLEDGE_FILE, 'w', encoding='utf-8') as f:
            f.write("\n".join(knowledge_list))
    except Exception as e:
        print(f"Error saving knowledge file: {e}")

# Client Initialisation
try:
    client = gemini.Client(api_key=os.getenv("GEMINI_API_KEY"))
except Exception as e:
    print(f"Warning: Gemini Client initialization failed. Check API Key. Error: {e}")
    client = None 

# Simple in-memory knowledge base (RAG Simulation)
knowledge_base = load_knowledge() # 💡 CRITICAL: সার্ভার স্টার্ট হওয়ার সময় ফাইল থেকে ডেটা লোড করা হচ্ছে।

# --- Admin Authentication Endpoint ---

@app.route('/admin_login', methods=['POST'])
def admin_login():
    """Handles admin login for accessing the learning panel."""
    data = request.json
    password = data.get('password')
    
    if password == ADMIN_PASSWORD:
        return jsonify({"success": True, "message": "Login successful!"})
    return jsonify({"success": False, "message": "Incorrect password."}), 401

# --- Admin Learning Endpoint (Accessed via /teach page) ---

@app.route('/learn', methods=['POST'])
def learn_content():
    """Endpoint for the admin to upload text or images to teach the AI."""
    # Authenticate using the password sent from the admin page
    if request.form.get('admin_pass') != ADMIN_PASSWORD:
        return jsonify({"error": "Unauthorized Access"}), 401
    
    if not client:
        return jsonify({"error": "AI Client not initialized. Check API Key."}), 500

    text_input = request.form.get('text_input')
    uploaded_file = request.files.get('file')

    global knowledge_base

    # IMAGE LEARNING
    if uploaded_file:
        if uploaded_file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        try:
            image_part = gemini.types.Part.from_bytes(
                data=uploaded_file.read(),
                mime_type=uploaded_file.content_type
            )
            
            prompt = (
                "The following image contains a mathematical or physics concept, formula, "
                "or problem from an HSC-level textbook. Analyze it, summarize the key information, "
                "and integrate this knowledge into your base to solve future user questions. "
                "Confirm learning with the message: 'New content added to knowledge base from image.'"
            )
            
            response = client.models.generate_content(
                contents=[prompt, image_part], 
                model='gemini-2.5-flash'
            )
            
            knowledge_base.append(f"Learned from image summary: {response.text}")
            save_knowledge(knowledge_base) # 💡 CRITICAL: নতুন ডেটা যুক্ত হওয়ার পর সেভ করা হচ্ছে।

            return jsonify({"success": True, "message": f"Successfully learned from image. Model response: {response.text}"})

        except APIError as e:
            return jsonify({"error": f"Gemini API Error: {str(e)}"}), 500
        except Exception as e:
            return jsonify({"error": f"Server Error during image learning: {str(e)}"}), 500
    
    # TEXT LEARNING
    if text_input:
        knowledge_base.append(f"Learned from text: {text_input}")
        save_knowledge(knowledge_base) # 💡 CRITICAL: নতুন ডেটা যুক্ত হওয়ার পর সেভ করা হচ্ছে।
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


    # Retrieve knowledge from the loaded list
    context = "\n".join(knowledge_base)
    
    full_prompt = (
        f"You are an HSC-level Math and Physics Tutor for students in Bangladesh. "
        f"You have the following supplementary information from textbooks/notes that you MUST use to answer the question: \n---Knowledge Base---\n{context}\n---\n"
        f"Now, provide a detailed and accurate solution to the question below. The solution MUST be formatted using **bolding** for steps and headings, and using $...$ for mathematical expressions/formulas, like a proper guidebook. Respond ONLY in Bengali (Bangla). "
        f"Question: {question}"
    )

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=full_prompt 
        ) 
        return jsonify({"answer": response.text})
    except Exception as e:
        return jsonify({"error": f"AI error: {str(e)}"}), 500

# --- Routes for HTML Pages ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/teach')
def teach():
    return render_template('teach.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
