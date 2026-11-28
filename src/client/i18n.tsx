import { createContext, useContext } from "react";
export type Lang = "en" | "hi";
export const Language = createContext<Lang>("en");
export function useText() {
  const lang = useContext(Language);
  return (en: string, hi: string) => (lang === "hi" ? hi : en);
}
import fieldVisitBounds from "../shared/field-visit-bounds.json";
const runtimeHindi: Record<string, string> = {
  "Initial balances not configured": "प्रारंभिक शेष दर्ज नहीं हैं",
  "Enter a valid value": "वैध मान दर्ज करें",
  "Enter a valid date": "वैध तिथि दर्ज करें",
  "Reporting start date is required": "रिपोर्टिंग प्रारंभ तिथि आवश्यक है",
  "Reporting start date cannot be in the future": "रिपोर्टिंग प्रारंभ तिथि भविष्य की नहीं हो सकती",
  "Enter a whole number from 0 to 1,000,000,000": "0 से 1,000,000,000 के बीच पूर्ण संख्या दर्ज करें",
  "Enter a whole number": "पूर्ण संख्या दर्ज करें",
  // The field visit's details messages (MonitoringFieldVisitService). Drafted,
  // not settled: they wait on RMC's reviewer with the rest of the visit form.
  "This activity does not ask for this detail": "यह गतिविधि यह विवरण नहीं माँगती",
  "Enter a number from 0 to 1,000,000,000": "0 से 1,000,000,000 के बीच संख्या दर्ज करें",
  "Select one of the listed options": "सूची में से एक विकल्प चुनें",
  "Enter text": "पाठ दर्ज करें",
  // The two length messages are keyed by the bounds the server and the form share
  // (field-visit-bounds.json), so a changed bound moves the key with it.
  [`Shorten this to ${fieldVisitBounds.textMax} characters or fewer`]: `इसे अधिकतम ${fieldVisitBounds.textMax} अक्षर तक छोटा करें`,
  [`Shorten this to ${fieldVisitBounds.textAreaMax} characters or fewer`]: `इसे अधिकतम ${fieldVisitBounds.textAreaMax} अक्षर तक छोटा करें`,
  // The 409 a double-tapped submit on an edited payload draws (pre-existing, no key until now).
  "This request identifier was already used for different data": "यह अनुरोध पहचानकर्ता पहले अलग डेटा के लिए उपयोग हो चुका है",
  "Enter a number of 0 or more": "0 या उससे अधिक संख्या दर्ज करें",
  "Enter a number up to 1,000,000,000": "अधिकतम 1,000,000,000 तक संख्या दर्ज करें",
  "Completed cannot exceed received": "निस्तारित प्राप्त से अधिक नहीं हो सकते",
  "Resolved complaints cannot exceed received": "निस्तारित शिकायतें प्राप्त शिकायतों से अधिक नहीं हो सकतीं",
  "Completed field tasks cannot exceed received": "पूर्ण क्षेत्रीय कार्य प्राप्त कार्यों से अधिक नहीं हो सकते",
  // New server literal, from MonitoringRules.ValidateEntry. It reaches the
  // office through the entry form's unhandled list, so without a key here it
  // would show in English to a Hindi reader.
  "Nothing to report cannot be combined with reported figures":
    "कुछ रिपोर्ट नहीं के साथ कोई आंकड़ा दर्ज नहीं किया जा सकता",
  // Review reasons are English literals from the server, translated by exact
  // key match with a silent English fallback. The server stopped sending
  // "SLA < 90%", "Complaints pending > 5" and "Field tasks pending > 10"; these
  // two must stay byte-identical to the server's and to ledger.ts's mirror.
  "Pending > 10": "लंबित कार्य > 10",
  "Disposal < 90%": "निस्तारण < 90%",
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
  // Keyed to the server's own wording ("Try again later."), which this key used
  // to disagree with, so its Hindi never applied. Drafted, not settled; waits on
  // RMC's reviewer.
  "Too many attempts. Try again later.":
    "बहुत अधिक प्रयास। बाद में पुनः प्रयास करें।",
  "Enter rupees with at most two decimal places":
    "राशि अधिकतम दो दशमलव स्थानों में दर्ज करें",
  "Amount too large": "राशि बहुत अधिक है",
  "Cannot exceed completed cases": "पूर्ण मामलों से अधिक नहीं हो सकता",
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
  // Keyed to the server's own wording (MonitoringRules.ValidateRoute), which this
  // key used to disagree with ("Service date ..."), so its Hindi never applied.
  // The Hindi is unchanged and still waits on RMC's reviewer.
  "Date is outside this reporting route":
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
  "A visit can only be recorded on the day it was made":
    "निरीक्षण उसी दिन दर्ज किया जा सकता है जिस दिन वह किया गया",
  "Enter a valid time": "वैध समय दर्ज करें",
  "Select an Anchal": "अंचल चुनें",
  "Select a ward from 1 to 53": "1 से 53 के बीच वार्ड चुनें",
  "Select an activity": "गतिविधि चुनें",
  "Describe what was seen and what is to be done (at least 20 characters)":
    "क्या देखा गया और क्या किया जाना है, लिखें (कम से कम 20 अक्षर)",
  "Capture the location at the site": "मौके पर स्थान कैप्चर करें",
  "Enter your current password": "अपना वर्तमान पासवर्ड दर्ज करें",
  "Use at least 10 characters": "कम से कम 10 अक्षर रखें",
  "Choose a password you have not used here before":
    "ऐसा पासवर्ड चुनें जो आपने यहाँ पहले उपयोग न किया हो",
  "Both passwords must match": "दोनों पासवर्ड समान होने चाहिए",
  "Give a reason for voiding this visit":
    "इस निरीक्षण को निरस्त करने का कारण दें",
  "Enter a username": "उपयोगकर्ता नाम दर्ज करें",
  "Enter the officer's name": "अधिकारी का नाम दर्ज करें",
  "Enter a designation": "पदनाम दर्ज करें",
  // Server messages. Native-reader review pending.
  "Change your temporary password before using the portal":
    "पोर्टल का उपयोग करने से पहले अपना अस्थायी पासवर्ड बदलें",
  "Select a valid role": "वैध भूमिका चुनें",
  "That username is already taken": "यह उपयोगकर्ता नाम पहले से लिया जा चुका है",
  "Officer not found": "अधिकारी नहीं मिला",
  // MonitoringRules.ValidateEntry: a daily entry for a field-work service. Drafted,
  // not settled; waits on RMC's reviewer. Field officer = क्षेत्रीय अधिकारी (the
  // officer role elsewhere), field work = क्षेत्रीय कार्य (the group heading the
  // entry list used), daily entry = दैनिक प्रविष्टि (as in the deactivation notice).
  "Field work is reported by field officers, not on the daily entry":
    "क्षेत्रीय कार्य की रिपोर्ट क्षेत्रीय अधिकारी देते हैं, दैनिक प्रविष्टि में नहीं",
  // The other refusal on the same `serviceId` key (an id outside the master, or
  // an unreadable dashboard filter). Drafted, not settled; waits on RMC's reviewer.
  "Select a service": "सेवा चुनें",
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
