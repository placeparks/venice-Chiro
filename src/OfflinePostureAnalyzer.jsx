import React, { useRef, useState, useEffect, useCallback } from 'react';

// Posture analysis thresholds and constants
const POSTURE_THRESHOLDS = {
    HEAD_FORWARD_ANGLE: { good: 10, moderate: 20 },
    SHOULDER_TILT: { good: 5, moderate: 10 },
    HIP_ALIGNMENT: { good: 5, moderate: 10 },
    SPINE_CURVATURE: { good: 15, moderate: 25 },
};

// MediaPipe Pose landmark indices
const LANDMARKS = {
    NOSE: 0,
    LEFT_EYE: 2,
    RIGHT_EYE: 5,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
};

// Skeleton connections for drawing
const POSE_CONNECTIONS = [
    [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
    [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW],
    [LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST],
    [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW],
    [LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST],
    [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP],
    [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP],
    [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE],
    [LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
    [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE],
    [LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE],
];

const getMidpoint = (p1, p2) => ({
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: ((p1.z || 0) + (p2.z || 0)) / 2,
});

const calculateSlope = (p1, p2) => {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
};

const getStatus = (value, thresholds) => {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.moderate) return 'moderate';
    return 'poor';
};

const getStatusEmoji = (status) => {
    switch (status) {
        case 'good': return '✅';
        case 'moderate': return '⚠️';
        case 'poor': return '❌';
        default: return '❓';
    }
};

const analyzePosture = (landmarks) => {
    if (!landmarks || landmarks.length < 33) return null;

    const leftEar = landmarks[LANDMARKS.LEFT_EAR];
    const rightEar = landmarks[LANDMARKS.RIGHT_EAR];
    const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[LANDMARKS.RIGHT_HIP];

    const midShoulder = getMidpoint(leftShoulder, rightShoulder);
    const midHip = getMidpoint(leftHip, rightHip);
    const midEar = getMidpoint(leftEar, rightEar);

    const headForwardAngle = Math.abs(
        Math.atan2(midEar.y - midShoulder.y, midEar.x - midShoulder.x) * 180 / Math.PI - 90
    );
    const shoulderTilt = Math.abs(calculateSlope(leftShoulder, rightShoulder));
    const hipAlignment = Math.abs(calculateSlope(leftHip, rightHip));
    const spineAngle = Math.abs(
        Math.atan2(midHip.y - midShoulder.y, midHip.x - midShoulder.x) * 180 / Math.PI - 90
    );

    const metrics = {
        headForward: {
            value: parseFloat(headForwardAngle.toFixed(1)),
            status: getStatus(headForwardAngle, POSTURE_THRESHOLDS.HEAD_FORWARD_ANGLE),
            label: 'Head Position',
            description: headForwardAngle > POSTURE_THRESHOLDS.HEAD_FORWARD_ANGLE.moderate
                ? 'Forward head posture detected - may cause neck strain'
                : headForwardAngle > POSTURE_THRESHOLDS.HEAD_FORWARD_ANGLE.good
                    ? 'Slight forward head tilt - monitor closely'
                    : 'Excellent head alignment',
            recommendation: headForwardAngle > POSTURE_THRESHOLDS.HEAD_FORWARD_ANGLE.good
                ? 'Chin tuck exercises, 10 reps × 3 sets daily'
                : 'Maintain current positioning',
        },
        shoulderTilt: {
            value: parseFloat(shoulderTilt.toFixed(1)),
            status: getStatus(shoulderTilt, POSTURE_THRESHOLDS.SHOULDER_TILT),
            label: 'Shoulder Level',
            description: shoulderTilt > POSTURE_THRESHOLDS.SHOULDER_TILT.moderate
                ? 'Significant shoulder imbalance detected'
                : shoulderTilt > POSTURE_THRESHOLDS.SHOULDER_TILT.good
                    ? 'Minor shoulder asymmetry'
                    : 'Shoulders are well balanced',
            recommendation: shoulderTilt > POSTURE_THRESHOLDS.SHOULDER_TILT.good
                ? 'Shoulder blade squeezes and leveling exercises'
                : 'Continue regular stretching',
        },
        hipAlignment: {
            value: parseFloat(hipAlignment.toFixed(1)),
            status: getStatus(hipAlignment, POSTURE_THRESHOLDS.HIP_ALIGNMENT),
            label: 'Hip Alignment',
            description: hipAlignment > POSTURE_THRESHOLDS.HIP_ALIGNMENT.moderate
                ? 'Hip imbalance may indicate pelvic tilt'
                : hipAlignment > POSTURE_THRESHOLDS.HIP_ALIGNMENT.good
                    ? 'Slight hip asymmetry noted'
                    : 'Hips are level and balanced',
            recommendation: hipAlignment > POSTURE_THRESHOLDS.HIP_ALIGNMENT.good
                ? 'Hip flexor stretches and glute strengthening'
                : 'Maintain hip mobility with stretching',
        },
        spineCurvature: {
            value: parseFloat(spineAngle.toFixed(1)),
            status: getStatus(spineAngle, POSTURE_THRESHOLDS.SPINE_CURVATURE),
            label: 'Spine Alignment',
            description: spineAngle > POSTURE_THRESHOLDS.SPINE_CURVATURE.moderate
                ? 'Spinal deviation requires attention'
                : spineAngle > POSTURE_THRESHOLDS.SPINE_CURVATURE.good
                    ? 'Minor spinal curve detected'
                    : 'Spine alignment is optimal',
            recommendation: spineAngle > POSTURE_THRESHOLDS.SPINE_CURVATURE.good
                ? 'Core strengthening - focus on transverse abdominis'
                : 'Continue core maintenance exercises',
        },
    };

    const scores = Object.values(metrics).map(m =>
        m.status === 'good' ? 100 : m.status === 'moderate' ? 60 : 30
    );
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    return {
        metrics,
        overallScore,
        overallStatus: overallScore >= 80 ? 'good' : overallScore >= 50 ? 'moderate' : 'poor',
        timestamp: Date.now(),
    };
};

const generateOfflineSOAPNote = (analysis) => {
    if (!analysis) return null;

    const { metrics, overallScore } = analysis;
    const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const findings = Object.values(metrics)
        .filter(m => m.status !== 'good')
        .map(m => `- ${m.label}: ${m.description} (${m.value}°)`);

    const goodFindings = Object.values(metrics)
        .filter(m => m.status === 'good')
        .map(m => m.label);

    return `## SOAP Note (Offline Analysis)
**Date:** ${date}

### SUBJECTIVE
Patient presents for posture assessment.

### OBJECTIVE
**POSTURE ANALYSIS (AI-Assisted - Offline MediaPipe)**
Overall Posture Score: ${overallScore}/100

**Measurements:**
- Head Forward Angle: ${metrics.headForward.value}° (${metrics.headForward.status})
- Shoulder Tilt: ${metrics.shoulderTilt.value}° (${metrics.shoulderTilt.status})
- Hip Alignment: ${metrics.hipAlignment.value}° (${metrics.hipAlignment.status})
- Spine Deviation: ${metrics.spineCurvature.value}° (${metrics.spineCurvature.status})

${findings.length > 0 ? `**Areas of Concern:**\n${findings.join('\n')}` : ''}
${goodFindings.length > 0 ? `\n**Within Normal Limits:** ${goodFindings.join(', ')}` : ''}

### ASSESSMENT
Posture assessment reveals ${overallScore >= 80 ? 'generally good alignment with minor areas for improvement' :
            overallScore >= 50 ? 'moderate postural deviations requiring attention' :
                'significant postural imbalances requiring intervention'
        }.

### PLAN
${Object.values(metrics).map((m, i) => `${i + 1}. ${m.recommendation}`).join('\n')}
${overallScore < 80 ? `${Object.values(metrics).length + 1}. Ergonomic workstation review recommended` : ''}
${overallScore < 80 ? `${Object.values(metrics).length + 2}. Follow-up posture assessment in ${overallScore >= 50 ? '4-6 weeks' : '2-4 weeks'}` : ''}
`;
};

// Draw skeleton on canvas with color-coded status
const drawSkeleton = (ctx, landmarks, analysis, width, height) => {
    if (!landmarks || landmarks.length < 33) return;

    // Draw connections
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    POSE_CONNECTIONS.forEach(([start, end]) => {
        const p1 = landmarks[start];
        const p2 = landmarks[end];
        if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(45, 212, 191, 0.8)'; // Teal
            ctx.moveTo(p1.x * width, p1.y * height);
            ctx.lineTo(p2.x * width, p2.y * height);
            ctx.stroke();
        }
    });

    // Draw landmarks
    landmarks.forEach((point, index) => {
        if (point.visibility > 0.5) {
            ctx.beginPath();
            ctx.fillStyle = index === LANDMARKS.NOSE ? '#F97316' : '#2DD4BF';
            ctx.arc(point.x * width, point.y * height, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    // Draw alignment lines
    if (analysis) {
        const midShoulder = getMidpoint(landmarks[LANDMARKS.LEFT_SHOULDER], landmarks[LANDMARKS.RIGHT_SHOULDER]);
        const midHip = getMidpoint(landmarks[LANDMARKS.LEFT_HIP], landmarks[LANDMARKS.RIGHT_HIP]);

        // Vertical reference line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([5, 5]);
        ctx.moveTo(midShoulder.x * width, 0);
        ctx.lineTo(midShoulder.x * width, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Spine line
        ctx.beginPath();
        ctx.strokeStyle = analysis.overallStatus === 'good' ? '#10B981' :
            analysis.overallStatus === 'moderate' ? '#F59E0B' : '#EF4444';
        ctx.lineWidth = 4;
        ctx.moveTo(midShoulder.x * width, midShoulder.y * height);
        ctx.lineTo(midHip.x * width, midHip.y * height);
        ctx.stroke();
    }
};

const OfflinePostureAnalyzer = ({ onAnalysisComplete }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const poseRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [soapNote, setSoapNote] = useState(null);
    const [mode, setMode] = useState('upload');
    const [isProcessing, setIsProcessing] = useState(false);
    const [cacheStatus, setCacheStatus] = useState('unknown');
    const [loadProgress, setLoadProgress] = useState(0);

    // Initialize MediaPipe Pose
    useEffect(() => {
        const loadMediaPipe = async () => {
            try {
                setLoadProgress(10);

                const loadScript = (src) => {
                    return new Promise((resolve, reject) => {
                        const existing = document.querySelector(`script[src="${src}"]`);
                        if (existing) {
                            resolve();
                            return;
                        }
                        const script = document.createElement('script');
                        script.src = src;
                        script.async = true;
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                };

                setLoadProgress(20);
                await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
                setLoadProgress(40);
                await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
                setLoadProgress(60);
                await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
                setLoadProgress(80);

                await new Promise(resolve => {
                    const check = () => {
                        if (window.Pose) resolve();
                        else setTimeout(check, 100);
                    };
                    check();
                });

                const pose = new window.Pose({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
                });

                pose.setOptions({
                    modelComplexity: 2, // Highest accuracy
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    minDetectionConfidence: 0.7,
                    minTrackingConfidence: 0.7,
                });

                pose.onResults(handlePoseResults);
                await pose.initialize();

                poseRef.current = pose;
                setLoadProgress(100);
                setIsLoading(false);

                // Notify service worker to cache MediaPipe assets
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'CACHE_MEDIAPIPE' });
                }
            } catch (err) {
                console.error('Failed to load MediaPipe:', err);
                setError('Failed to load pose detection. Check your internet connection and refresh.');
                setIsLoading(false);
            }
        };

        // Listen for cache confirmation
        const handleMessage = (event) => {
            if (event.data && event.data.type === 'MEDIAPIPE_CACHED') {
                setCacheStatus('cached');
            }
        };
        navigator.serviceWorker?.addEventListener('message', handleMessage);

        loadMediaPipe();

        return () => {
            navigator.serviceWorker?.removeEventListener('message', handleMessage);
            poseRef.current?.close();
        };
    }, []);

    const handlePoseResults = useCallback((results) => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.poseLandmarks) {
            const postureAnalysis = analyzePosture(results.poseLandmarks);
            setAnalysis(postureAnalysis);

            // Draw skeleton with analysis overlay
            drawSkeleton(ctx, results.poseLandmarks, postureAnalysis, canvas.width, canvas.height);

            if (postureAnalysis) {
                const soap = generateOfflineSOAPNote(postureAnalysis);
                setSoapNote(soap);
                window.lastPostureAnalysis = soap;
                onAnalysisComplete?.(postureAnalysis);
            }
        }

        setIsProcessing(false);
    }, [onAnalysisComplete]);

    const handleImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file || !poseRef.current) return;

        setIsProcessing(true);
        setAnalysis(null);
        setSoapNote(null);

        const img = new Image();
        img.onload = async () => {
            const canvas = canvasRef.current;
            const overlay = overlayCanvasRef.current;

            // Set canvas dimensions
            const maxWidth = 640;
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            overlay.width = canvas.width;
            overlay.height = canvas.height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            try {
                await poseRef.current.send({ image: img });
            } catch (err) {
                console.error('Pose detection error:', err);
                setError('Failed to analyze image. Try a clearer photo.');
                setIsProcessing(false);
            }
        };
        img.src = URL.createObjectURL(file);
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: 640, height: 480 },
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setMode('camera');
        } catch (err) {
            console.error('Camera access error:', err);
            setError('Unable to access camera. Please check permissions.');
        }
    };

    const captureFromCamera = async () => {
        if (!videoRef.current || !poseRef.current) return;

        setIsProcessing(true);
        setAnalysis(null);
        setSoapNote(null);

        const canvas = canvasRef.current;
        const overlay = overlayCanvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        overlay.width = canvas.width;
        overlay.height = canvas.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);

        try {
            await poseRef.current.send({ image: videoRef.current });
        } catch (err) {
            console.error('Pose detection error:', err);
            setError('Failed to analyze. Please try again.');
            setIsProcessing(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setMode('upload');
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'from-emerald-500 to-teal-500';
        if (score >= 50) return 'from-amber-500 to-orange-500';
        return 'from-red-500 to-rose-500';
    };

    const getStatusBgColor = (status) => {
        switch (status) {
            case 'good': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'moderate': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'poor': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    if (isLoading) {
        return (
            <div className="glass-card rounded-2xl p-8 text-center glow-teal">
                <div className="mb-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center">
                        <svg className="w-10 h-10 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-serif text-white mb-2">Loading AI Pose Detection</h3>
                    <p className="text-gray-400 text-sm mb-4">Downloading MediaPipe models for offline analysis...</p>
                </div>

                <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                    <div
                        className="bg-gradient-to-r from-teal-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${loadProgress}%` }}
                    />
                </div>
                <p className="text-xs text-gray-500">{loadProgress}% loaded</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-card rounded-2xl p-6 border-l-4 border-red-500">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">⚠️</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-red-400 mb-1">Error Loading</h3>
                        <p className="text-gray-400 text-sm">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-all"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - Camera/Upload */}
            <div className="space-y-6">
                <div className="glass-card rounded-2xl p-6 glow-teal">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-serif text-white">Capture Posture</h2>
                        {cacheStatus === 'cached' && (
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                                ✓ Offline Ready
                            </span>
                        )}
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => { stopCamera(); fileInputRef.current?.click(); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${mode === 'upload'
                                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Upload Photo
                        </button>
                        <button
                            onClick={mode === 'camera' ? captureFromCamera : startCamera}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${mode === 'camera'
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {mode === 'camera' ? 'Capture' : 'Use Camera'}
                        </button>
                    </div>

                    {mode === 'camera' && (
                        <button
                            onClick={stopCamera}
                            className="w-full mb-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-all"
                        >
                            Stop Camera
                        </button>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                    />

                    {/* Video/Canvas Display */}
                    <div className="relative rounded-xl overflow-hidden bg-slate-900/50 min-h-[300px]">
                        {mode === 'camera' && (
                            <video
                                ref={videoRef}
                                className="w-full rounded-xl"
                                playsInline
                                muted
                            />
                        )}
                        <canvas
                            ref={canvasRef}
                            className={`w-full rounded-xl ${mode === 'camera' ? 'hidden' : 'block'}`}
                            style={{ display: mode === 'camera' ? 'none' : 'block' }}
                        />
                        <canvas
                            ref={overlayCanvasRef}
                            className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        />

                        {!analysis && !isProcessing && mode === 'upload' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center text-gray-500">
                                    <div className="text-6xl mb-4 opacity-30">📷</div>
                                    <p>Upload a photo to analyze posture</p>
                                </div>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                <div className="text-center">
                                    <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-3" />
                                    <p className="text-white font-medium">Analyzing Posture...</p>
                                    <p className="text-gray-400 text-sm">AI processing locally</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tips Card */}
                <div className="glass-card rounded-2xl p-6 border-l-4 border-teal-500">
                    <h3 className="text-sm font-medium text-teal-400 mb-3">📸 Best Results Tips</h3>
                    <ul className="text-sm text-gray-400 space-y-2">
                        <li>• Full body visible, head to feet</li>
                        <li>• Stand naturally, arms at sides</li>
                        <li>• Plain background, good lighting</li>
                        <li>• Front or back view works best</li>
                    </ul>
                </div>
            </div>

            {/* Right Column - Results */}
            <div className="space-y-6">
                {analysis ? (
                    <>
                        {/* Score Card */}
                        <div className="glass-card rounded-2xl p-6 glow-teal">
                            <div className="text-center mb-6">
                                <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r ${getScoreColor(analysis.overallScore)} mb-3`}>
                                    <span className="text-4xl font-bold text-white">{analysis.overallScore}</span>
                                </div>
                                <p className="text-gray-400">Posture Score</p>
                                <p className={`text-sm font-medium mt-1 ${analysis.overallStatus === 'good' ? 'text-emerald-400' :
                                        analysis.overallStatus === 'moderate' ? 'text-amber-400' : 'text-red-400'
                                    }`}>
                                    {analysis.overallStatus === 'good' ? 'Excellent Alignment' :
                                        analysis.overallStatus === 'moderate' ? 'Needs Attention' : 'Significant Deviation'}
                                </p>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {Object.values(analysis.metrics).map((metric, idx) => (
                                    <div key={idx} className={`p-4 rounded-xl border ${getStatusBgColor(metric.status)}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium opacity-80">{metric.label}</span>
                                            <span className="text-lg">{getStatusEmoji(metric.status)}</span>
                                        </div>
                                        <div className="text-2xl font-bold">{metric.value}°</div>
                                        <p className="text-xs opacity-70 mt-1 line-clamp-2">{metric.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recommendations */}
                        <div className="glass-card rounded-2xl p-6 glow-coral">
                            <h3 className="text-lg font-serif text-white mb-4">💪 Recommendations</h3>
                            <div className="space-y-3">
                                {Object.values(analysis.metrics)
                                    .filter(m => m.status !== 'good')
                                    .map((metric, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                                            <span className="text-orange-400 mt-0.5">
                                                {idx + 1}.
                                            </span>
                                            <div>
                                                <p className="text-white text-sm font-medium">{metric.label}</p>
                                                <p className="text-gray-400 text-xs mt-1">{metric.recommendation}</p>
                                            </div>
                                        </div>
                                    ))}
                                {Object.values(analysis.metrics).every(m => m.status === 'good') && (
                                    <p className="text-emerald-400 text-center py-4">
                                        ✨ Great posture! Keep up the good work!
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* SOAP Note */}
                        {soapNote && (
                            <div className="glass-card rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-serif text-white">📋 SOAP Note</h3>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(soapNote)}
                                        className="px-3 py-1.5 bg-teal-500/20 text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-500/30 transition-all"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <div className="text-gray-300 text-sm whitespace-pre-wrap bg-white/5 rounded-xl p-4 max-h-64 overflow-y-auto font-mono">
                                    {soapNote}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="glass-card rounded-2xl p-6 glow-teal">
                        <div className="h-96 flex items-center justify-center text-gray-500">
                            <div className="text-center">
                                <div className="text-6xl mb-4 opacity-20">🦴</div>
                                <p className="mb-2">No analysis yet</p>
                                <p className="text-sm text-gray-600">Upload or capture a photo to begin</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Offline Info */}
                <div className="glass-card rounded-2xl p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔒</span>
                        <div>
                            <p className="text-emerald-400 text-sm font-medium">100% Private & Offline</p>
                            <p className="text-gray-400 text-xs">All analysis runs locally. No images are uploaded.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OfflinePostureAnalyzer;
export { analyzePosture, generateOfflineSOAPNote, POSTURE_THRESHOLDS, LANDMARKS };
