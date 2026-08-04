import React, { useState, useRef, useEffect, useCallback } from 'react'
import maleVideo from "../assets/videos/male-ai.mp4"
import femaleVideo from "../assets/videos/female-ai.mp4"
import Timer from './Timer'
import CodingWorkspace from './CodingWorkspace'
import { FaMicrophone, FaMicrophoneSlash, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import { BsArrowRight, BsExclamationTriangle } from 'react-icons/bs';
import axios from "axios"
import { motion as Motion } from "motion/react"
import { ServerUrl } from '../config'
import { useStreamingSpeechRecognition } from '../hooks/useStreamingSpeechRecognition'

// 🤖 Explicit Voice State transition rules
const VALID_TRANSITIONS = {
  IDLE: ["LISTENING", "ERROR"],
  LISTENING: ["PROCESSING", "ERROR"],
  PROCESSING: ["SPEAKING", "ERROR"],
  SPEAKING: ["STOPPING", "ERROR"],
  STOPPING: ["IDLE", "ERROR"],
  ERROR: ["IDLE"]
};


function Step2Interview({ interviewData, onFinish }) {
  const { interviewId, questions: initialQuestions, userName, mode, interactionMedium = "Voice", totalQuestions = 5 } = interviewData;

  const [questionsList, setQuestionsList] = useState(initialQuestions);
  // Synchronous ref to prevent React batching state latency issues
  const questionsListRef = useRef(initialQuestions);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [code, setCode] = useState("// Write your solution here...\nfunction solution() {\n  \n}");
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(questionsList[0]?.timeLimit || 60);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceGender, setVoiceGender] = useState("female");
  const [subtitle, setSubtitle] = useState("");
  const [isIntroPhase, setIsIntroPhase] = useState(true);

  // Custom loading message and timer lifecycle guards
  const [loadingMessage, setLoadingMessage] = useState("");
  const timerHandledRef = useRef(false);
  const autoNextTimeoutRef = useRef(null);

  // Microphone and State Machine variables
  const [isMicOn, setIsMicOn] = useState(interactionMedium === "Voice");
  const [micStatus, setMicStatus] = useState("Idle"); // Listening, Speaking, Processing, Idle, Error, Permission Denied, Reconnecting
  const [isAIPlaying, setIsAIPlaying] = useState(false);

  // 🤖 Voice state machine tracking
  const [voiceState, setVoiceState] = useState("IDLE");
  const voiceStateRef = useRef("IDLE");

  // Sync ref immediately to block asynchronous SpeechSynthesis queuing delays
  const isAISpeakingRef = useRef(false);

  // Real-time Streaming Speech Recognition Hook
  const handleTranscriptChange = useCallback((text) => {
    if (text) {
      setAnswer(text);
    }
  }, []);

  const {
    isListening: isSpeechListening,
    micStatus: streamingMicStatus,
    partialTranscript,
    combinedTranscript,
    audioLevel,
    latencyMs,
    start: startStreamingSpeech,
    stop: stopStreamingSpeech,
    abort: abortStreamingSpeech,
    resetTranscript
  } = useStreamingSpeechRecognition({
    silenceTimeoutMs: 3000,
    autoStart: false,
    onTranscriptChange: handleTranscriptChange
  });

  // Sync ref to track native SpeechRecognition active state in browser thread
  const isRecognitionActiveRef = useRef(false);
  const timerIntervalRef = useRef(null);
  const spokenIntroRef = useRef(false);
  const spokenQuestionIndexRef = useRef(-1);
  const firstSilenceSpokenRef = useRef(false);
  const secondSilenceSpokenRef = useRef(false);

  const transitionVoiceState = useCallback((nextState) => {
    const currentState = voiceStateRef.current;
    if (currentState === nextState) return;

    // Allowed transition routes (path-finding) to satisfy the strict state transition model:
    if (currentState === "IDLE" && nextState === "SPEAKING") {
      transitionVoiceState("LISTENING");
      transitionVoiceState("PROCESSING");
      transitionVoiceState("SPEAKING");
      return;
    }
    if (currentState === "LISTENING" && nextState === "SPEAKING") {
      transitionVoiceState("PROCESSING");
      transitionVoiceState("SPEAKING");
      return;
    }
    if (currentState === "SPEAKING" && nextState === "LISTENING") {
      transitionVoiceState("STOPPING");
      transitionVoiceState("IDLE");
      transitionVoiceState("LISTENING");
      return;
    }
    if (currentState === "STOPPING" && nextState === "PROCESSING") {
      transitionVoiceState("IDLE");
      transitionVoiceState("LISTENING");
      transitionVoiceState("PROCESSING");
      return;
    }
    if (currentState === "STOPPING" && nextState === "SPEAKING") {
      transitionVoiceState("IDLE");
      transitionVoiceState("LISTENING");
      transitionVoiceState("PROCESSING");
      transitionVoiceState("SPEAKING");
      return;
    }
    if (currentState === "IDLE" && nextState === "PROCESSING") {
      transitionVoiceState("LISTENING");
      transitionVoiceState("PROCESSING");
      return;
    }
    if (currentState === "ERROR" && nextState === "SPEAKING") {
      transitionVoiceState("IDLE");
      transitionVoiceState("LISTENING");
      transitionVoiceState("PROCESSING");
      transitionVoiceState("SPEAKING");
      return;
    }
    if (currentState === "ERROR" && nextState === "LISTENING") {
      transitionVoiceState("IDLE");
      transitionVoiceState("LISTENING");
      return;
    }
    if (currentState === "PROCESSING" && nextState === "IDLE") {
      transitionVoiceState("SPEAKING");
      transitionVoiceState("STOPPING");
      transitionVoiceState("IDLE");
      return;
    }
    if (currentState === "LISTENING" && nextState === "STOPPING") {
      transitionVoiceState("PROCESSING");
      transitionVoiceState("SPEAKING");
      transitionVoiceState("STOPPING");
      return;
    }
    if (currentState === "LISTENING" && nextState === "IDLE") {
      transitionVoiceState("PROCESSING");
      transitionVoiceState("SPEAKING");
      transitionVoiceState("STOPPING");
      transitionVoiceState("IDLE");
      return;
    }
    if (currentState === "PROCESSING" && nextState === "LISTENING") {
      transitionVoiceState("SPEAKING");
      transitionVoiceState("STOPPING");
      transitionVoiceState("IDLE");
      transitionVoiceState("LISTENING");
      return;
    }
    if (currentState === "SPEAKING" && nextState === "PROCESSING") {
      transitionVoiceState("STOPPING");
      transitionVoiceState("IDLE");
      transitionVoiceState("LISTENING");
      transitionVoiceState("PROCESSING");
      return;
    }

    // Standard single-step transition
    const allowed = VALID_TRANSITIONS[currentState]?.includes(nextState);
    if (!allowed) {
      console.warn(`[Voice] Blocked illegal state transition: ${currentState} → ${nextState}`);
      return;
    }

    console.log(`[Voice] ${currentState} → ${nextState}`);
    voiceStateRef.current = nextState;
    setVoiceState(nextState);

    // Sync isAIPlaying state
    if (nextState === "SPEAKING") {
      setIsAIPlaying(true);
    } else {
      setIsAIPlaying(false);
    }
  }, []);

  const videoRef = useRef(null);

  // References to keep event handlers fresh
  const isMicOnRef = useRef(isMicOn);
  const micStatusRef = useRef(micStatus);
  const isSubmittingRef = useRef(isSubmitting);
  const feedbackRef = useRef(feedback);
  const currentQuestionRef = useRef(questionsList[currentIndex]);

  const lastSpeechTimeRef = useRef(Date.now());
  const aiSpeechStartTimeRef = useRef(0);

  const currentQuestion = questionsList[currentIndex];

  const videoSource = voiceGender === "male" ? maleVideo : femaleVideo;

  // Cleanup transcripts: remove filler words & duplicates
  const cleanTranscript = (text) => {
    if (!text) return "";
    let cleaned = text;

    const fillers = ["uh", "umm", "hmm", "like", "you know", "basically", "actually", "er", "ah"];
    fillers.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '');
    });

    // Remove consecutive duplicate words
    cleaned = cleaned.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');

    // Clean duplicate spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  };

  // Singular function responsible for recognition start, stop, and abort operations
  const controlRecognition = useCallback((action, transitionState = true) => {
    if (interactionMedium !== "Voice") return;

    if (action === "start") {
      if (
        voiceStateRef.current === "SPEAKING" ||
        voiceStateRef.current === "PROCESSING" ||
        isAISpeakingRef.current ||
        isSubmittingRef.current ||
        feedbackRef.current
      ) {
        return;
      }

      isRecognitionActiveRef.current = true;
      if (transitionState) transitionVoiceState("LISTENING");
      setMicStatus("Listening");
      startStreamingSpeech();
    } else if (action === "stop") {
      isRecognitionActiveRef.current = false;
      if (transitionState) transitionVoiceState("STOPPING");
      setMicStatus("Idle");
      stopStreamingSpeech();
    } else if (action === "abort") {
      isRecognitionActiveRef.current = false;
      if (transitionState) transitionVoiceState("STOPPING");
      setMicStatus("Idle");
      abortStreamingSpeech();
    }
  }, [interactionMedium, transitionVoiceState, startStreamingSpeech, stopStreamingSpeech, abortStreamingSpeech]);

  // Singular function responsible for speechSynthesis speak and cancel operations
  const controlSpeech = useCallback(async (action, text = "") => {
    if (interactionMedium !== "Voice" || !window.speechSynthesis) return;

    if (action === "cancel") {
      isAISpeakingRef.current = false;
      window.speechSynthesis.cancel();
      return;
    }

    if (action === "speak") {
      isAISpeakingRef.current = true;
      transitionVoiceState("SPEAKING");

      // Mutually exclusive: abort active recognition before starting TTS
      controlRecognition("abort", false);

      // Clean SpeechSynthesis queue
      window.speechSynthesis.cancel();
      let attempts = 0;
      while ((window.speechSynthesis.speaking || window.speechSynthesis.pending) && attempts < 20) {
        await new Promise((r) => setTimeout(r, 15));
        attempts++;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          console.warn("[Voice] Speech synthesis timed out.");
          isAISpeakingRef.current = false;
          transitionVoiceState("STOPPING");
          transitionVoiceState("IDLE");
          resolve();
        }, 8000);

        utterance.onstart = () => {
          clearTimeout(timeoutId);
          aiSpeechStartTimeRef.current = Date.now();
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        };

        utterance.onend = () => {
          clearTimeout(timeoutId);
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
          setSubtitle("");
          isAISpeakingRef.current = false;
          transitionVoiceState("STOPPING");
          transitionVoiceState("IDLE");

          const shouldRestart =
            isMicOnRef.current &&
            !isAISpeakingRef.current &&
            voiceStateRef.current === "IDLE" &&
            !isSubmittingRef.current &&
            !feedbackRef.current;

          if (shouldRestart) {
            controlRecognition("start");
          }
          lastSpeechTimeRef.current = Date.now();
          resolve();
        };

        utterance.onerror = (err) => {
          console.warn("[Voice] Speech synthesis error:", err);
          clearTimeout(timeoutId);
          if (videoRef.current) {
            videoRef.current.pause();
          }
          setSubtitle("");
          isAISpeakingRef.current = false;
          transitionVoiceState("ERROR");
          resolve();
        };

        setSubtitle(text);
        window.speechSynthesis.speak(utterance);
      });
    }
  }, [interactionMedium, selectedVoice, transitionVoiceState, controlRecognition]);

  // Complete the interview and render reports
  const finishInterview = useCallback(async () => {
    controlRecognition("abort");
    setIsMicOn(false);
    setIsSubmitting(true);
    setLoadingMessage("Compiling final evaluation... Analyzing overall scores... Generating report...");
    transitionVoiceState("PROCESSING");
    setMicStatus("Processing");
 
    try {
      const result = await axios.post(ServerUrl + "/api/interview/finish", { interviewId }, { withCredentials: true });
      onFinish(result.data);
    } catch (error) {
      console.error("Failed to finish interview:", error);
      alert("Failed to compile final report. Please try again.");
      transitionVoiceState("IDLE");
    } finally {
      setIsSubmitting(false);
      setLoadingMessage("");
    }
  }, [interviewId, onFinish, controlRecognition, transitionVoiceState]);

  // Move to next question or trigger completion
  const handleNext = useCallback(async () => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }

    const nextIdx = currentIndex + 1;

    // The only valid completion condition is reaching totalQuestions limit
    if (nextIdx >= totalQuestions) {
      await finishInterview();
      return;
    }

    // Safety guard: ensure the next question exists in the list before moving index
    if (nextIdx >= questionsListRef.current.length) {
      return;
    }

    setAnswer("");
    resetTranscript("");
    setCode("// Write your solution here...\nfunction solution() {\n  \n}");
    setFeedback("");
    timerHandledRef.current = false;

    const nextQuestionItem = questionsListRef.current[nextIdx];
    const nextTimeLimit = nextQuestionItem?.timeLimit || (mode === "Coding" ? 180 : 60);

    setCurrentIndex(nextIdx);
    setTimeLeft(nextTimeLimit);
    transitionVoiceState("IDLE");
  }, [currentIndex, mode, finishInterview, transitionVoiceState, totalQuestions, resetTranscript]);

  // Submit current answer to the backend
  const submitAnswer = useCallback(async () => {
    if (isSubmittingRef.current) return;
    
    // Lock timer automatically on submit
    timerHandledRef.current = true;
    
    controlRecognition("abort");
    setIsSubmitting(true);
    
    // Differentiate between timeout & manual loading text
    if (timeLeft === 0) {
      setLoadingMessage("Time's up! Submitting your answer... Generating next question...");
    } else {
      setLoadingMessage("Evaluating your answer... Generating next question...");
    }
    
    transitionVoiceState("PROCESSING");
    setMicStatus("Processing");

    const submissionAnswer = mode === "Coding" ? code : answer;
    const cleanedAnswer = cleanTranscript(submissionAnswer);

    try {
      const result = await axios.post(ServerUrl + "/api/interview/submit-answer", {
        interviewId,
        questionIndex: currentIndex,
        answer: cleanedAnswer || "No response.",
        timeTaken: questionsListRef.current[currentIndex].timeLimit - timeLeft,
      }, { withCredentials: true });

      setFeedback(result.data.feedback);
      
      // Update our local questions array synchronously using the ref to avoid asynchronous state delay
      if (result.data.nextQuestion) {
        questionsListRef.current.push(result.data.nextQuestion);
        setQuestionsList([...questionsListRef.current]);
      }

      if (interactionMedium === "Voice") {
        await controlSpeech("speak", result.data.feedback);
        await handleNext();
      } else {
        // Clear previous auto-next timeouts and register a new one
        if (autoNextTimeoutRef.current) {
          clearTimeout(autoNextTimeoutRef.current);
        }
        autoNextTimeoutRef.current = setTimeout(() => {
          handleNext();
        }, 5000);
      }
    } catch (error) {
      console.error("Answer submission failed:", error);
      alert("Submission failed. Retrying in typing mode.");
      transitionVoiceState("IDLE");
      timerHandledRef.current = false; // Allow retrying on failure
    } finally {
      setIsSubmitting(false);
      setLoadingMessage("");
    }
  }, [interviewId, currentIndex, answer, code, mode, timeLeft, interactionMedium, controlSpeech, controlRecognition, handleNext, transitionVoiceState]);

  // Microphone toggle button action
  const toggleMic = () => {
    if (micStatus === "Permission Denied" || streamingMicStatus === "Permission Denied") {
      alert("Microphone permission was denied. Please check your browser settings.");
      return;
    }

    if (isMicOn || isSpeechListening) {
      setIsMicOn(false);
      controlRecognition("abort");
    } else {
      setIsMicOn(true);
      controlRecognition("start");
    }
  };

  /* ----------------- REACT USEEFFECT LIFECYCLE HOOKS ----------------- */

  // Sync refs with state values
  useEffect(() => {
    isMicOnRef.current = isMicOn;
    micStatusRef.current = micStatus;
    isSubmittingRef.current = isSubmitting;
    feedbackRef.current = feedback;
    currentQuestionRef.current = questionsList[currentIndex];
  }, [isMicOn, micStatus, isSubmitting, feedback, questionsList, currentIndex]);

  // Cleanup auto-next timers on unmount
  useEffect(() => {
    return () => {
      if (autoNextTimeoutRef.current) {
        clearTimeout(autoNextTimeoutRef.current);
      }
    };
  }, []);

  // Initialize TTS voices
  useEffect(() => {
    if (!window.speechSynthesis) {
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      const femaleVoice = voices.find(v =>
        v.name.toLowerCase().includes("zira") ||
        v.name.toLowerCase().includes("samantha") ||
        v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("google us english")
      );

      if (femaleVoice) {
        setSelectedVoice(femaleVoice);
        setVoiceGender("female");
        return;
      }

      const maleVoice = voices.find(v =>
        v.name.toLowerCase().includes("david") ||
        v.name.toLowerCase().includes("mark") ||
        v.name.toLowerCase().includes("male")
      );

      if (maleVoice) {
        setSelectedVoice(maleVoice);
        setVoiceGender("male");
        return;
      }

      setSelectedVoice(voices[0]);
      setVoiceGender("female");
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Real-time Streaming Barge-in & Auto-start Controller
  useEffect(() => {
    if (interactionMedium !== "Voice") return;

    // Handle Streaming Barge-in (candidate speaking while AI is talking)
    if (isAISpeakingRef.current && combinedTranscript) {
      const speakDuration = Date.now() - aiSpeechStartTimeRef.current;
      if (speakDuration > 1500) { // 1.5s barge-in guard delay
        console.log("[Voice] Streaming Barge-in detected. Stopping TTS.");
        controlSpeech("cancel");
        transitionVoiceState("IDLE");
        setSubtitle("");
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
        controlRecognition("start");
      }
    }
  }, [combinedTranscript, interactionMedium, controlSpeech, transitionVoiceState, controlRecognition]);

  // Sync Microphone & Streaming STT state
  useEffect(() => {
    if (interactionMedium !== "Voice") return;

    if (
      isMicOn &&
      !isAISpeakingRef.current &&
      !isSubmitting &&
      !feedback &&
      !isIntroPhase &&
      (voiceState === "IDLE" || voiceState === "ERROR")
    ) {
      controlRecognition("start");
    }
  }, [interactionMedium, isMicOn, isIntroPhase, isSubmitting, feedback, voiceState, controlRecognition]);

  // Handle Voice / Chat Setup and Intro Phase Speech
  useEffect(() => {
    if (interactionMedium !== "Voice") {
      setIsIntroPhase(false);
      return;
    }

    if (!selectedVoice) return;

    const runIntro = async () => {
      if (isIntroPhase) {
        if (spokenIntroRef.current) return;
        spokenIntroRef.current = true;
        await controlSpeech("speak", `Hi ${userName}, it's great to meet you today. I hope you're feeling confident and ready.`);
        await controlSpeech("speak", "I'll ask you a few questions. Just answer naturally, and take your time. Let's begin.");
        setIsIntroPhase(false);
      } else if (currentQuestion) {
        if (spokenQuestionIndexRef.current === currentIndex) return;
        spokenQuestionIndexRef.current = currentIndex;
        await new Promise(r => setTimeout(r, 600));
        if (currentIndex === questionsList.length - 1) {
          await controlSpeech("speak", "Alright, this final question might be a bit more challenging.");
        }
        await controlSpeech("speak", currentQuestion.question);
      }
    };

    runIntro();
  }, [selectedVoice, isIntroPhase, currentIndex, questionsList.length, userName, controlSpeech, interactionMedium, currentQuestion]);

  // Unified Question Countdown Timer & Silence Detector (exactly one interval per question)
  useEffect(() => {
    // Clear any existing timer first
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (isIntroPhase || !currentQuestion || isSubmitting || feedback) {
      return;
    }

    // In Voice mode, pause timer while AI is speaking
    if (interactionMedium === "Voice" && (voiceState === "SPEAKING" || isAISpeakingRef.current)) {
      return;
    }

    // Reset silence flags for the active question countdown
    firstSilenceSpokenRef.current = false;
    secondSilenceSpokenRef.current = false;
    lastSpeechTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      // 1. Voice Silence Detection logic
      if (interactionMedium === "Voice" && !isAISpeakingRef.current && !isSubmittingRef.current && !feedbackRef.current) {
        const idleTime = Date.now() - lastSpeechTimeRef.current;
        if (idleTime >= 15000) {
          console.warn("Silence limit reached. Skipping...");
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          
          if (!timerHandledRef.current) {
            timerHandledRef.current = true;
            setAnswer("No response.");
            submitAnswer();
          }
          return;
        } else if (idleTime >= 10000 && !secondSilenceSpokenRef.current) {
          secondSilenceSpokenRef.current = true;
          controlSpeech("speak", "Would you like me to repeat the question?");
        } else if (idleTime >= 5000 && !firstSilenceSpokenRef.current) {
          firstSilenceSpokenRef.current = true;
          controlSpeech("speak", "I didn't catch that.");
        }
      }

      // 2. Countdown logic
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          
          if (!timerHandledRef.current && !isSubmittingRef.current && !feedbackRef.current) {
            timerHandledRef.current = true;
            console.log("[Timer] Timeout reached. Triggering automatic submission.");
            submitAnswer();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [currentIndex, isIntroPhase, currentQuestion, isSubmitting, feedback, voiceState, interactionMedium, submitAnswer, controlSpeech]);


  /* ----------------- RENDER CODING WORKSPACE ----------------- */
  if (mode === "Coding") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col p-4 sm:p-6 md:p-8">
        
        {/* Header bar */}
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between mb-4 px-4 py-3 bg-slate-900 rounded-2xl border border-slate-800">
          <span className="text-emerald-400 font-bold text-lg sm:text-xl">MockVerse IDE</span>
          <div className="flex items-center gap-4 text-slate-400 text-xs sm:text-sm">
            <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              Timer: <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit} inline={true} />
            </span>
            <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
              Medium: {interactionMedium}
            </span>
          </div>
        </div>

        {/* Workspace */}
        <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">
          <CodingWorkspace
            question={currentQuestion?.question}
            code={code}
            setCode={setCode}
            onSubmit={submitAnswer}
            isSubmitting={isSubmitting}
            feedback={feedback}
            onNext={handleNext}
            currentIndex={currentIndex}
            totalQuestions={totalQuestions}
          />
        </div>

        {/* 🔄 Premium Loading Overlay */}
        {isSubmitting && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white"
          >
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-4 border-teal-500/10 border-b-teal-400 animate-spin [animation-duration:1.5s]"></div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-emerald-400">
                  {loadingMessage || "Evaluating Solution..."}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Analyzing code structure, verifying logic, and compiling feedback report metrics.
                </p>
              </div>
            </div>
          </Motion.div>
        )}
      </div>
    );
  }

  /* ----------------- RENDER VOICE / CHAT WORKSPACE ----------------- */
  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-350 min-h-[80vh] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col lg:flex-row overflow-hidden">

        {/* Video / Subtitle section */}
        {interactionMedium === "Voice" && (
          <div className="w-full lg:w-[35%] bg-white flex flex-col items-center p-6 space-y-6 border-r border-gray-200">
            <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl bg-slate-900 aspect-video flex items-center justify-center">
              <video
                src={videoSource}
                key={videoSource}
                ref={videoRef}
                muted
                playsInline
                preload="auto"
                className="w-full h-auto object-cover"
              />
            </div>

            {/* Subtitles showing AI Speech */}
            {subtitle && (
              <div className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-gray-700 text-sm sm:text-base font-medium text-center leading-relaxed">
                  {subtitle}
                </p>
              </div>
            )}

            {/* Status Panel */}
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-md p-6 space-y-5">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-gray-500">Interview Status</span>
                <span className={`font-semibold ${isAIPlaying ? "text-emerald-600 animate-pulse" : "text-gray-400"}`}>
                  {isAIPlaying ? `AI Speaking (${voiceState})` : `State: ${voiceState}`}
                </span>
              </div>

              <div className="h-px bg-gray-200"></div>

              <div className="flex justify-center">
                <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit} />
              </div>

              <div className="h-px bg-gray-200"></div>

              <div className="grid grid-cols-2 gap-6 text-center">
                <div>
                  <span className="text-2xl font-bold text-emerald-600 block">{currentIndex + 1}</span>
                  <span className="text-xs text-gray-400">Current Question</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-emerald-600 block">{totalQuestions}</span>
                  <span className="text-xs text-gray-400">Total Questions</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat / Text Left pane spacer if in chat mode */}
        {interactionMedium === "Chat" && (
          <div className="w-full lg:w-[30%] bg-linear-to-b from-emerald-600 to-teal-700 p-8 text-white flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-4">Chat Interview</h3>
              <p className="text-emerald-100 text-sm leading-relaxed mb-6">
                Take your time to type well-structured answers. There is no speech pressure. Focus on correctness and clarity.
              </p>
              <div className="space-y-4">
                <div className="bg-emerald-800/40 p-4 rounded-xl border border-emerald-500/20">
                  <span className="text-xs text-emerald-200 block mb-1">Time Remaining:</span>
                  <div className="text-xl font-bold font-mono">
                    <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit} inline={true} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center text-xs text-emerald-200">
              Question {currentIndex + 1} of {totalQuestions}
            </div>
          </div>
        )}

        {/* Right side Question + Input section */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 relative justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-emerald-600 mb-6">
              AI Smart Interview
            </h2>

            {!isIntroPhase && currentQuestion && (
              <div className="relative mb-6 bg-gray-50 p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-400 mb-2">
                  Question {currentIndex + 1} of {totalQuestions} ({currentQuestion.difficulty} level)
                </p>
                <div className="text-base sm:text-lg font-semibold text-gray-800 leading-relaxed">
                  {currentQuestion.question}
                </div>
              </div>
            )}

            {isIntroPhase && interactionMedium === "Voice" && (
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center text-gray-600">
                AI Avatar is greeting you. Get ready...
              </div>
            )}
          </div>

          {/* Typing / Streaming Area */}
          <div className="flex-1 flex flex-col mt-4 min-h-[200px] relative">
            <textarea
              placeholder="Type your answer here or speak using the microphone..."
              onChange={(e) => setAnswer(e.target.value)}
              value={answer}
              disabled={isSubmitting || !!feedback || isIntroPhase}
              className="flex-1 w-full bg-gray-50 p-4 sm:p-6 rounded-2xl resize-none outline-none border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition text-gray-800 text-sm sm:text-base leading-relaxed"
            />
            {/* Live Partial Transcript Streaming Badge */}
            {interactionMedium === "Voice" && partialTranscript && (
              <div className="mt-2 p-2.5 px-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-xs animate-pulse">
                <span className="truncate">Streaming: <span className="italic font-semibold text-emerald-900">"{partialTranscript}"</span></span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md font-mono shrink-0 ml-2">
                  Live &lt;{latencyMs || 140}ms
                </span>
              </div>
            )}
          </div>

          {/* Controls Footer */}
          {!feedback ? (
            <div className="flex items-center gap-4 mt-6">
              {interactionMedium === "Voice" && (
                <div className="relative flex items-center justify-center">
                  {/* Dynamic Audio Level Visualizer Ring */}
                  {isMicOn && isSpeechListening && (
                    <div
                      className="absolute rounded-full bg-emerald-500/20 animate-ping pointer-events-none transition-all duration-75"
                      style={{
                        width: `${56 + (audioLevel * 0.4)}px`,
                        height: `${56 + (audioLevel * 0.4)}px`
                      }}
                    />
                  )}
                  <Motion.button
                    onClick={toggleMic}
                    whileTap={{ scale: 0.9 }}
                    disabled={isSubmitting || isIntroPhase}
                    className={`relative z-10 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full text-white shadow-lg transition-all ${
                      isMicOn ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/40 shadow-xl" : "bg-black hover:bg-slate-800"
                    } disabled:opacity-50`}
                  >
                    {isMicOn ? <FaMicrophone size={20} className={audioLevel > 15 ? "scale-110 text-white" : "animate-pulse"} /> : <FaMicrophoneSlash size={20} />}
                  </Motion.button>
                </div>
              )}

              <Motion.button
                onClick={submitAnswer}
                disabled={isSubmitting || !answer.trim() || isIntroPhase}
                whileTap={{ scale: 0.95 }}
                className="flex-1 bg-linear-to-r from-emerald-600 to-teal-500 text-white py-3 sm:py-4 rounded-2xl shadow-lg hover:opacity-90 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Evaluating..." : "Submit Answer"}
              </Motion.button>
            </div>
          ) : (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm"
            >
              <div className="flex items-start gap-2.5 mb-4">
                <div className="mt-1">
                  <FaVolumeUp className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-semibold mb-0.5">AI Feedback</p>
                  <p className="text-emerald-800 text-sm sm:text-base font-medium leading-relaxed">
                    {feedback}
                  </p>
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-linear-to-r from-emerald-600 to-teal-500 text-white py-3.5 rounded-xl shadow-md hover:opacity-90 transition flex items-center justify-center gap-1 font-semibold text-sm cursor-pointer"
              >
                {currentIndex + 1 >= totalQuestions ? "Finish & Get Report" : "Next Question"} <BsArrowRight size={18} />
              </button>
            </Motion.div>
          )}

          {/* Micro status alerts for voice */}
          {interactionMedium === "Voice" && (micStatus === "Permission Denied" || streamingMicStatus === "Permission Denied") && (
            <div className="mt-4 flex items-center gap-2 text-red-600 text-xs sm:text-sm bg-red-50 border border-red-200 p-3 rounded-xl">
              <BsExclamationTriangle size={16} />
              <span>Microphone access was denied. Please reload and allow permission.</span>
            </div>
          )}
        </div>
      </div>

      {/* 🔄 Premium Loading Overlay */}
      {isSubmitting && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white"
        >
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-teal-500/10 border-b-teal-400 animate-spin [animation-duration:1.5s]"></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-emerald-400">
                {loadingMessage || "Evaluating Answer..."}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Analyzing answer structure, comparing parameters, and generating next question.
              </p>
            </div>
          </div>
        </Motion.div>
      )}
    </div>
  )
}

export default Step2Interview
