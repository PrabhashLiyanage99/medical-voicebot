export type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};
export function recognitionConstructor() {
  const browser = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
export function recognitionError(code: string) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed": return "Microphone access was denied. Allow it in browser settings or type below.";
    case "audio-capture": return "No microphone is available. Check your microphone or type below.";
    case "network": return "The speech service could not connect. Try again or type below.";
    case "no-speech": return "No speech was detected. Try again or type below.";
    case "language-not-supported": return "Speech recognition does not support this language on your device. Please type below.";
    default: return "Speech recognition stopped. Try again or type below.";
  }
}
export function matchingVoice(voices: SpeechSynthesisVoice[], language: string) {
  const normalize = (value: string) => value.toLowerCase().replaceAll("_", "-");
  return voices.find((voice) => normalize(voice.lang) === normalize(language))
    ?? voices.find((voice) => normalize(voice.lang).split("-")[0] === language.split("-")[0]);
}
export const greetings: Record<string, string> = {
  "en-US": "Hello! Please tell me your preferred doctor, appointment date and time. This assistant does not provide diagnoses or prescriptions.",
  "si-LK": "ආයුබෝවන්! ඔබ කැමති වෛද්‍යවරයා, දිනය සහ වේලාව සඳහන් කරන්න. මෙම සහායකයා රෝග විනිශ්චය හෝ ඖෂධ නිර්දේශ ලබා නොදෙයි.",
  "ta-LK": "வணக்கம்! நீங்கள் விரும்பும் மருத்துவர், தேதி மற்றும் நேரத்தைக் கூறுங்கள். இந்த உதவியாளர் நோயறிதல் அல்லது மருந்துப் பரிந்துரைகளை வழங்காது.",
  "hi-IN": "नमस्ते! कृपया अपने पसंदीदा डॉक्टर, तारीख और समय बताएं। यह सहायक निदान या दवा के नुस्खे नहीं देता है।",
  "ar-SA": "مرحباً! يرجى تحديد الطبيب والتاريخ والوقت المفضل للموعد. لا يقدم هذا المساعد تشخيصات أو وصفات طبية.",
  "fr-FR": "Bonjour ! Indiquez le médecin, la date et l’heure souhaités. Cet assistant ne fournit ni diagnostic ni ordonnance.",
  "de-DE": "Hallo! Bitte nennen Sie den gewünschten Arzt, das Datum und die Uhrzeit. Dieser Assistent stellt keine Diagnosen und verschreibt keine Medikamente.",
  "es-ES": "¡Hola! Indique el médico, la fecha y la hora que prefiere. Este asistente no ofrece diagnósticos ni recetas.",
  "it-IT": "Buongiorno! Indichi il medico, la data e l’ora che preferisce. Questo assistente non fornisce diagnosi o prescrizioni.",
  "zh-CN": "您好！请告诉我您希望预约的医生、日期和时间。本助手不提供诊断或处方。",
};
