import { cookies } from "next/headers";

export type Lang = "tr" | "en";

export async function getLang(): Promise<Lang> {
  return (await cookies()).get("lang")?.value === "en" ? "en" : "tr";
}

const tr = {
  title: "Kampüste Dinlenme Anketi",
  subtitle: "42 Istanbul · uyuma/uyuklama kuralı",
  intro:
    "Şu an kampüste uyumak veya uyuklamak TIG sebebi. Bu ankette, aşağıdaki kurallar ve sınırlar altında dinlenmeye izin verilmesini isteyip istemediğini soruyoruz. Sonuçlar kampüs direktörüne ve pedagoji ekibine sunulacak.",
  anonTitle: "Tamamen anonim",
  anon:
    "Intra girişi sadece herkesin bir kez oy vermesi için. Kimliğin tek yönlü bir hash'e çevrilir; cevapların bu hash'le bile ilişkilendirilmez. Adminler dahil kimse kimin ne cevap verdiğini göremez.",
  dataTitle: "Neden bu kurallar?",
  data:
    "26 Ekim – 9 Kasım arası 330 bilgisayarın kullanım verisine göre 00:00–07:00 arasında aynı anda en fazla 6 bilgisayar kullanılmış (ortalama 1,9). 1. kattaki m20–m27 sıralarındaki 54 bilgisayarın gece aynı anda en fazla 2'si dolu olmuş. Yani gece dinlenme alanı kimsenin çalışmasını engellemez.",
  login: "Intra ile giriş yap ve oy ver",
  closed: "Anket şu an kapalı.",
  rulesTitle: "Önerilen kurallar",
  q1: "Bu kurallar altında kampüste dinlenmeye/uyuklamaya izin verilmeli mi?",
  yes: "Evet",
  no: "Hayır",
  ruleQ: "Bu kurala katılıyor musun?",
  agree: "Katılıyorum",
  disagree: "Katılmıyorum",
  ruleComment: "Bu kural hakkında not (isteğe bağlı)",
  reason: "Hayır dediysen: neden? (isteğe bağlı)",
  suggestion: "Eklemek istediğin bir kural var mı? (isteğe bağlı)",
  comment: "Başka söylemek istediğin bir şey? (isteğe bağlı)",
  final: "Gönderdikten sonra cevaplarımı değiştiremeyeceğimi anlıyorum.",
  submit: "Gönder",
  optionalHint: "Lütfen isim, login veya seni tanıtacak bilgi yazma.",
  thanksTitle: "Teşekkürler!",
  thanks: "Oyun kaydedildi. Cevabın anonim ve değiştirilemez.",
  already: "Bu hesapla zaten oy verilmiş. Her öğrenci bir kez oy verebilir.",
  logout: "Çıkış",
  err: {
    not_student: "Sadece 42 öğrencileri oy verebilir.",
    inactive: "Hesabın aktif değil.",
    campus: "Sadece 42 Istanbul öğrencileri oy verebilir.",
    cursus: "Sadece aktif 42cursus öğrencileri oy verebilir (blackhole/bitmiş cursus hariç).",
    state: "Giriş doğrulanamadı, tekrar dene.",
    oauth: "Intra girişi başarısız oldu, tekrar dene.",
    session: "Oturumun doldu, tekrar giriş yap.",
    invalid: "Form eksik veya hatalı. Tüm zorunlu soruları cevapla.",
    closed: "Anket kapalı.",
  } as Record<string, string>,
};

const en: typeof tr = {
  title: "Campus Rest Survey",
  subtitle: "42 Istanbul · sleeping/dozing rule",
  intro:
    "Right now sleeping or dozing on campus earns a TIG. This survey asks whether resting should be allowed under the rules and limits below. Results will be presented to the campus director and the pedagogy team.",
  anonTitle: "Fully anonymous",
  anon:
    "Intra login is only used so that everyone votes once. Your id is turned into a one-way hash, and your answers are not linked even to that hash. Nobody, admins included, can see who answered what.",
  dataTitle: "Why these rules?",
  data:
    "Seat data for 330 computers from 26 Oct to 9 Nov shows at most 6 computers in use at the same time between 00:00 and 07:00 (1.9 on average). On floor 1, rows m20–m27 have 54 computers and at most 2 were in use at once at night. A night rest area would not block anyone who wants to work.",
  login: "Log in with intra and vote",
  closed: "The survey is closed.",
  rulesTitle: "Proposed rules",
  q1: "Under these rules, should resting/dozing be allowed on campus?",
  yes: "Yes",
  no: "No",
  ruleQ: "Do you agree with this rule?",
  agree: "Agree",
  disagree: "Disagree",
  ruleComment: "Note on this rule (optional)",
  reason: "If you said no: why? (optional)",
  suggestion: "Any rule you would add? (optional)",
  comment: "Anything else? (optional)",
  final: "I understand my answers cannot be changed after submitting.",
  submit: "Submit",
  optionalHint: "Please do not write your name, login or anything that identifies you.",
  thanksTitle: "Thank you!",
  thanks: "Your vote is recorded. It is anonymous and cannot be changed.",
  already: "This account has already voted. Each student can vote once.",
  logout: "Log out",
  err: {
    not_student: "Only 42 students can vote.",
    inactive: "Your account is not active.",
    campus: "Only 42 Istanbul students can vote.",
    cursus: "Only active 42cursus students can vote (blackholed/finished cursus excluded).",
    state: "Login could not be verified, please try again.",
    oauth: "Intra login failed, please try again.",
    session: "Your session expired, please log in again.",
    invalid: "The form is incomplete. Please answer all required questions.",
    closed: "The survey is closed.",
  },
};

export const dict = { tr, en };
export const t = (l: Lang) => dict[l];
