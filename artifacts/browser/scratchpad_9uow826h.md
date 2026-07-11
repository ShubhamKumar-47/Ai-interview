# Voice Interview State Machine & Verification Document

## 1. State Machine Definition
The Speech Recognition and Synthesis engines are governed by a state machine with the following states:
*   **IDLE**: The default inactive state. SpeechRecognition is stopped; SpeechSynthesis is not speaking.
*   **LISTENING**: SpeechRecognition is active and capturing user voice input.
*   **PROCESSING**: The user answer is being evaluated by the backend/AI, waiting for response.
*   **SPEAKING**: SpeechSynthesis is active and reading out the question or feedback.
*   **STOPPING**: Transitional state during an active shutdown or abort of the SpeechRecognition interface.
*   **ERROR**: An error was caught in SpeechRecognition.
*   **RECONNECTING**: Re-establishing the SpeechRecognition listener.

---

## 2. Complete Lifecycle Diagram & Execution Paths

```
              +-------------------+
              |       IDLE        |
              +---------+---------+
                        | (start)
                        v
              +-------------------+
              |   RECONNECTING    |
              +---------+---------+
                        |
                        v
              +-------------------+
              |     LISTENING     |<-------------------+
              +----+---------+----+                    |
    (stop/abort)   |         | (error: no-speech)      |
          v        |         v                         |
  +------------+   |   +-----------+                   |
  |  STOPPING  |   |   |   ERROR   |                   |
  +-----+------+   |   +-----+-----+                   |
        |          |         |                         |
        |          v         |                         |
        |   +------------+   |                         |
        |   |  SPEAKING  |   |                         |
        |   +-----+------+   |                         |
        |         |          |                         |
        +-------->+<---------+                         |
                  |                                    |
                  v                                    |
            +------------+                             |
            |    IDLE    |-----------------------------+
            +------------+     (auto-restart checks)
```

### Detailed Execution Paths:
1.  **AI Question Presentation**:
    *   `IDLE` -> `SPEAKING`: AI TTS starts speaking.
    *   `SPEAKING` -> `STOPPING`: Interrupt or end of utterance triggers cleanup.
    *   `STOPPING` -> `IDLE`: Synthesis finishes.
    *   `IDLE` -> `RECONNECTING` -> `LISTENING`: `recognition.start()` executes.
2.  **User Speech / Input**:
    *   `LISTENING` -> `LISTENING`: Ongoing user speech/no-speech cycle.
    *   `LISTENING` -> `ERROR` (no-speech) -> `IDLE` -> `RECONNECTING` -> `LISTENING`: Auto-recovery from idle timeouts.
3.  **User Submits Answer**:
    *   `LISTENING` -> `STOPPING` -> `PROCESSING`: `recognition.stop()` is triggered.
    *   `PROCESSING` -> `SPEAKING`: AI fetches feedback and reads it.
    *   `SPEAKING` -> `STOPPING` -> `IDLE`: Feedback speech finishes.
    *   `IDLE` -> `RECONNECTING` -> `LISTENING`: Transition back to listening state for next action.

---

## 3. Verification Outcomes
*   **No Duplicate Starts**: Confirmed that `recognition.start()` execution is guarded and skipped when recognition is already active.
*   **No InvalidStateError**: State transition flow ensures `recognition.start()` is only called in `IDLE`/`RECONNECTING` state.
*   **Mutual Exclusion (STT vs TTS)**: Successfully verified that speech recognition is aborted / stopped before SpeechSynthesis starts speaking.
*   **State Transition Logs Verified**:
    *   `[Voice] IDLE → LISTENING`
    *   `[Voice] LISTENING → STOPPING`
    *   `[Voice] STOPPING → PROCESSING`
    *   `[Voice] PROCESSING → SPEAKING`
    *   `[Voice] SPEAKING → STOPPING`
    *   `[Voice] STOPPING → IDLE`
    *   `[Voice] IDLE → RECONNECTING`
    *   `[Voice] RECONNECTING → LISTENING`
