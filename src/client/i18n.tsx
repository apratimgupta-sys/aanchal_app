import { createContext, useContext } from "react";
export type Lang = "en" | "hi";
export const Language = createContext<Lang>("en");
export function useText() {
  const lang = useContext(Language);
  return (en: string, hi: string) => (lang === "hi" ? hi : en);
}
const runtimeHindi: Record<string, string> = {
  "Initial balances not configured": "प्रारंभिक शेष दर्ज नहीं हैं",
  "Pending > 10": "लंबित कार्य > 10",
  "Disposal < 90%": "निस्तारण < 90%",
  "SLA < 90%": "समय सीमा में निस्तारण < 90%",
  "Complaints pending > 5": "लंबित शिकायतें > 5",
  "Field tasks pending > 10": "लंबित क्षेत्रीय कार्य > 10",
  "Entry submitted": "प्रविष्टि जमा की गई",
  "Entry corrected": "प्रविष्टि सुधारी गई",
  "Initial balances configured": "प्रारंभिक शेष दर्ज किए गए",
  "Reporting start extended for back-entry":
    "पूर्व तिथि प्रविष्टि के लिए रिपोर्टिंग प्रारंभ बढ़ाया गया",
  "Existing opening balances reused for earlier service date":
    "पूर्व सेवा तिथि के लिए मौजूदा प्रारंभिक शेष उपयोग किया गया",
  "Initial balances corrected": "प्रारंभिक शेष सुधारे गए",
  "Please correct the highlighted fields": "चिह्नित फ़ील्ड सुधारें",
  "Invalid username or password": "उपयोगकर्ता नाम या पासवर्ड गलत है",
  "Please sign in": "कृपया लॉगिन करें",
  "Enter username and password": "उपयोगकर्ता नाम और पासवर्ड दर्ज करें",
  "Too many attempts. Try again in one minute.":
    "बहुत अधिक प्रयास। एक मिनट बाद पुनः प्रयास करें।",
  "Enter rupees with at most two decimal places":
    "राशि अधिकतम दो दशमलव स्थानों में दर्ज करें",
  "Amount too large": "राशि बहुत अधिक है",
  "Cannot exceed completed cases": "पूर्ण मामलों से अधिक नहीं हो सकता",
  "Average days required when work is completed":
    "कार्य पूर्ण होने पर औसत दिन आवश्यक हैं",
  "Enter valid nonnegative days": "वैध गैर-ऋणात्मक दिन दर्ज करें",
  "Enter a nonnegative whole number within the allowed limit":
    "अनुमत सीमा में गैर-ऋणात्मक पूर्णांक दर्ज करें",
  "Enter ward number/name (maximum 200 characters)":
    "वार्ड संख्या/नाम दर्ज करें (अधिकतम 200 अक्षर)",
  "Remarks must be at most 2000 characters":
    "टिप्पणियाँ अधिकतम 2000 अक्षर हो सकती हैं",
  "Enter a valid date through today": "आज तक की वैध तिथि दर्ज करें",
  "Entry changed. Reload before correcting.":
    "प्रविष्टि बदल गई है। सुधार से पहले पुनः लोड करें।",
  "Initial balances changed. Reload before correcting.":
    "प्रारंभिक शेष बदल गए हैं। सुधार से पहले पुनः लोड करें।",
  "A correction reason is required (maximum 1000 characters)":
    "सुधार का कारण आवश्यक है (अधिकतम 1000 अक्षर)",
  "A correction reason is required": "सुधार का कारण आवश्यक है",
  "A delayed-reporting reason is required":
    "विलंबित रिपोर्टिंग का कारण आवश्यक है",
  "Service date is outside this reporting route":
    "सेवा तिथि इस रिपोर्टिंग मार्ग के अंतर्गत नहीं है",
  "Date precedes reporting start date": "तिथि रिपोर्टिंग प्रारंभ से पहले है",
  "Invalid reporting filters": "रिपोर्टिंग फ़िल्टर गलत हैं",
  "Unable to complete request. Please retry.":
    "अनुरोध पूरा नहीं हुआ। कृपया पुनः प्रयास करें।",
  "Configure opening balances before reporting":
    "रिपोर्टिंग से पहले प्रारंभिक शेष दर्ज करें",
  "Confirm nonnegative opening balances for all 25 services":
    "सभी 25 सेवाओं के गैर-ऋणात्मक प्रारंभिक शेष की पुष्टि करें",
  "Enter a valid reporting start date through today":
    "आज तक की वैध रिपोर्टिंग प्रारंभ तिथि दर्ज करें",
  "Start date cannot exclude existing reports":
    "प्रारंभ तिथि मौजूदा रिपोर्ट को बाहर नहीं कर सकती",
};
export function runtimeText(text: string, lang: Lang) {
  if (lang === "en") return text;
  const invalid = text.match(
    /^Invalid pending balance on (\d{4}-\d{2}-\d{2}) \(service (\d+)\)$/,
  );
  if (invalid)
    return `${invalid[1]} को सेवा ${invalid[2]} का लंबित शेष ऋणात्मक होगा`;
  return runtimeHindi[text] ?? text;
}
