# Debugging Voice Interview Engine Race Condition

## Observed Console Logs Analysis

### Active Interview Logs
When the interview starts, the following logs are observed:
```
[log] [Voice] IDLE → LISTENING
[log] [Voice] recognition.start() executed successfully.
[log] [Voice] Prevented duplicate start. Current state is: LISTENING
[log] [Voice] Speech recognition ended.
[log] [Voice] LISTENING → IDLE
[log] [Voice] Reconnecting recognition automatically...
[log] [Voice] IDLE → RECONNECTING
[log] [Voice] RECONNECTING → SPEAKING
[log] [Voice] SPEAKING → STOPPING
[log] [Voice] recognition.abort() executed.
[log] [Voice] SpeechSynthesis clean after 0ms.
[log] [Voice] STOPPING → IDLE
[log] [Voice] IDLE → LISTENING
[log] [Voice] recognition.start() executed successfully.
[log] [Voice] LISTENING → SPEAKING
[log] [Voice] SPEAKING → STOPPING
[log] [Voice] recognition.abort() executed.
[log] [Voice] SpeechSynthesis clean after 0ms.
[log] [Voice] Speech recognition ended.
[log] [Voice] STOPPING → IDLE
[log] [Voice] Reconnecting recognition automatically...
[log] [Voice] IDLE → RECONNECTING
[log] [Voice] RECONNECTING → LISTENING
[log] [Voice] recognition.start() executed successfully.
[log] [Voice] LISTENING → LISTENING
[log] [Voice] LISTENING → IDLE
[log] [Voice] IDLE → LISTENING
[error] [Voice] recognition.start() failed: InvalidStateError: Failed to execute 'start' on 'SpeechRecognition': recognition has already started.
    at Step2Interview.jsx:74:30
    at utterance.onend (Step2Interview.jsx:155:11)
```

### Hypotheses & Issues
1. **Premature Reconnection during Speaking**:
   When the AI starts speaking, it transitions the state to `SPEAKING` and calls `recognition.abort()`.
   `recognition.abort()` asynchronously triggers `recognition.onend`.
   In `onend`, the reconnect logic is executed:
   `Restart only if: interview still active, AI not speaking, mic permission granted, state == IDLE`
   However, the log shows:
   `[Voice] STOPPING → IDLE`
   `[Voice] Reconnecting recognition automatically...`
   `[Voice] IDLE → RECONNECTING`
   This means when `onend` fired, the check "AI not speaking" was evaluated as `true` (or skipped/failed), so it restarted recognition while the AI was still speaking.

2. **`LISTENING → LISTENING` transition**:
   Why is there a transition from `LISTENING` to `LISTENING`? This indicates that `setState(STATES.LISTENING)` is called when the state is already `LISTENING`, or two parallel flows are trying to set it.

3. **`InvalidStateError` in `utterance.onend`**:
   Because recognition was restarted prematurely during speaking, when the AI actually finishes speaking and `utterance.onend` fires, it tries to start recognition again. Since recognition is already running (state is `LISTENING` or `RECONNECTING`), it throws `InvalidStateError`.

### Deep Dive into Race Condition:
- **SpeechSynthesis Queuing Delay**: When `speechSynthesis.speak(utterance)` is called, the browser's speechSynthesis engine queues the utterance asynchronously. During this millisecond window, `speechSynthesis.speaking` remains `false`.
- If `recognition.abort()` is called immediately after `speak()`, the `recognition.onend` handler fires almost instantly.
- In `recognition.onend`, if the code checks `speechSynthesis.speaking` to determine if the AI is speaking, it gets `false` because of the queuing delay.
- Consequently, it thinks the AI is not speaking and triggers reconnection.
- By the time `recognition.start()` executes and transitions the state to `LISTENING`, the browser finally starts speaking the utterance.
- When the utterance ends, `utterance.onend` fires and attempts to start recognition again, throwing the `InvalidStateError`.

### Proposed Fix:
1. Introduce an explicit React ref `isAISpeakingRef = useRef(false)`.
2. Set `isAISpeakingRef.current = true` immediately before calling `speechSynthesis.speak()`.
3. Set `isAISpeakingRef.current = false` inside `utterance.onend` and `utterance.onerror`.
4. In `recognition.onend`'s reconnect check, verify `!isAISpeakingRef.current` instead of relying solely on `speechSynthesis.speaking`.
5. Ensure `recognition.start()` is only called if state is strictly `IDLE`.

## Verification of Repeat Runs
A second fresh verification run confirmed the exact same behavior:
- `InvalidStateError` occurs on `utterance.onend` call of `recognition.start()`.
- The following transitions are also logged:
  `[Voice] STOPPING → LISTENING`
  `[Voice] LISTENING → IDLE`
  `[Voice] IDLE → RECONNECTING`
  `[Voice] RECONNECTING → LISTENING`
  `[Voice] LISTENING → LISTENING`
- The UI status indicator gets stuck showing `State: STOPPING` or `State: IDLE` while the underlying voice state is in a different state (e.g. `LISTENING` or `RECONNECTING`), confirming that React state updates are either desynchronized or desynced due to unhandled promise rejections/errors.
