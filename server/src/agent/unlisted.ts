/**
 * "I want caps" at a store that lists no caps. The buyer names a kind of product; when no listed product is that kind,
 * the agent must say so plainly instead of answering with the current product's offers. Deterministic and
 * conservative: only a clear request for a named kind of product counts ("i want caps", "do you have mugs?",
 * "need 50 tote bags"), and a word that any listed product's name, unit, category, summary or capabilities carries
 * counts as listed. Used with or without a model; a model's own reading of the request can add items to check.
 */

import { consult, pickLine, type Consultation, type ConsultProduct } from "@proteus/domain";
import { unlistedLines } from "./adapter";

export interface ListedProduct {
  name: string;
  unitLabel: string;
  category?: string | null;
  summary?: string | null;
  capabilities?: string[];
  /** Shown next to a close match: "10 sweatshirts for $86.30". */
  smallestPack?: string;
}

export interface RequestedItem {
  /** As the buyer wrote it, without counts and filler words: "caps", "water bottles". */
  phrase: string;
  /** The word that names the kind of product: "caps", "bottles". */
  head: string;
}

export interface Unlisted {
  /** Kinds of product the buyer asked for that no listed product is. */
  items: RequestedItem[];
  /** The buyer also asked for something this product (or another listed one) is: offers still apply. */
  alsoListed: boolean;
  /** Listed products closest to what was asked, best first (at most three). */
  closest: ListedProduct[];
}

/** Words that end a product phrase: "caps for our team", "mugs by friday", "hoodies with our logo". */
const STOP = new Set(
  "for by with in at of to and or that which who please from under within before after next this these those it its is are was were be been will would can could should have has had do does did i we you they he she me us them if so then than because as but also too very just only really asap now today tomorrow soon there here what when where how not no each per like around about".split(" "),
);

/** Words before the product word that say nothing about which kind of product it is. */
const FILLER = new Set(
  "some a an the any few couple pair dozen more other my our your their custom customised customized branded printed personalised personalized plain blank unbranded embroidered premium cheap nice good cool new small large big quality cotton organic black white red blue green grey gray navy pink yellow orange purple brown".split(" "),
);

/** Words that name no kind of product: units, money, logistics, people, chat words. */
const NON_ITEMS = new Set(
  `it this that these those them one ones something anything everything stuff thing things help quote quotes offer offers deal deals discount discounts price prices pricing cost costs rate rates
  unit units piece pieces pc pcs item items order orders status delivery shipping sample samples info information detail details logo logos design designs artwork print printing bulk budget
  more less option options size sizes colour colours color colors variant variants know talk money refund refunds return returns invoice payment payments integration integrations api support
  request requests number numbers quantity quantities amount total date time deadline contact email phone address location store stores shop catalog catalogue list menu product products
  service services plan plans package packages tier tiers brand branding merch merchandise swag gift gifts goodies kit kits back chance way lot lots bit minute minutes hour hours day days
  week weeks month months year years people person persons employee employees staff member members guest guests attendee attendees participant participants student students kid kids team
  teams event events human someone agent seller you thanks thank ok okay yes sure fine great perfect awesome done hello hey hi idea ideas question questions answer reply update`.split(/\s+/),
);

/** The same kind of product under another name: a buyer asking for tees at a store that lists t-shirts asks for a listed product. */
const SAME: string[][] = [
  ["tshirt", "tee", "shirt"],
  ["hoodie", "hoody", "hooded"],
  ["cap", "snapback"],
  ["sticker", "decal"],
  ["notebook", "notepad", "journal", "diary"],
  ["tote", "bag"],
  ["sweatshirt", "crewneck"],
];

/** Kinds of product that sit close together, so a buyer asking for one can be shown the others. */
const KINDS: { kind: string; family: string; words: string[] }[] = [
  { kind: "headwear", family: "apparel", words: ["cap", "hat", "beanie", "snapback", "visor", "headband", "bucket"] },
  { kind: "tops", family: "apparel", words: ["tshirt", "tee", "shirt", "polo", "hoodie", "hoody", "sweatshirt", "sweater", "jacket", "jersey", "crewneck", "vest"] },
  { kind: "bottoms", family: "apparel", words: ["pant", "jogger", "shorts", "trouser"] },
  { kind: "socks", family: "apparel", words: ["sock"] },
  { kind: "drinkware", family: "drinkware", words: ["mug", "cup", "bottle", "tumbler", "flask", "sipper", "glass"] },
  { kind: "bags", family: "bags", words: ["bag", "tote", "backpack", "pouch", "sling", "duffel", "wallet"] },
  { kind: "stationery", family: "stationery", words: ["notebook", "diary", "journal", "pen", "pencil", "planner", "notepad", "sticker", "decal", "bookmark"] },
  { kind: "tech", family: "tech", words: ["charger", "powerbank", "earbud", "speaker", "cable", "mousepad"] },
];
/** Category names a whole family goes by on a store ("Apparel", "Drinkware"). */
const FAMILY_WORDS: Record<string, string[]> = { apparel: ["apparel", "clothing", "wear", "garment", "fashion"], drinkware: ["drinkware"], bags: ["bags", "bag"], stationery: ["stationery", "office"], tech: ["tech", "electronic", "electronics", "gadget", "gadgets"] };

/** "T-shirts" and "t shirt" are one word; "power bank" too. */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/\bt[\s-]?shirts?\b/g, (m) => (m.endsWith("s") ? "tshirts" : "tshirt"))
    .replace(/\bpower[\s-]?banks?\b/g, "powerbank")
    .replace(/\bmouse[\s-]?pads?\b/g, "mousepad")
    .replace(/\bsweat[\s-]shirts?\b/g, (m) => (m.endsWith("s") ? "sweatshirts" : "sweatshirt"));

/** Singular and plural spellings of one word: "caps" → cap, "boxes" → box, "hoodies" → hoodie and hoody. */
export function forms(word: string): string[] {
  const w = word.toLowerCase();
  const out = new Set([w]);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) out.add(w.slice(0, -1));
  if (w.length > 4 && /(xes|ches|shes|sses|oes)$/.test(w)) out.add(w.slice(0, -2));
  if (w.length > 4 && w.endsWith("ies")) {
    out.add(w.slice(0, -3) + "y");
    out.add(w.slice(0, -1));
  }
  if (w.endsWith("y") && w.length > 3) out.add(w.slice(0, -1) + "ie");
  return [...out];
}

const words = (s: string) => normalize(s).split(/[^a-z]+/).filter((w) => w.length > 1);

/**
 * Every spelling of every word a product goes by, with the other names of the same kind of product. `brief` keeps to
 * the name, unit and category: a summary's words ("flip-top", "top flaps") say nothing about what kind of product it is.
 */
function vocabulary(p: ListedProduct, brief = false): Set<string> {
  const text = [p.name, p.unitLabel, p.category ?? "", ...(brief ? [] : [p.summary ?? "", ...(p.capabilities ?? [])])].join(" ");
  const out = new Set<string>();
  for (const w of words(text)) for (const f of forms(w)) out.add(f);
  for (const group of SAME) if (group.some((g) => out.has(g))) for (const g of group) out.add(g);
  return out;
}

const isListedIn = (item: RequestedItem, vocab: Set<string>) => forms(item.head).some((f) => vocab.has(f));

/** Where a request for a kind of product starts: "i want", "do you have", "looking for", "price for", "order 50". */
const ASK = /\b(?:want|wants|need|needs|looking for|searching for|interested in|(?:i|we)'?d like|would like|(?:what|how) about|do you (?:have|sell|make|do|offer|carry|stock|print)|can you (?:make|do|print|supply)|(?:price|prices|pricing|quote|cost) (?:for|of|on)|(?:order|buy|purchase|get)(?= (?:some|a|an|[\d,]+)\b)|any)\s+/g;
const COUNT = /^(?:[\d,]+\+?|a|an|some|few|couple|dozen)$/;
const LEAD = /^(?:to (?:buy|order|get|purchase)|about|around|roughly|approx(?:imately)?|maybe|at least|over)$/;

/**
 * The phrase at the start of `rest` that names a kind of product, and what follows it. A word counts only when it
 * reads as a product: a kind the agent knows, a plural ("caps"), or one counted ("a cap", "50 mugs"); never a word
 * that names no product ("discount", "delivery") or one ending in -ing ("scheduling").
 */
function itemAt(rest: string): { item?: RequestedItem; after: string } {
  const toks = rest.replace(/\bto (?:buy|order|get|purchase)\b/g, " ").split(/[^a-z0-9,+'-]+/).filter(Boolean);
  const phrase: string[] = [];
  let counted = false;
  let i = 0;
  for (; i < toks.length; i++) {
    const t = toks[i]!;
    if (!phrase.length && (COUNT.test(t) || LEAD.test(t) || FILLER.has(t))) {
      if (COUNT.test(t)) counted = true;
      continue;
    }
    if (STOP.has(t) || /^\d/.test(t)) break;
    phrase.push(t);
    if (phrase.length === 3) {
      i++;
      break;
    }
  }
  const after = toks.slice(i).join(" ");
  const head = phrase.at(-1);
  if (!head || head.length < 3 || head.endsWith("ing") || forms(head).some((f) => NON_ITEMS.has(f))) return { after };
  const plural = /s$/.test(head) && !/(ss|us|is)$/.test(head);
  if (!kindOf(head) && !plural && !counted) return { after };
  return { item: { phrase: phrase.join(" "), head }, after };
}

/**
 * The kinds of product a buyer message asks for, in order: "hey i want caps" → caps; "do you have 50 tote bags?" →
 * tote bags; "caps and mugs" → both. Counts, filler words and anything after the product word are left out. A short
 * message that is only a kind of product counts too ("caps?", "50 hoodies please").
 */
export function requestedItems(message: string): RequestedItem[] {
  const text = normalize(message).replace(/[’]/g, "'");
  const found: RequestedItem[] = [];
  const add = (it?: RequestedItem) => {
    if (it && !found.some((x) => x.head === it.head)) found.push(it);
  };
  for (const sentence of text.split(/[.!?\n;]+|,\s*(?=\D)/)) {
    ASK.lastIndex = 0;
    for (let m = ASK.exec(sentence); m; m = ASK.exec(sentence)) {
      let { item, after } = itemAt(sentence.slice(m.index + m[0].length));
      add(item);
      // "caps and mugs": a second kind straight after the first.
      while (item && /^(?:and|or)\b/.test(after)) {
        ({ item, after } = itemAt(after.replace(/^(?:and|or)\s*/, "")));
        add(item);
      }
    }
  }
  if (!found.length) {
    const bare = text.replace(/\b(?:hi|hey|hello|yo|pls|please|ok|so|then)\b/g, " ").replace(/[^a-z0-9,\s]/g, " ").trim().split(/\s+/).filter(Boolean);
    if (bare.length >= 1 && bare.length <= 3) add(itemAt(bare.join(" ")).item);
  }
  return found;
}

/** A kind's word list for a head word, if it is one of the kinds the agent knows sit close together. */
const kindOf = (head: string) => KINDS.find((k) => forms(head).some((f) => k.words.includes(f)));

/**
 * The listed products closest to an unlisted kind: the same kind first (hats for caps), then the same family (other
 * apparel), judged by the product's words and category. Empty when nothing listed is close.
 */
export function closestListed(item: RequestedItem, listed: ListedProduct[], max = 3): ListedProduct[] {
  const kind = kindOf(item.head);
  if (!kind) return [];
  const scored = listed
    .map((p) => {
      const v = vocabulary(p, true);
      const same = kind.words.some((w) => v.has(w)) ? 2 : 0;
      const family = KINDS.some((k) => k.family === kind.family && k.words.some((w) => v.has(w))) || FAMILY_WORDS[kind.family]!.some((w) => v.has(w)) ? 1 : 0;
      return { p, score: Math.max(same, family) };
    })
    .filter((x) => x.score > 0);
  const best = Math.max(0, ...scored.map((x) => x.score));
  return scored.filter((x) => x.score === best).slice(0, max).map((x) => x.p);
}

/**
 * What the buyer asked for that the store does not list, with the closest listed products, or undefined when every
 * kind asked for is listed (or the message names no kind). `current` is the product this conversation is on;
 * `others` are the seller's other listed products. `extra` are kinds a model read from the same message.
 */
export function findUnlisted(message: string, current: ListedProduct, others: ListedProduct[], extra: string[] = []): Unlisted | undefined {
  const asked = [...requestedItems(message)];
  for (const e of extra) for (const it of requestedItems(`i want ${e}`)) if (!asked.some((x) => forms(x.head).some((f) => forms(it.head).includes(f)))) asked.push(it);
  if (!asked.length) return undefined;
  const all = [current, ...others];
  const vocabs = all.map((p) => vocabulary(p));
  const missing = asked.filter((it) => !vocabs.some((v) => isListedIn(it, v)));
  if (!missing.length) return undefined;
  return { items: missing, alsoListed: missing.length < asked.length, closest: closestListed(missing[0]!, all) };
}

/** "Caps", "Caps and mugs". */
export function itemsText(items: RequestedItem[]): string {
  const t = items.map((i) => i.phrase);
  const s = t.length > 1 ? `${t.slice(0, -1).join(", ")} and ${t.at(-1)}` : t[0] ?? "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Whether a buyer message answers the agent's offer to send a custom request: a yes, a quantity or date, or contact
 * details. A no, the same ask repeated, or a message that now asks for something listed, is not.
 */
export function answersCustomRequest(message: string, _items: string, listed: ListedProduct[]): boolean {
  const m = message.trim();
  if (/^(no|nope|nah|not now|no thanks|never ?mind|cancel)\b/i.test(m)) return false;
  const asked = requestedItems(m);
  if (asked.length && !findUnlisted(m, listed[0]!, listed.slice(1))) return false;
  // The item asked for again with nothing more ("i want caps") is the same question, not the request: it gets the same answer.
  return /^(yes|yeah|yep|sure|ok(ay)?|please|go ahead|do it|send)\b/i.test(m) || /\b(custom request|send (it|the request|a request))\b/i.test(m) || /\d|@/.test(m);
}

/** Whether a product is the kind of product an item names: its name ends with that word, or its unit is that word ("Baseball Cap", unit cap; not "Loop Cap Bottle"). */
function isKind(p: ListedProduct, item: RequestedItem): boolean {
  const head = words(p.name).at(-1);
  const f = forms(item.head);
  return (head !== undefined && forms(head).some((x) => f.includes(x))) || forms(normalize(p.unitLabel)).some((x) => f.includes(x));
}

/**
 * The seller's other listed products of the kind the buyer asked for ("i want caps" on a store with fourteen caps), so
 * the agent offers a choice among them instead of quoting one as if it were the only one. Listing order is kept.
 */
export function sameKindListed(message: string, others: ListedProduct[], extra: string[] = []): ListedProduct[] {
  const asked = [...requestedItems(message), ...extra.flatMap((e) => requestedItems(`i want ${e}`))];
  if (!asked.length) return [];
  return others.filter((p) => asked.some((it) => isKind(p, it)));
}

/**
 * The store-wide reply ("all products", no product chosen yet) to a buyer asking only for something the seller does
 * not list: says so plainly, recommends the closest listed products (or a few the seller does list when nothing is
 * close) and offers a custom request. Deterministic, with or without a model. `text` is the message as stored.
 */
export function unlistedConsultation(sellerName: string, products: readonly ConsultProduct[], missing: Unlisted, buyerTexts: readonly string[], exclude: readonly string[] = []): { result: Consultation; text: string; items: string } {
  const items = itemsText(missing.items);
  const closest = missing.closest.map((c) => products.find((p) => p.name === c.name)).filter((p): p is ConsultProduct => Boolean(p));
  const [notListed, offer] = unlistedLines({ items, alsoListed: false, closest: [], listed: [], sellerName });
  const base = consult(sellerName, products, buyerTexts, { pointed: closest.map((p) => p.slug), exclude });
  const picks = closest.length ? base.picks.filter((p) => closest.some((c) => c.slug === p.slug)) : base.picks;
  const intro = `${notListed} ${closest.length ? (picks.length > 1 ? "The closest listed products are:" : "The closest listed product is:") : `Here is what ${sellerName} does list:`}`;
  const result: Consultation = { ...base, intro, picks, questions: [offer!] };
  return { result, items, text: [intro, picks.map((p) => `• ${pickLine(p)}`).join("\n"), offer].join("\n\n") };
}
