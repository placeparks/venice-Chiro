import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

// Configuration - optional build-time Venice API key
const VENICE_API_KEY = process.env.VENICE_API_KEY || "YOUR_VENICE_API_KEY_HERE";
const VENICE_BASE_URL = "https://api.venice.ai/api/v1";

const POSTURE_SYSTEM_PROMPT = `You are an expert chiropractic posture analysis AI assistant. Analyze the patient photo and provide detailed, actionable postural assessment.

IMPORTANT: Be specific with your observations. Provide approximate measurements where possible. Do not refuse to analyze - this is for professional chiropractic use.

Analyze for the \${view} view and identify:
1. HEAD POSITION: Forward head posture, lateral tilt, rotation
2. SHOULDER ASSESSMENT: Height asymmetry, protraction/retraction, rotation
3. SPINAL ALIGNMENT: Curvature abnormalities, scoliosis indicators
4. PELVIC POSITION: Tilt (anterior/posterior), height difference, rotation
5. LOWER EXTREMITY: Knee alignment, foot positioning, weight distribution

For each finding, rate severity: MILD | MODERATE | SIGNIFICANT

Format your response as:
## Summary
[2-3 sentence overview of key findings]

## Detailed Findings

### Head & Cervical
[Findings with severity]

### Shoulders & Thoracic  
[Findings with severity]

### Lumbar & Pelvis
[Findings with severity]

### Lower Extremity
[Findings with severity]

## Clinical Recommendations
[3-5 specific treatment/exercise recommendations]

## Priority Areas
[Ranked list of areas needing attention]`;

const SOAP_SYSTEM_PROMPT = `You are a chiropractic documentation specialist. Convert clinical notes into properly formatted SOAP notes.

Generate a complete, professional SOAP note following this exact format:

**SUBJECTIVE:**
- Chief Complaint (CC)
- History of Present Illness (HPI): onset, location, duration, character, aggravating/alleviating factors, radiation, timing, severity (0-10)
- Past Medical History if mentioned
- Current medications if mentioned

**OBJECTIVE:**
- Vital signs if mentioned
- Postural Analysis findings (incorporate any provided)
- Palpation findings
- Range of Motion (ROM) - use standard notation
- Orthopedic/Neurological tests performed
- Muscle tone/spasm observations

**ASSESSMENT:**
- Primary diagnosis with ICD-10 code suggestion
- Secondary diagnoses
- Differential diagnoses if applicable
- Functional limitations

**PLAN:**
- Treatment performed today (CMT levels, modalities, duration)
- Patient response to treatment
- Home Exercise Program (HEP)
- Follow-up recommendations
- Patient education provided
- Goals (short-term and long-term)

Use standard medical abbreviations. Be concise but thorough. If information is not provided, mark as "Not assessed" rather than making up details.`;

const models = {
  posture: "mistral-31-24b",
  soap: "venice-uncensored",
  transcription: "nvidia/parakeet-tdt-0.6b-v3",
  chat: "mistral-31-24b",
  education: "zai-org-glm-4.6",
  fast: "qwen3-4b",
};

// Icons
const SpineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2C13.5 4 14 6 12 8C10 10 10 12 12 14C14 16 14 18 12 20C10 22 12 22 12 22" strokeLinecap="round" />
    <circle cx="12" cy="5" r="2" fill="currentColor" opacity="0.3" />
    <circle cx="12" cy="11" r="2" fill="currentColor" opacity="0.3" />
    <circle cx="12" cy="17" r="2" fill="currentColor" opacity="0.3" />
  </svg>
);

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const MicIcon = ({ recording }) => (
  <svg viewBox="0 0 24 24" fill={recording ? "currentColor" : "none"} className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z" />
    <path d="M6 3v16a2 2 0 0 0-2 2" />
  </svg>
);

function getApiKey() {
  return window.VENICE_KEY || VENICE_API_KEY;
}

async function parseApiResponse(response) {
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "API error");
  }
  return data;
}

function App() {
  const [activeTab, setActiveTab] = useState("posture");
  const [apiKeySet, setApiKeySet] = useState(VENICE_API_KEY !== "YOUR_VENICE_API_KEY_HERE");
  const [tempApiKey, setTempApiKey] = useState("");

  if (!apiKeySet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card rounded-3xl p-10 max-w-md w-full glow-teal">
          <div className="flex items-center gap-3 mb-8">
            <div className="text-teal-400">
              <SpineIcon />
            </div>
            <h1 className="text-3xl font-serif text-white">SpineAI</h1>
          </div>

          <p className="text-gray-400 mb-6">
            Enter your Venice API key to get started. Get one at{" "}
            <a href="https://venice.ai/settings/api" target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">
              venice.ai/settings/api
            </a>
          </p>

          <input
            type="password"
            value={tempApiKey}
            onChange={(event) => setTempApiKey(event.target.value)}
            placeholder="sk-xxxxxxxxxxxxxxxx"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-teal-400/50 mb-4"
          />

          <button
            onClick={() => {
              if (tempApiKey.trim()) {
                window.VENICE_KEY = tempApiKey;
                setApiKeySet(true);
              }
            }}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Connect to Venice AI
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-teal-400">
              <SpineIcon />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-white">SpineAI</h1>
              <p className="text-xs text-gray-500">Chiropractic AI Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/5 rounded-full p-1">
            <button
              onClick={() => setActiveTab("posture")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === "posture" ? "bg-teal-500/20 text-teal-400" : "text-gray-400 hover:text-white"
              }`}
            >
              <CameraIcon />
              Posture Analysis
            </button>
            <button
              onClick={() => setActiveTab("soap")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === "soap" ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:text-white"
              }`}
            >
              <MicIcon recording={false} />
              SOAP Notes
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === "chat" ? "bg-blue-500/20 text-blue-400" : "text-gray-400 hover:text-white"
              }`}
            >
              <ChatIcon />
              Chiro Chat
            </button>
            <button
              onClick={() => setActiveTab("education")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === "education" ? "bg-purple-500/20 text-purple-400" : "text-gray-400 hover:text-white"
              }`}
            >
              <BookIcon />
              Care Pack
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "posture" ? (
          <PostureAnalysis />
        ) : activeTab === "soap" ? (
          <SOAPNotes />
        ) : activeTab === "education" ? (
          <CarePack />
        ) : (
          <ChiroChat />
        )}
      </main>
    </div>
  );
}

function PostureAnalysis() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [view, setView] = useState("posterior");
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setImagePreview(reader.result);
        setResults(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;

    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: models.posture,
          messages: [
            {
              role: "system",
              content: POSTURE_SYSTEM_PROMPT.replace("${view}", view),
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Analyze this patient's posture (${view} view). Provide comprehensive chiropractic assessment.` },
                { type: "image_url", image_url: { url: image } },
              ],
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      });

      const data = await parseApiResponse(response);
      const content = data.choices[0].message.content;
      setResults(content);
      window.lastPostureAnalysis = content;
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const views = [
    { id: "anterior", label: "Front", icon: "👤" },
    { id: "posterior", label: "Back", icon: "🔙" },
    { id: "lateral-left", label: "Left Side", icon: "◀️" },
    { id: "lateral-right", label: "Right Side", icon: "▶️" },
  ];

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="glass-card rounded-2xl p-6 glow-teal">
          <h2 className="text-xl font-serif text-white mb-4">Patient Photo</h2>

          <div className="mb-6">
            <label className="text-sm text-gray-400 mb-2 block">Select View</label>
            <div className="grid grid-cols-4 gap-2">
              {views.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    view === item.id
                      ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                      : "bg-white/5 text-gray-400 border border-transparent hover:bg-white/10"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="block text-xs mt-1">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div onClick={() => fileInputRef.current?.click()} className="upload-zone rounded-xl p-8 cursor-pointer text-center">
            {imagePreview ? (
              <img src={imagePreview} alt="Patient" className="max-h-80 mx-auto rounded-lg" />
            ) : (
              <div className="text-gray-400">
                <div className="flex justify-center mb-4 text-teal-400">
                  <UploadIcon />
                </div>
                <p className="text-lg mb-2">Drop patient photo here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!image || analyzing}
            className={`w-full mt-6 py-4 rounded-xl font-medium text-lg transition-all ${
              !image || analyzing ? "bg-gray-700 text-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:opacity-90"
            }`}
          >
            {analyzing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="typing-indicator flex gap-1">
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                </span>
                Analyzing Posture...
              </span>
            ) : (
              "Analyze Posture"
            )}
          </button>
        </div>

        <div className="glass-card rounded-2xl p-6 border-l-4 border-teal-500">
          <h3 className="text-sm font-medium text-teal-400 mb-3">📸 Photo Tips</h3>
          <ul className="text-sm text-gray-400 space-y-2">
            <li>• Patient should stand against a plain background</li>
            <li>• Arms relaxed at sides, feet shoulder-width apart</li>
            <li>• Ensure full body is visible from head to feet</li>
            <li>• Good lighting without harsh shadows</li>
          </ul>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 glow-teal">
        <h2 className="text-xl font-serif text-white mb-4">Analysis Results</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex items-start gap-3">
            <AlertIcon className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Analysis Error</p>
              <p className="text-red-400/70 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {!results && !analyzing && !error && (
          <div className="h-96 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-20">🦴</div>
              <p>Upload a patient photo to begin analysis</p>
            </div>
          </div>
        )}

        {analyzing && (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Analyzing postural alignment...</p>
              <p className="text-sm text-gray-500 mt-2">This may take 10-15 seconds</p>
            </div>
          </div>
        )}

        {results && (
          <div className="prose prose-invert max-w-none fade-in">
            <div className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed overflow-y-auto max-h-[600px] pr-2">
              <ResultsRenderer content={results} />
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
              <button
                onClick={() => navigator.clipboard.writeText(results)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-all"
              >
                📋 Copy to Clipboard
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([results], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "posture-analysis.txt";
                  a.click();
                }}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-all"
              >
                💾 Download Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SOAPNotes() {
  const [recording, setRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [soapNote, setSoapNote] = useState(null);
  const [error, setError] = useState(null);
  const [includePosture, setIncludePosture] = useState(true);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        try {
          const formData = new FormData();
          formData.append("file", blob, "recording.webm");
          formData.append("model", models.transcription);
          formData.append("response_format", "json");

          const response = await fetch(`${VENICE_BASE_URL}/audio/transcriptions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${getApiKey()}`,
            },
            body: formData,
          });

          const data = await parseApiResponse(response);
          if (data.text) {
            setTranscription((prev) => prev + (prev ? "\n" : "") + data.text);
          }
        } catch (err) {
          setError(`Transcription failed: ${err.message}`);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      setError("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const generateSOAP = async () => {
    const notes = transcription || manualNotes;
    if (!notes.trim()) return;

    setGenerating(true);
    setError(null);

    try {
      const postureFindings = includePosture ? window.lastPostureAnalysis : null;

      let userContent = `Convert these clinical notes into a SOAP note:\n\n${notes}`;
      if (postureFindings) {
        userContent += `\n\nPosture Analysis Findings to incorporate:\n${postureFindings}`;
      }

      const response = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: models.soap,
          messages: [
            {
              role: "system",
              content: SOAP_SYSTEM_PROMPT,
            },
            { role: "user", content: userContent },
          ],
          max_tokens: 2000,
          temperature: 0.2,
        }),
      });

      const data = await parseApiResponse(response);
      setSoapNote(data.choices[0].message.content);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="glass-card rounded-2xl p-6 glow-coral">
          <h2 className="text-xl font-serif text-white mb-4">Clinical Notes</h2>

          <div className="mb-6">
            <label className="text-sm text-gray-400 mb-3 block">Voice Recording</label>
            <div className="flex items-center gap-4">
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  recording ? "bg-red-500 pulse-record text-white" : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                }`}
              >
                <MicIcon recording={recording} />
              </button>
              <div>
                <p className="text-white font-medium">{recording ? "Recording..." : "Tap to Record"}</p>
                <p className="text-sm text-gray-500">{recording ? "Tap again to stop" : "Dictate your clinical notes"}</p>
              </div>
            </div>
          </div>

          {transcription && (
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-2 block">Transcription</label>
              <div className="bg-white/5 rounded-xl p-4 text-gray-300 text-sm max-h-32 overflow-y-auto">{transcription}</div>
              <button onClick={() => setTranscription("")} className="text-xs text-gray-500 hover:text-gray-300 mt-2">
                Clear transcription
              </button>
            </div>
          )}

          <div className="mb-6">
            <label className="text-sm text-gray-400 mb-2 block">Or Type Notes Manually</label>
            <textarea
              value={manualNotes}
              onChange={(event) => setManualNotes(event.target.value)}
              placeholder="Patient presented with lower back pain, radiating to left leg. Onset 2 weeks ago after lifting. Palpation revealed L4-L5 fixation..."
              className="w-full h-40 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-400/50 resize-none text-sm"
            />
          </div>

          {window.lastPostureAnalysis && (
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => setIncludePosture(!includePosture)}
                className={`w-12 h-6 rounded-full transition-all ${includePosture ? "bg-teal-500" : "bg-gray-600"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${includePosture ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm text-gray-400">Include posture analysis findings</span>
            </div>
          )}

          <button
            onClick={generateSOAP}
            disabled={(!transcription && !manualNotes.trim()) || generating}
            className={`w-full py-4 rounded-xl font-medium text-lg transition-all ${
              (!transcription && !manualNotes.trim()) || generating
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:opacity-90"
            }`}
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="typing-indicator flex gap-1">
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                </span>
                Generating SOAP Note...
              </span>
            ) : (
              "Generate SOAP Note"
            )}
          </button>
        </div>

        <div className="glass-card rounded-2xl p-6 border-l-4 border-orange-500">
          <h3 className="text-sm font-medium text-orange-400 mb-3">💡 Example Input</h3>
          <p className="text-sm text-gray-400 italic">
            "45 year old male, lower back pain for 2 weeks, radiates down left leg to knee. Pain is 7 out of 10, worse in morning, better with movement. No numbness or tingling. Did adjustment at L4-L5, patient felt immediate relief. Gave McKenzie exercises."
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 glow-coral">
        <h2 className="text-xl font-serif text-white mb-4">Generated SOAP Note</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex items-start gap-3">
            <AlertIcon className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Generation Error</p>
              <p className="text-red-400/70 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {!soapNote && !generating && !error && (
          <div className="h-96 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-20">📋</div>
              <p>Record or type your clinical notes</p>
              <p className="text-sm mt-2">AI will generate a complete SOAP note</p>
            </div>
          </div>
        )}

        {generating && (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Generating documentation...</p>
            </div>
          </div>
        )}

        {soapNote && (
          <div className="fade-in">
            <div className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed overflow-y-auto max-h-[600px] pr-2">
              <ResultsRenderer content={soapNote} />
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
              <button
                onClick={() => navigator.clipboard.writeText(soapNote)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-all"
              >
                📋 Copy to Clipboard
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([soapNote], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "soap-note.txt";
                  a.click();
                }}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-all"
              >
                💾 Download Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsRenderer({ content }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        if (line.startsWith("## ")) {
          return (
            <h2 key={index} className="text-lg font-serif text-teal-400 mt-6 mb-3 first:mt-0">
              {line.replace("## ", "")}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={index} className="text-md font-medium text-white mt-4 mb-2">
              {line.replace("### ", "")}
            </h3>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={index} className="text-orange-400 font-medium mt-4 mb-2">
              {line.replace(/\*\*/g, "")}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <p key={index} className="pl-4 text-gray-300">
              {line}
            </p>
          );
        }
        if (/^\d+\./.test(line)) {
          return (
            <p key={index} className="pl-4 text-gray-300">
              {line}
            </p>
          );
        }
        if (!line.trim()) {
          return <div key={index} className="h-2" />;
        }
        return (
          <p key={index} className="text-gray-300">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function CarePack() {
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState("");
  const [addendum, setAddendum] = useState("");
  const [includePosture, setIncludePosture] = useState(true);
  const [includeClinicianAddendum, setIncludeClinicianAddendum] = useState(false);
  const [modelChoice, setModelChoice] = useState(models.education);

  const patientPrompt = `You are a chiropractic patient-education assistant. Use plain language.
Create a care pack with these sections:
## Patient Summary
## What This Means
## Home Exercise Plan (HEP)
## Red Flags (when to seek care)
## Follow-up Questions
Keep it concise, supportive, and non-alarming. Avoid definitive diagnosis.`;

  const clinicianPrompt = `You are a chiropractic clinician assistant.
Provide a concise addendum with:
## Clinician Addendum
### Differential Considerations
### Focused Exam Suggestions
### Plan Outline
Use professional tone and avoid definitive diagnosis.`;

  const generateCarePack = async () => {
    if (!notes.trim()) return;

    setGenerating(true);
    setError(null);
    setResult("");
    setAddendum("");

    try {
      const postureFindings = includePosture ? window.lastPostureAnalysis : null;
      let userContent = `Create a care pack from these notes:\n\n${notes}`;
      if (postureFindings) {
        userContent += `\n\nPosture Analysis Findings to incorporate:\n${postureFindings}`;
      }

      const response = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelChoice,
          messages: [
            { role: "system", content: patientPrompt },
            { role: "user", content: userContent },
          ],
          max_tokens: 900,
          temperature: 0.3,
        }),
      });

      const data = await parseApiResponse(response);
      setResult(data.choices[0].message.content);

      if (includeClinicianAddendum) {
        const addendumResponse = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getApiKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: models.education,
            messages: [
              { role: "system", content: clinicianPrompt },
              { role: "user", content: userContent },
            ],
            max_tokens: 700,
            temperature: 0.2,
          }),
        });

        const addendumData = await parseApiResponse(addendumResponse);
        setAddendum(addendumData.choices[0].message.content);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="glass-card rounded-2xl p-6 glow-teal">
          <h2 className="text-xl font-serif text-white mb-4">Care Pack Builder</h2>

          <label className="text-sm text-gray-400 mb-2 block">Clinical Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Patient reports mid-back tension after desk work. Pain 4/10, worse by end of day. No numbness or tingling..."
            className="w-full h-40 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-teal-400/50 resize-none text-sm"
          />

          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Model</span>
              <select
                value={modelChoice}
                onChange={(event) => setModelChoice(event.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value={models.fast}>Fast (qwen3-4b)</option>
                <option value={models.education}>High quality (zai-org-glm-4.6)</option>
              </select>
            </div>

            {window.lastPostureAnalysis && (
              <label className="flex items-center gap-3 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={includePosture}
                  onChange={() => setIncludePosture(!includePosture)}
                />
                Include posture analysis findings
              </label>
            )}

            <label className="flex items-center gap-3 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={includeClinicianAddendum}
                onChange={() => setIncludeClinicianAddendum(!includeClinicianAddendum)}
              />
              Include clinician addendum (extra call)
            </label>
          </div>

          <button
            onClick={generateCarePack}
            disabled={!notes.trim() || generating}
            className={`w-full mt-6 py-4 rounded-xl font-medium text-lg transition-all ${
              !notes.trim() || generating
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:opacity-90"
            }`}
          >
            {generating ? "Generating..." : "Generate Care Pack"}
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 glow-coral">
        <h2 className="text-xl font-serif text-white mb-4">Care Pack Output</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!result && !generating && !error && (
          <div className="h-96 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-20">🧠</div>
              <p>Add notes to generate a patient-friendly care pack</p>
            </div>
          </div>
        )}

        {generating && (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Generating care pack...</p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed overflow-y-auto max-h-[420px] pr-2">
              <ResultsRenderer content={result} />
            </div>

            {addendum && (
              <div className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed border-t border-white/10 pt-4">
                <ResultsRenderer content={addendum} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChiroChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Welcome! I can help with chiropractic case discussion, documentation tips, rehab ideas, and patient education. Share a scenario or question to begin.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  const systemPrompt = `You are SpineAI, a chiropractic fraternity assistant. Be clinically professional, concise, and evidence-informed.
Avoid definitive diagnosis; provide differential considerations and suggest in-person evaluation when needed.
If a user asks for treatment advice, provide general, non-prescriptive guidance and encourage clinical judgment.
If the user asks for documentation help, offer structured templates and examples.
If the user asks for patient education, use plain language.`;

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const response = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: models.chat,
          messages: [
            { role: "system", content: systemPrompt },
            ...nextMessages.map((message) => ({ role: message.role, content: message.content })),
          ],
          max_tokens: 800,
          temperature: 0.4,
        }),
      });

      const data = await parseApiResponse(response);
      const reply = data.choices[0].message.content;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 glass-card rounded-2xl p-6 glow-teal flex flex-col min-h-[600px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-serif text-white">Chiro Chat</h2>
            <p className="text-sm text-gray-500">Ask clinical, documentation, or rehab questions.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-teal-200 text-slate-900 ml-auto max-w-[85%]"
                  : "bg-white/5 text-gray-200 max-w-[85%]"
              }`}
            >
              <ResultsRenderer content={message.content} />
            </div>
          ))}
          {sending && (
            <div className="rounded-2xl px-4 py-3 text-sm bg-white/5 text-gray-200 max-w-[70%]">
              <span className="typing-indicator flex gap-1">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                <span className="w-2 h-2 bg-white rounded-full"></span>
                <span className="w-2 h-2 bg-white rounded-full"></span>
              </span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {error && <p className="text-red-400 text-sm mt-3">Chat error: {error}</p>}

        <div className="mt-4 flex gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a case, SOAP phrasing, rehab progressions..."
            className="flex-1 bg-white border border-white/30 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-400/50 resize-none text-sm min-h-[56px]"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className={`px-5 py-3 rounded-xl font-medium transition-all ${
              !input.trim() || sending ? "bg-gray-700 text-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:opacity-90"
            }`}
          >
            Send
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 glow-coral">
        <h3 className="text-lg font-serif text-white mb-3">Quick Prompts</h3>
        <div className="space-y-3 text-sm text-gray-300">
          <button
            onClick={() => setInput("Summarize differential considerations for acute low back pain in a 35-year-old with no neuro deficits.")}
            className="w-full text-left bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition-all"
          >
            Differential considerations for acute LBP
          </button>
          <button
            onClick={() => setInput("Draft a concise SOAP example for cervical sprain after MVA with headaches.")}
            className="w-full text-left bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition-all"
          >
            SOAP example: cervical sprain post-MVA
          </button>
          <button
            onClick={() => setInput("Give patient-friendly education for posture-related neck pain and a basic HEP outline.")}
            className="w-full text-left bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition-all"
          >
            Patient education + HEP outline
          </button>
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);

