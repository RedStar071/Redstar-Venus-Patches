// translateLooksForeign decides, on the phone, whether the translate bar shows (#82). It runs for rows in "Only when you
// ask" and again for every message in a chat each time the message store changes. The old version built a RegExp and
// walked every other language's ~550 listed words per message; the new one does both once per target language.
// 300 messages of a mixed English chat, English target.
var target = "en";
function translateTarget() { return target; }
function languageBase(c) { return String(c).split("-")[0]; }
    const TRANSLATE_SCRIPTS = [["cyrl", /[\u0400-\u04ff]/], ["arab", /[\u0600-\u06ff]/], ["hebr", /[\u0590-\u05ff]/], ["deva", /[\u0900-\u097f]/],
        ["thai", /[\u0e00-\u0e7f]/], ["hang", /[\uac00-\ud7af]/], ["kana", /[\u3040-\u30ff]/], ["hani", /[\u4e00-\u9fff]/], ["grek", /[\u0370-\u03ff]/]];
    const TRANSLATE_SCRIPT_OF = {ru:"cyrl", uk:"cyrl", bg:"cyrl", sr:"cyrl", mk:"cyrl", kk:"cyrl", mn:"cyrl", ar:"arab", fa:"arab", ur:"arab", he:"hebr",
        hi:"deva", mr:"deva", ne:"deva", th:"thai", ko:"hang", ja:"kana", zh:"hani", el:"grek"};
const LATIN_LETTERS = {en:"", de:"\u00e4\u00f6\u00fc\u00df", fr:"\u00e0\u00e2\u00e6\u00e7\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u0153\u00f9\u00fb\u00fc\u00ff",
        es:"\u00e1\u00e9\u00ed\u00f1\u00f3\u00fa\u00fc", it:"\u00e0\u00e8\u00e9\u00ec\u00ed\u00f2\u00f3\u00f9\u00fa", pt:"\u00e0\u00e1\u00e2\u00e3\u00e7\u00e9\u00ea\u00ed\u00f3\u00f4\u00f5\u00fa",
        nl:"\u00e9\u00eb\u00ef\u00f6", sv:"\u00e5\u00e4\u00f6", no:"\u00e5\u00e6\u00f8", da:"\u00e5\u00e6\u00f8", fi:"\u00e4\u00f6\u00e5",
        pl:"\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c", cs:"\u00e1\u010d\u010f\u00e9\u011b\u00ed\u0148\u00f3\u0159\u0161\u0165\u00fa\u016f\u00fd\u017e",
        sk:"\u00e1\u00e4\u010d\u010f\u00e9\u00ed\u013a\u013e\u0148\u00f3\u00f4\u0155\u0161\u0165\u00fa\u00fd\u017e", hu:"\u00e1\u00e9\u00ed\u00f3\u00f6\u0151\u00fa\u00fc\u0171",
        ro:"\u0103\u00e2\u00ee\u0219\u021b\u015f\u0163", tr:"\u00e7\u011f\u0131\u00f6\u015f\u00fc", hr:"\u010d\u0107\u0111\u0161\u017e", sl:"\u010d\u0161\u017e",
        lt:"\u0105\u010d\u0119\u0117\u012f\u0161\u0173\u016b\u017e", lv:"\u0101\u010d\u0113\u0123\u012b\u0137\u013c\u0146\u0161\u016b\u017e", et:"\u00e4\u00f5\u00f6\u00fc\u0161\u017e",
        vi:"\u00e0\u00e1\u00e2\u00e3\u00e8\u00e9\u00ea\u00ec\u00ed\u00f2\u00f3\u00f4\u00f5\u00f9\u00fa\u00fd\u0103\u0111\u0129\u0169\u01a1\u01b0\u1ea1-\u1ef9",
        ca:"\u00e0\u00e7\u00e8\u00e9\u00ed\u00ef\u00f2\u00f3\u00fa\u00fc", is:"\u00e1\u00e6\u00e9\u00ed\u00f0\u00f3\u00f6\u00fa\u00fd\u00fe", ga:"\u00e1\u00e9\u00ed\u00f3\u00fa",
        sq:"\u00e7\u00eb", eo:"\u0109\u011d\u0125\u0135\u015d\u016d", gl:"\u00e1\u00e9\u00ed\u00f1\u00f3\u00fa"};
const LATIN_WORDS = {
        en:["the", "and", "you", "what", "with", "this", "that", "have", "just", "about", "from", "your", "they", "would", "there", "their", "don't", "can't", "it's", "that's"],
        es:["que", "qu\u00e9", "los", "las", "del", "una", "uno", "por", "para", "con", "sin", "pero", "como", "c\u00f3mo", "m\u00e1s", "muy", "todo", "toda", "todos", "todas", "nada", "algo", "aqu\u00ed", "ah\u00ed", "all\u00ed", "este", "esta", "esto", "estos", "estas", "ese", "esa", "eso", "est\u00e1", "est\u00e1s", "est\u00e1n", "estoy", "eres", "somos", "tengo", "tienes", "tiene", "puede", "puedo", "hacer", "hace", "decir", "dice", "dijo", "cuando", "donde", "d\u00f3nde", "quien", "qui\u00e9n", "porque", "porqu\u00e9", "tambi\u00e9n", "siempre", "nunca", "ahora", "antes", "despu\u00e9s", "bueno", "buena", "buenos", "buenas", "bien", "mal", "hola", "ola", "gracias", "usted", "nosotros", "ellos", "ellas", "mis", "tus", "sus", "nuestro", "claro", "claramente", "verdad", "hermano", "amigo", "brochachon", "tradujiste", "traducir", "noche"],
        de:["und", "nicht", "ich", "ist", "auch", "aber", "wir", "das", "noch", "schon", "danke", "ein", "eine", "einen", "einem", "mit", "auf", "f\u00fcr", "von", "sich", "sie", "dem", "den", "des", "dass", "wenn", "oder", "nur", "wie", "kann", "sind", "haben", "wird", "wurde", "werden", "jetzt", "immer", "alles", "etwas", "nichts", "warum", "hall\u00f6chen", "guten", "bitte", "gerne", "heute", "morgen", "wirklich"],
        fr:["les", "des", "est", "pas", "avec", "pour", "dans", "plus", "mais", "sur", "sont", "cette", "tout", "tous", "toute", "faire", "fait", "comme", "\u00eatre", "avoir", "nous", "vous", "ils", "elles", "leur", "leurs", "m\u00eame", "aussi", "tr\u00e8s", "bien", "peut", "suis", "sais", "veux", "quand", "comment", "pourquoi", "bonjour", "salut", "merci", "oui", "alors", "donc", "rien", "quelque", "toujours", "jamais", "aujourd'hui", "c'est", "qu'il", "j'ai", "n'est"],
        it:["che", "non", "sono", "per", "una", "con", "del", "della", "dei", "degli", "delle", "nel", "nella", "sul", "sulla", "questo", "questa", "questi", "queste", "quello", "quella", "anche", "come", "pi\u00f9", "molto", "tutto", "tutti", "fare", "fatto", "essere", "avere", "abbiamo", "hanno", "pu\u00f2", "sono", "stato", "quando", "dove", "perch\u00e9", "ciao", "grazie", "prego", "buongiorno", "sempre", "mai", "adesso", "ancora", "allora", "per\u00f2"],
        pt:["n\u00e3o", "nao", "voc\u00ea", "voce", "voc\u00eas", "com", "para", "por", "uma", "dos", "das", "nos", "nas", "pelo", "pela", "isso", "isto", "aquilo", "esse", "essa", "este", "esta", "mais", "muito", "tudo", "todos", "todas", "como", "quando", "onde", "porque", "porqu\u00ea", "est\u00e1", "estou", "est\u00e3o", "tenho", "tem", "pode", "fazer", "feito", "dizer", "disse", "tamb\u00e9m", "sempre", "nunca", "agora", "ent\u00e3o", "mas", "bom", "boa", "ol\u00e1", "ola", "oi", "obrigado", "obrigada", "valeu", "gente", "cara"],
        nl:["een", "het", "van", "dat", "niet", "voor", "met", "zijn", "ook", "maar", "naar", "bij", "nog", "wel", "geen", "meer", "deze", "hebben", "heeft", "heb", "kan", "worden", "wordt", "wat", "hoe", "waarom", "wanneer", "alles", "iets", "niets", "altijd", "nooit", "goed", "heel", "echt", "bedankt", "dank", "alsjeblieft"],
        sv:["och", "att", "det", "som", "f\u00f6r", "p\u00e5", "med", "inte", "har", "den", "till", "fr\u00e5n", "n\u00e4r", "kan", "ska", "vill", "alla", "mycket", "bara", "eller", "men", "h\u00e4r", "d\u00e4r", "varf\u00f6r", "n\u00e5got", "inget", "alltid", "aldrig", "jag", "dig", "mig", "\u00e4r", "hej", "tack"],
        pl:["jest", "nie", "tak", "czy", "si\u0119", "dzi\u0119ki", "ale", "jak", "dla", "tego", "tylko", "jeszcze", "bardzo", "wszystko", "kiedy", "gdzie", "dlaczego", "mo\u017ce", "mam", "masz", "mamy", "by\u0107", "by\u0142", "by\u0142a", "b\u0119dzie", "cze\u015b\u0107", "dobrze", "prosz\u0119"],
        tr:["bir", "ve", "bu", "ne", "\u00e7ok", "te\u015fekk\u00fcrler", "i\u00e7in", "ile", "ama", "daha", "gibi", "var", "yok", "ben", "sen", "biz", "siz", "onlar", "olan", "olarak", "kadar", "sonra", "\u00f6nce", "\u015fimdi", "neden", "nas\u0131l", "nerede", "merhaba", "selam", "evet", "hay\u0131r", "iyi", "g\u00fczel"],
        id:["yang", "dan", "tidak", "ini", "itu", "aku", "kamu", "terima", "untuk", "dengan", "dari", "pada", "dalam", "bisa", "akan", "sudah", "belum", "lagi", "juga", "saja", "kalau", "karena", "tapi", "atau", "apa", "siapa", "dimana", "kapan", "kenapa", "bagaimana", "banyak", "semua", "sangat", "sekali", "kasih", "halo", "baik", "enggak", "gak", "udah", "banget"],
        ro:["este", "sunt", "pentru", "care", "dar", "mai", "foarte", "doar", "c\u00e2nd", "unde", "cum", "dac\u0103", "fost", "avea", "face", "spune", "bine", "mul\u021bumesc", "salut", "nimic", "totul"],
        cs:["jsem", "jsi", "jsou", "nen\u00ed", "ale", "jako", "pro", "kdy\u017e", "kde", "jak", "pro\u010d", "velmi", "v\u0161echno", "nic", "n\u011bco", "dobr\u00fd", "d\u00edky", "ahoj", "pros\u00edm"],
        hu:["hogy", "nem", "van", "egy", "meg", "csak", "m\u00e9g", "m\u00e1r", "mint", "vagy", "lesz", "volt", "nagyon", "minden", "semmi", "valami", "mikor", "hol", "mi\u00e9rt", "hogyan", "k\u00f6sz\u00f6n\u00f6m", "szia", "igen"],
        fi:["ett\u00e4", "ei", "ole", "oli", "mutta", "kun", "jos", "niin", "vain", "my\u00f6s", "kuin", "mit\u00e4", "miss\u00e4", "milloin", "miksi", "miten", "kaikki", "jotain", "hyv\u00e4", "kiitos", "hei", "moi"],
        vi:["c\u1ee7a", "v\u00e0", "l\u00e0", "c\u00f3", "kh\u00f4ng", "\u0111\u01b0\u1ee3c", "trong", "cho", "v\u1edbi", "n\u00e0y", "\u0111\u00f3", "nh\u1eefng", "m\u1ed9t", "c\u00e1c", "ng\u01b0\u1eddi", "nh\u01b0", "khi", "th\u00ec", "m\u00e0", "r\u1ea5t", "nhi\u1ec1u", "c\u1ea3m", "\u01a1n", "xin", "ch\u00e0o"]};
    function looksOld(text) {
        if (typeof text !== "string" || text.length < 2) return false;
        const target = translateTarget(), base = languageBase(target), want = TRANSLATE_SCRIPT_OF[base] || null;
        if (/[\u00a1\u00bf]/.test(text) && base !== "es" && base !== "gl" && base !== "ca") return true;
        let found = null;
        for (let i = 0; i < TRANSLATE_SCRIPTS.length && !found; i++) if (TRANSLATE_SCRIPTS[i][1].test(text)) found = TRANSLATE_SCRIPTS[i][0];
        // Japanese is written with kanji too, so kanji alone never shows the bar to a Japanese reader.
        if (found === "hani" && base === "ja") return false;
        if (found) return found !== want;
        const words = text.toLowerCase().replace(/https?:\/\/\S+|<[^>]*>|:[\w~]+:/g, " ").match(/[a-z\u00c0-\u024f\u1e00-\u1eff']+/g);
        if (!words || !words.some(word => word.length > 2)) return false;
        // Latin text for someone reading a non-Latin language.
        if (want) return true;
        const own = LATIN_LETTERS[base];
        if (own === undefined) return false;
        const allowed = new RegExp("[^a-z'" + own + "]");
        let marked = 0;
        for (const word of words) if (allowed.test(word) && ++marked >= 1 && (marked >= 2 || words.length <= 6)) return true;
        let other = marked, english = 0;
        const ownWords = new Set(LATIN_WORDS[base] || []), seen = new Set(), wordSet = new Set(words);
        for (const code in LATIN_WORDS) {
            if (code === base) continue;
            for (const word of LATIN_WORDS[code]) if (!ownWords.has(word) && !seen.has(word) && wordSet.has(word)) { seen.add(word); other++; }
        }
        if (other >= 2 || other >= 1 && words.length <= 6) return true;
        if (base === "en") {
            for (const word of LATIN_WORDS.en) if (wordSet.has(word)) english++;
            // Longer Latin sentence with zero common English words and typical Romance/Germanic morphology.
            if (!english && words.length >= 3 && words.some(w => /(?:mente|ci\u00f3n|si\u00f3n|ando|iendo|aste|iste|aron|ieron|ch\u00f6n|ung|keit|heit|lich|isch|aux|eux|oir|aient|zione|ggi|nho|lho|zinho|\u00e3o|\u00f5es)$/.test(w))) return true;
        }
        return false;
    }
    // Per target language, worked out once: the letters it doesn't use, and every other language's everyday words that
    // aren't its own. looksNew runs for rows and on every message change in a chat, so it no longer builds a
    // RegExp and walks ~550 listed words for each message (tests/bench/translate_foreign.js).
    const translateForeignPlans = new Map();
    function translateForeignPlan(base) {
        if (translateForeignPlans.has(base)) return translateForeignPlans.get(base);
        const own = LATIN_LETTERS[base];
        let plan = null;
        if (own !== undefined) {
            const ownWords = new Set(LATIN_WORDS[base] || []), foreign = new Set();
            for (const code in LATIN_WORDS) if (code !== base) for (const word of LATIN_WORDS[code]) if (!ownWords.has(word)) foreign.add(word);
            plan = {allowed:new RegExp("[^a-z'" + own + "]"), foreign};
        }
        translateForeignPlans.set(base, plan);
        return plan;
    }
    function looksNew(text) {
        if (typeof text !== "string" || text.length < 2) return false;
        const target = translateTarget(), base = languageBase(target), want = TRANSLATE_SCRIPT_OF[base] || null;
        if (/[\u00a1\u00bf]/.test(text) && base !== "es" && base !== "gl" && base !== "ca") return true;
        let found = null;
        for (let i = 0; i < TRANSLATE_SCRIPTS.length && !found; i++) if (TRANSLATE_SCRIPTS[i][1].test(text)) found = TRANSLATE_SCRIPTS[i][0];
        // Japanese is written with kanji too, so kanji alone never shows the bar to a Japanese reader.
        if (found === "hani" && base === "ja") return false;
        if (found) return found !== want;
        const words = text.toLowerCase().replace(/https?:\/\/\S+|<[^>]*>|:[\w~]+:/g, " ").match(/[a-z\u00c0-\u024f\u1e00-\u1eff']+/g);
        if (!words || !words.some(word => word.length > 2)) return false;
        // Latin text for someone reading a non-Latin language.
        if (want) return true;
        const plan = translateForeignPlan(base);
        if (!plan) return false;
        let marked = 0;
        for (const word of words) if (plan.allowed.test(word) && ++marked >= 1 && (marked >= 2 || words.length <= 6)) return true;
        // Everyday words of other languages, looked up per word of the message, not per word of every list.
        let other = marked, english = 0;
        const wordSet = new Set(words);
        wordSet.forEach(word => { if (plan.foreign.has(word)) other++; });
        if (other >= 2 || other >= 1 && words.length <= 6) return true;
        if (base === "en") {
            for (const word of LATIN_WORDS.en) if (wordSet.has(word)) english++;
            // Longer Latin sentence with zero common English words and typical Romance/Germanic morphology.
            if (!english && words.length >= 3 && words.some(w => /(?:mente|ci\u00f3n|si\u00f3n|ando|iendo|aste|iste|aron|ieron|ch\u00f6n|ung|keit|heit|lich|isch|aux|eux|oir|aient|zione|ggi|nho|lho|zinho|\u00e3o|\u00f5es)$/.test(w))) return true;
        }
        return false;
    }
var samples = ["hey did you see the new update", "lol yes it looks great", "who's coming tonight?", "Gracias amigo, nos vemos",
    "die hard is the best christmas movie", "I had a café latte this morning", "ok", "brb dinner", "check this https://example.com/a",
    "Ich weiß nicht, was du meinst", "that's what she said", "anyone up for ranked later", "c'est la vie", "pizza or tacos?",
    "the server is down again", "je ne sais pas trop", "this is so cool", "<@123> look at this :thumbsup:", "nah", "Привет всем"];
var chat = []; for (var i = 0; i < 300; i++) chat.push(samples[i % samples.length] + (i % 7 ? "" : " " + i));
for (var t = 0; t < 2; t++) { target = t ? "de" : "en"; for (var i = 0; i < chat.length; i++) if (looksOld(chat[i]) !== looksNew(chat[i])) throw new Error("mismatch " + target + " " + chat[i]); }
target = "en";
bench("old: RegExp and word lists per message (300 messages)", function () { for (var i = 0; i < chat.length; i++) looksOld(chat[i]); });
bench("new: plan per language (300 messages)", function () { for (var i = 0; i < chat.length; i++) looksNew(chat[i]); });
