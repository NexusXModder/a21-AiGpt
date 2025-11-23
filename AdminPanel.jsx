import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { Sparkles, Loader2, Save, Send, Upload, Lock, Unlock, Key, Database, User, Image, AlertTriangle, Trash2 } from 'lucide-react';

// --- CONFIGURATION AND CONSTANTS ---
// !!! SECURITY WARNING: REPLACE THIS PASSWORD BEFORE DEPLOYMENT !!!
const ADMIN_PASSWORD = "arafmahbub@16"; // <--- CHANGE THIS
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit for image upload
const KNOWLEDGE_DOC_PATH = "ai_knowledge/master_doc"; // Public path for landing page to read

// localStorage Keys
const LS_API_KEY = "adminApiKey";
const LS_REMEMBER_ME_FLAG = "rememberApiKey";

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- FIREBASE INITIALIZATION AND HOOKS ---
let firebaseApp, db, auth;

if (firebaseConfig) {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}

// Custom hook for authentication and initialization
const useFirebaseInit = () => {
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firebaseApp) {
      setError("Firebase configuration is missing.");
      return;
    }

    const signIn = async () => {
      try {
        // Use custom token if available, otherwise sign in anonymously
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Firebase Auth Error:", e);
        setError("Failed to sign in to Firebase.");
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      }
      setIsAuthReady(true);
    });

    signIn();
    return () => unsubscribe();
  }, []);

  return { userId, isAuthReady, error, db, auth };
};

// --- API HELPER FUNCTION ---
const generateContentWithRetry = async (payload, apiKey, retries = 3) => {
    if (!apiKey) throw new Error("API Key is missing.");
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const executeFetch = async (attempt) => {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}: ${await response.text()}`);
            }

            return await response.json();
        } catch (error) {
            console.warn(`Attempt ${attempt + 1} failed:`, error.message);
            if (attempt < retries - 1) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return executeFetch(attempt + 1);
            }
            throw new Error("Failed to communicate with Gemini API after multiple retries. Check API key validity.");
        }
    };

    return executeFetch(0);
};

// --- LOGIN COMPONENT ---
const LoginScreen = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    
    // Load saved API key and remember me state from localStorage on mount
    useEffect(() => {
        const savedApiKey = localStorage.getItem(LS_API_KEY);
        const savedRemember = localStorage.getItem(LS_REMEMBER_ME_FLAG) === 'true';

        if (savedApiKey) {
            setApiKey(savedApiKey);
        }
        setRememberMe(savedRemember);
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        
        // 1. Validate Password against hardcoded constant
        if (password !== ADMIN_PASSWORD) {
            setError('Incorrect admin password.');
            return;
        }
        
        // 2. Validate API Key
        if (!apiKey.trim()) {
            setError('Please provide your Gemini API Key.');
            return;
        }

        // 3. Handle localStorage based on checkbox state
        if (rememberMe) {
            localStorage.setItem(LS_API_KEY, apiKey.trim());
            localStorage.setItem(LS_REMEMBER_ME_FLAG, 'true');
        } else {
            localStorage.removeItem(LS_API_KEY);
            localStorage.removeItem(LS_REMEMBER_ME_FLAG);
        }

        // 4. Proceed to Dashboard
        onLogin(apiKey.trim());
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl">
                <div className="text-center mb-6">
                    <Lock className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                    <h2 className="text-2xl font-bold text-gray-800">Admin Access Required</h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Enter credentials to access the AI knowledge panel.
                    </p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="******"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                        <div className="relative">
                            <Key size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="AIzaSy..."
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                                Remember API Key
                            </label>
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-center">
                            <AlertTriangle size={16} className="mr-2" />
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition duration-150 ease-in-out"
                    >
                        <Unlock size={20} className="mr-2" />
                        Access Dashboard
                    </button>
                </form>
            </div>
        </div>
    );
};


// --- MAIN REACT COMPONENT ---
const App = () => {
  const { userId, isAuthReady, error, db } = useFirebaseInit();
  const [apiKey, setApiKey] = useState(null); // Stores the user's API key after login
  const [knowledgeText, setKnowledgeText] = useState(""); // Stored text
  const [knowledgeImageBase64, setKnowledgeImageBase64] = useState(null); // Stored image (Base64)
  const [knowledgeInput, setKnowledgeInput] = useState(""); // Input text area
  const [imageFile, setImageFile] = useState(null); // Currently selected file
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' or 'error'

  // **CRITICAL CHANGE:** Use the public path so the public landing page can read it.
  const PUBLIC_KNOWLEDGE_PATH = `/artifacts/${appId}/public/data/${KNOWLEDGE_DOC_PATH}`;

  // 1. Handle Login
  const handleLoginSuccess = (key) => {
    setApiKey(key);
  };

  // 2. Image File Handler
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);
    setKnowledgeImageBase64(null); // Clear previous base64 while loading

    if (file) {
        if (file.size > MAX_FILE_SIZE) {
            // Use console error/message instead of alert()
            console.error(`File size exceeds 1MB limit. Please choose a smaller file.`);
            setImageFile(null);
            return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
            setKnowledgeImageBase64(reader.result);
        };
        reader.readAsDataURL(file);
    } 
  };
  
  // 3. Firestore Listener to load the AI Knowledge Base
  useEffect(() => {
    if (!isAuthReady || !userId || !db || !apiKey) return;

    const docRef = doc(db, PUBLIC_KNOWLEDGE_PATH);
    
    // Setup real-time listener for public knowledge document
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setKnowledgeText(data.content || "");
        setKnowledgeInput(data.content || ""); 
        setKnowledgeImageBase64(data.image || null);
        setImageFile(null); // Reset file input state after sync
      } else {
        setKnowledgeText("");
        setKnowledgeInput("");
        setKnowledgeImageBase64(null);
      }
    }, (e) => {
      console.error("Firestore real-time error:", e);
    });

    return () => unsubscribe();
  }, [isAuthReady, userId, db, apiKey]);

  // 4. Save/Update Multimodal Knowledge Base to Public Firestore
  const saveKnowledge = useCallback(async () => {
    if (!userId || !db) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const docRef = doc(db, PUBLIC_KNOWLEDGE_PATH);
      await setDoc(docRef, { 
        content: knowledgeInput, 
        image: knowledgeImageBase64, // Base64 encoded image
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      console.error("Error saving knowledge base:", e);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [userId, db, knowledgeInput, knowledgeImageBase64, PUBLIC_KNOWLEDGE_PATH]);
  
  // 5. AI Chat Interaction (Multimodal)
  const sendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isAILoading || !apiKey) return;

    const userMessage = chatInput.trim();
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput('');
    setIsAILoading(true);

    // 1. Construct the System Prompt
    const systemPrompt = `You are an AI Admin Assistant. Your primary function is to answer questions based on the uploaded "Knowledge Base" (text and image) provided below. Use the text and analyze the image to provide the most accurate, grounded answer. If a question cannot be answered using *only* this data, politely state that the information is not in your knowledge base.

--- AI Knowledge Data ---
TEXT: ${knowledgeText || "No text knowledge data uploaded yet."}
--- End of Data ---`;

    // 2. Prepare the Payload Parts
    const contents = [];
    
    // Add the user's text query
    const userParts = [{ text: userMessage }];

    // If an image is available, add it to the user's query parts for multimodal analysis
    if (knowledgeImageBase64) {
        // Extract mime type from Base64 string (e.g., data:image/jpeg;base64,...)
        const mimeMatch = knowledgeImageBase64.match(/^data:(image\/[a-zA-Z0-9\-\.]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const base64Data = knowledgeImageBase64.split(',')[1];

        userParts.unshift({
            inlineData: {
                mimeType: mimeType,
                data: base64Data
            }
        });
    }
    
    // Add the new user message (potentially with the image)
    contents.push({ role: 'user', parts: userParts });

    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    try {
        const result = await generateContentWithRetry(payload, apiKey);
        const modelResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't process that request.";

        setChatHistory(prev => [...prev, { role: 'model', text: modelResponse }]);

    } catch (e) {
        console.error("Gemini API Error:", e);
        setChatHistory(prev => [...prev, { role: 'model', text: `An error occurred: ${e.message}` }]);
    } finally {
        setIsAILoading(false);
    }
  }, [chatInput, isAILoading, apiKey, knowledgeText, knowledgeImageBase64]);
  
  const getStatusIndicator = () => {
    switch (saveStatus) {
      case 'success':
        return <span className="text-green-500 font-semibold">Saved successfully! (Public)</span>;
      case 'error':
        return <span className="text-red-500 font-semibold">Save failed.</span>;
      default:
        return null;
    }
  };

  const statusText = isAuthReady ? (
    userId ? (
      <span className="text-sm font-mono flex items-center gap-1">
        <User size={16} className="text-blue-400" />
        User ID: {userId}
      </span>
    ) : (
      "Signing in..."
    )
  ) : (
    "Initializing..."
  );

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-lg">
        Error: {error}
      </div>
    );
  }
  
  if (!apiKey) {
      return <LoginScreen onLogin={handleLoginSuccess} />;
  }


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 font-inter">
      
      {/* Header */}
      <header className="bg-white shadow-lg p-4 rounded-xl mb-4 flex justify-between items-center sticky top-4 z-10">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <Sparkles className="text-indigo-600 mr-2" size={28} />
          Secure AI Admin Server
        </h1>
        <div className="text-gray-600">
          {statusText}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left Column: Admin Panel (Knowledge Uploader) */}
        <section className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg flex flex-col">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center">
            <Database className="text-indigo-500 mr-2" size={20} />
            AI Knowledge Base Uploader (Text & Image)
          </h2>
          <p className="text-gray-500 mb-4">
            Updates here are saved to the **public** knowledge base, which the main landing page reads.
          </p>

          <div className="flex-1 flex flex-col space-y-4">
            
            {/* Text Area */}
            <label className="block text-lg font-semibold text-gray-700">1. Text Knowledge</label>
            <textarea
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 transition duration-150 ease-in-out resize-none"
              placeholder="Paste your specific documentation, policies, or product details here..."
              value={knowledgeInput}
              onChange={(e) => setKnowledgeInput(e.target.value)}
              rows={8}
              disabled={isSaving}
            />

            {/* Image Uploader */}
            <label className="block text-lg font-semibold text-gray-700 flex items-center">
                2. Image Context (Max 1MB)
            </label>
            
            <div className="flex items-start space-x-4">
                <label className="flex flex-col items-center justify-center w-64 h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition duration-150">
                    <Upload size={24} className="text-indigo-500 mb-1" />
                    <span className="text-sm text-gray-600">
                        {imageFile ? imageFile.name : 'Choose Image File'}
                    </span>
                    <input type="file" onChange={handleImageChange} accept="image/*" className="hidden" disabled={isSaving} />
                </label>

                {/* Image Preview */}
                <div className="relative w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden border border-gray-300">
                    {knowledgeImageBase64 ? (
                        <img 
                            src={knowledgeImageBase64} 
                            alt="AI Knowledge Context" 
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Image size={32} className="text-gray-400" />
                    )}
                </div>
                {/* Remove Image Button */}
                {knowledgeImageBase64 && (
                    <button
                        onClick={() => {
                            setKnowledgeImageBase64(null);
                            setImageFile(null);
                        }}
                        className="p-2 self-start rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition"
                        title="Remove Image"
                    >
                        <Trash2 size={20} />
                    </button>
                )}
            </div>

            {/* Save Button & Status */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
              <div className="text-sm text-gray-500">
                {getStatusIndicator()}
              </div>
              <button
                onClick={saveKnowledge}
                disabled={isSaving || (!knowledgeInput && !knowledgeImageBase64)}
                className={`flex items-center px-6 py-3 rounded-xl font-medium transition duration-150 ease-in-out ${
                  isSaving 
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl'
                }`}
              >
                {isSaving ? (
                  <Loader2 className="animate-spin mr-2" size={20} />
                ) : (
                  <Save size={20} className="mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Save Knowledge to AI'}
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: AI Chat Tester */}
        <section className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg flex flex-col">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center">
            <Sparkles className="text-green-500 mr-2" size={20} />
            Test AI Grounding
          </h2>
          <p className="text-gray-500 mb-4">
            Query the AI using the **saved** public knowledge (text & image).
          </p>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto bg-gray-100 p-3 rounded-lg space-y-4 mb-4 h-96 max-h-96">
            {chatHistory.length === 0 ? (
              <div className="text-center text-gray-400 p-8">
                Ask the AI a question, referencing the text or the uploaded image!
              </div>
            ) : (
              chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl max-w-[90%] ${
                    msg.role === 'user'
                      ? 'bg-indigo-100 text-indigo-800 self-end ml-auto'
                      : 'bg-white text-gray-700 border border-gray-200 shadow-sm mr-auto'
                  }`}
                >
                  <strong className="capitalize text-sm block mb-1 font-semibold">
                    {msg.role === 'user' ? 'You' : 'Admin AI'}
                  </strong>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>
              ))
            )}
            {isAILoading && (
              <div className="p-3 bg-white text-gray-700 border border-gray-200 shadow-sm rounded-xl flex items-center">
                <Loader2 className="animate-spin mr-2 text-indigo-500" size={16} />
                AI is thinking...
              </div>
            )}
          </div>
          
          {/* Chat Input */}
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 transition duration-150 ease-in-out"
              placeholder="Ask about the knowledge you uploaded..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={!isAuthReady || isAILoading || !apiKey}
            />
            <button
              type="submit"
              disabled={!isAuthReady || isAILoading || !chatInput.trim() || !apiKey}
              className={`p-3 rounded-lg transition duration-150 ease-in-out ${
                (!isAuthReady || isAILoading || !chatInput.trim() || !apiKey)
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
              }`}
            >
              <Send size={20} />
            </button>
            <button
              type="button"
              onClick={() => setChatHistory([])}
              className="p-3 rounded-lg bg-red-500 text-white hover:bg-red-600 transition duration-150 ease-in-out shadow-md"
              title="Clear Chat History"
            >
              <Trash2 size={20} />
            </button>
          </form>
          
        </section>

      </div>
    </div>
  );
};

export default App;

