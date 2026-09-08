# Voice and text input

Open `/voicebot` on localhost or HTTPS. Choose one of the ten languages, press **Start Speaking**, and grant microphone permission. Recognized speech is added to an editable draft. After recognition ends, review it and press **Submit Message**. Text input works without speech support. Stop Listening cancels pending recognition; speech not yet returned by the browser is discarded.

**Play Response** reads the localized greeting using an exact locale voice when available, then a same-language voice, then the browser's locale handling. **Stop Playback** cancels audio. The page refreshes the voice list when the browser reports changes. Switching language or leaving the page stops speech and listening. Playback and microphone capture do not run together.

The browser determines available recognition languages and synthesis voices; all ten language choices cannot guarantee installed voices or speech-service coverage. Recognition may use an online browser service. See [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API).

Messages now go to the server-only Gemini conversation endpoint when submitted. The page plays the latest assistant reply in the selected language and shows validated booking proposals with a separate confirmation button. Conversation history remains in page memory and clears on reload or New Conversation. Human-agent handoff is not connected yet. See [Gemini conversation setup](./gemini-chat.md).

## Verification

Run `npm run build`, then `npm run start -- --port 3100`. In another terminal run `node scripts/test-speech.mjs` (requires installed Microsoft Edge). Set `TEST_BASE_URL` if using another port. Tests simulate browser speech APIs and cover missing support, text submission, editable recognition results, permission errors, language/voice selection, stop controls, Arabic direction, and unmount cleanup.

For a physical-device check, allow microphone access, dictate a short appointment request, edit the transcript, and play the greeting. Repeat for required languages, deny permission once, and verify text input still works. Real microphone recognition quality and device voice availability are not established by the simulated tests.
