# server.py (FINAL FIX: Login and Teach pages separated, Image Learning Enabled)
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

# --- Admin Authentication Endpoint ---

@app.route('/admin_login', methods=['POST'])
def admin_login():
    """Handles admin login for accessing the learning panel."""
    data = request.json
    password = data.get('password')
    
    # Check against the secure server-side environment variable
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

    # ✅ IMAGE LEARNING ENABLED AND FIXED
    if uploaded_file:
        if uploaded_file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        try:
            # Create a Part from the uploaded image file
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
            
            # Send the image and prompt to the model
            response = client.models.generate_content(
                contents=[prompt, image_part], 
                model='gemini-2.5-flash'
            )
            
            knowledge_base.append(f"Learned from image summary: {response.text}")

            return jsonify({"success": True, "message": f"Successfully learned from image. Model response: {response.text}"})

        except APIError as e:
            return jsonify({"error": f"Gemini API Error: {str(e)}"}), 500
        except Exception as e:
            return jsonify({"error": f"Server Error during image learning: {str(e)}"}), 500
    
    # TEXT LEARNING
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
    # Renders the dedicated login page
    return render_template('admin.html')

@app.route('/teach')
def teach():
    # Renders the dedicated teaching content page
    return render_template('teach.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
