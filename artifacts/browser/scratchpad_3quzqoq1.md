# Voice Interview Debugging & Verification Checklist

- [x] List open browser pages and identify the target page
- [x] Log in if required (using 'Developer Sandbox Login')
- [x] Navigate to `/interview`
- [x] Configure Voice Interview: Frontend Engineer, 2 years, Voice Interaction Medium
- [x] Click 'Start Interview'
- [x] Monitor browser console logs for state transitions and errors
- [ ] Verify no `InvalidStateError` or `SpeechSynthesisUtterance` errors occur (FOUND InvalidStateError and SpeechSynthesisUtterance errors!)
- [ ] Verify recognition does not start twice and restarts automatically after AI finishes speaking (Recognition started twice/failed with InvalidStateError, but restarts successfully after speaking)

## Runtime Verification Findings:
1. **InvalidStateError in SpeechRecognition**:
   ```
   [error] [Voice] recognition.start() failed: InvalidStateError: Failed to execute 'start' on 'SpeechRecognition': recognition has already started.
       at client/src/components/Step2Interview.jsx:75
       at utterance.onend (client/src/components/Step2Interview.jsx:159)
   ```
   This error occurs because `recognition.start()` is called while the speech recognition is already starting or running. Specifically, the `utterance.onend` event triggers `startRecognition()`, which doesn't check whether the actual recognition is currently running or starting.

2. **SpeechSynthesisUtterance error (SpeechSynthesisErrorEvent)**:
   ```
   [error] [Voice] SpeechSynthesisUtterance error: SpeechSynthesisErrorEvent
   ```
   This error event is fired because we call `speechSynthesis.cancel()` during the `SPEAKING` state, which interrupts the ongoing utterance. When the utterance is cancelled, browser's `SpeechSynthesis` fires the `onerror` event with error `interrupted`. We need to catch and ignore this intentional interruption.


