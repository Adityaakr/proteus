/**
 * Runs inside a rendered page (as a string, so no build tool can rewrite it) and reports what a person would see:
 * the visible text, the links and where they sit, product cards (a repeated block with a name and a price), a single
 * product's own page (heading, price, option pickers), "next page" links, and, on a site with no prices at all, the
 * repeated list of product types it offers. It reads the page only: it clicks nothing and sends nothing.
 *
 * Everything returned is untrusted text from someone else's website; the server caps, screens and checks it again.
 */

export interface DomLink {
  url: string;
  text: string;
  area: "nav" | "footer" | "main";
}

export interface DomCard {
  name: string;
  /** The visible price text exactly as shown, e.g. "₹1,299.00" or "From $12". */
  priceText?: string;
  /** Every non-struck price text in the card (a range shows two). */
  prices: string[];
  /** A struck-through "was" price, if any. */
  wasText?: string;
  url?: string;
  imageUrl?: string;
  soldOut: boolean;
  /** Other short lines in the card (minimum order, colours, "made to order"). */
  extra: string[];
}

export interface DomDetail {
  name: string;
  priceText?: string;
  prices: string[];
  description?: string;
  imageUrl?: string;
  soldOut: boolean;
  options: { name: string; values: string[] }[];
}

export interface DomReport {
  url: string;
  title: string;
  /** The page's main heading (a listing page's category, or a product's name). */
  heading: string;
  text: string;
  html: string;
  links: DomLink[];
  cards: DomCard[];
  detail?: DomDetail;
  offerings: string[];
  nextPage?: string;
  /** Buttons that look like they open a shop or a catalogue but are not links. */
  shopButtons: string[];
}

export const DOM_SCRIPT = String.raw`(function (opts) {
  var maxText = opts.maxText || 30000;
  var maxHtml = opts.maxHtml || 1500000;
  var CUR = "(?:₹|€|£|¥|US\\$|AU\\$|A\\$|CA\\$|C\\$|S\\$|R\\$|\\$|(?<![A-Za-z])(?:Rs\\.?|INR|USD|SGD|EUR|GBP|JPY|AED|CHF)(?![A-Za-z]))";
  var NUM = "(?:\\d{1,2}(?:,\\d{2})+,\\d{3}(?:\\.\\d{1,2})?|\\d{1,3}(?:[,.\\s]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  var PRICE = new RegExp("(?:" + CUR + "\\s?" + NUM + "|" + NUM + "\\s?" + CUR + ")", "i");
  var PRICE_G = new RegExp(PRICE.source, "gi");
  var ACTION = /^(add to (cart|bag|basket)|buy( it)? now|quick ?(view|shop|add)|view( details| product)?|shop now|select options|choose options|sold out|out of stock|sale|new|learn more|read more|more info|details|order now|enquire|enquiry|request a quote|get a quote|wishlist|compare)$/i;
  var PRODUCT_WORDS = /\b(t-?shirts?|tees?|shirts?|polos?|hoodies?|sweatshirts?|jackets?|jerseys?|caps?|hats?|beanies?|socks?|shorts|joggers?|trousers?|pants|dress(es)?|kurtas?|sarees?|scarf|scarves|gloves?|uniforms?|aprons?|sliders?|slippers?|sandals?|shoes?|sneakers?|footwear|bags?|totes?|backpacks?|pouch(es)?|wallets?|keychains?|key ?chains?|lanyards?|badges?|pins?|patches?|stickers?|magnets?|wristbands?|umbrellas?|sunglasses|watches?|jewel(le)?ry|rings?|necklaces?|earrings?|bracelets?|mugs?|cups?|bottles?|tumblers?|flasks?|glass(es|ware)?|stanleys?|sippers?|notebooks?|diar(y|ies)|journals?|pens?|pencils?|planners?|calendars?|cards?|posters?|prints?|books?|bookmarks?|plush(ie|y)?s?|toys?|gifts?|hampers?|kits?|boxes|candles?|phone cases?|cases|covers?|chargers?|cables?|power ?banks?|mouse ?pads?|accessories|speakers?|headphones?|earbuds?|cushions?|pillows?|blankets?|towels?|coasters?|frames?|decor|plants?|vases?|coffee|tea|chocolates?|cookies?|cakes?|snacks?|spices?|honey|jams?|sauces?|pickles?|soaps?|creams?|oils?|serums?|perfumes?|lotions?|balms?|shampoos?|supplies|banners?|standees?|flags?|merch|swag|apparel|clothing|stationery|drinkware)\b/i;
  var LABEL = /^((regular|sale|original|compare( at)?|was|now|our|your|unit|list|special|member|retail|offer)\s*)?price:?$|^(mrp|price|from|starting at|incl\.? (of all )?taxes|tax included)$/i;
  var BADGE = /^(best ?seller|bestseller|new( arrival)?|sale|on sale|hot|limited( edition)?|trending|featured|exclusive|popular|top rated|\d+% off|save \d+%?|-\d+%)$/i;
  function nameLine(l) { return l.length >= 2 && l.length <= 140 && /[a-z]{2}/i.test(l) && !PRICE.test(l) && !ACTION.test(l) && !LABEL.test(l) && !BADGE.test(l); }
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, SVG: 1, TEMPLATE: 1, IFRAME: 1, OBJECT: 1, CANVAS: 1, VIDEO: 1, AUDIO: 1, SELECT: 1, OPTION: 1 };

  function squash(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  }
  function areaOf(el) {
    if (el.closest("footer,[role=contentinfo]")) return "footer";
    if (el.closest("nav,header,[role=navigation],[role=menubar],[class*=menu i],[class*=navbar i],[id*=menu i]")) return "nav";
    return "main";
  }
  function inChrome(el) {
    return Boolean(el.closest("header,nav,footer,[role=navigation],[role=contentinfo],[role=dialog],[aria-modal=true],[class*=cart-drawer i],[class*=minicart i],[id*=cart i]"));
  }
  function abs(u) {
    try { var x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (e) { return ""; }
  }
  function imgOf(root) {
    var imgs = root.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      var c = im.currentSrc || im.getAttribute("src") || im.getAttribute("data-src") || im.getAttribute("data-lazy-src") || im.getAttribute("data-original") || "";
      if (!c || /^data:/i.test(c)) {
        var ss = im.getAttribute("srcset") || im.getAttribute("data-srcset") || "";
        c = ss.split(",")[0] ? ss.split(",")[0].trim().split(" ")[0] : "";
      }
      var u = abs(c);
      if (u && /^https:/.test(u) && !/logo|icon|sprite|placeholder|blank|pixel/i.test(u)) return u;
    }
    return "";
  }
  function struck(el, stop) {
    for (var x = el, i = 0; x && x !== stop && i < 4; x = x.parentElement, i++) {
      if (/^(S|DEL|STRIKE)$/.test(x.tagName)) return true;
      if ((getComputedStyle(x).textDecorationLine || "").indexOf("line-through") >= 0) return true;
      if (/compare|was-price|price--was|old-price|regular-price|price-old|original-price|strike/i.test(String(x.className || ""))) return true;
    }
    return false;
  }

  /* Price elements: the smallest visible element whose own text is mostly one price. */
  var all = document.body ? document.body.querySelectorAll("*") : [];
  var priceEls = [];
  for (var i = 0; i < all.length && priceEls.length < 2000; i++) {
    var el = all[i];
    if (SKIP_TAGS[el.tagName]) continue;
    var t = squash(el.innerText);
    if (!t || t.length > 48 || !PRICE.test(t)) continue;
    var m = t.match(PRICE_G) || [];
    if (!m.length || m.join("").length < t.replace(/^(from|sale price|regular price|price|now|only|starting at|starts at|mrp|rs)\s*:?/i, "").length * 0.45) continue;
    var hasChild = false;
    for (var c = 0; c < el.children.length; c++) {
      var ct = squash(el.children[c].innerText);
      if (ct && PRICE.test(ct) && ct.length <= 48) { hasChild = true; break; }
    }
    if (hasChild || !visible(el)) continue;
    if (/^(0|0\.00)$/.test((m[0].match(/[\d.,]+/) || [""])[0])) continue;
    priceEls.push(el);
  }

  /* Cards: the lowest ancestor of a price whose parent holds two or more such blocks, each with a name. */
  /* "A Light in the ..." on screen: the full name is often in a title attribute or the image's alt text. */
  function unclip(card, name) {
    if (!/(\.\.\.|…)$/.test(name)) return name;
    var stem = name.replace(/\s*(\.\.\.|…)$/, "").toLowerCase();
    var full = [].slice.call(card.querySelectorAll("[title], img[alt]")).map(function (e) { return squash(e.getAttribute("title") || e.getAttribute("alt")); }).find(function (t) { return t && t.length > stem.length && t.length <= 200 && t.toLowerCase().indexOf(stem) === 0; });
    return full || name;
  }
  function nameOf(card) { var n = nameOf0(card); return n ? unclip(card, n) : n; }
  function nameOf0(card) {
    var hs = card.querySelectorAll("h1,h2,h3,h4,h5,h6,[itemprop=name],[class*=title i],[class*=name i],[data-hook*=name i],[data-testid*=name i],[data-testid*=title i]");
    for (var i = 0; i < hs.length; i++) {
      var t = squash(hs[i].innerText);
      if (t && nameLine(t)) return t;
    }
    // The longest line of a link's text that is not a price, a label ("Sale price") or a badge ("Best seller").
    var best = "";
    var as = card.querySelectorAll("a");
    for (var j = 0; j < as.length; j++) {
      String(as[j].innerText || "").split("\n").map(squash).forEach(function (l) { if (nameLine(l) && l.length > best.length) best = l; });
    }
    if (best) return best;
    var im = card.querySelector("img[alt]");
    var alt = im ? squash(im.getAttribute("alt")) : "";
    if (alt && alt.length >= 3 && !/^(logo|image|photo|product|thumbnail)$/i.test(alt)) return alt.slice(0, 140);
    var lines = String(card.innerText || "").split("\n").map(squash).filter(function (l) { return l.length >= 3 && l.length <= 100 && nameLine(l); });
    return lines[0] || "";
  }
  /* A card shows something to click or look at: a link, an image or a heading (not just "Regular price $11.50"). */
  function cardLike(el) {
    return el.tagName === "A" || Boolean(el.querySelector("a[href], img, picture, h1, h2, h3, h4, h5, h6, [role=img]")) || Boolean(el.closest("a[href]"));
  }
  var parents = new Map();
  priceEls.forEach(function (p) {
    for (var a = p, d = 0; a && a.parentElement && a !== document.body && d < 20; a = a.parentElement, d++) {
      var set = parents.get(a.parentElement);
      if (!set) { set = new Set(); parents.set(a.parentElement, set); }
      set.add(a);
    }
  });
  var cardEls = [];
  var seenCards = new Set();
  priceEls.forEach(function (p) {
    for (var a = p, d = 0; a && a.parentElement && a !== document.body && d < 20; a = a.parentElement, d++) {
      var sibs = parents.get(a.parentElement);
      if (!sibs || sibs.size < 2) continue;
      var inside = 0;
      for (var k = 0; k < priceEls.length && inside < 5; k++) if (a.contains(priceEls[k])) inside++;
      if (inside > 4) break;
      var nm = nameOf(a);
      if (!nm || !cardLike(a)) continue;
      if (!seenCards.has(a)) { seenCards.add(a); cardEls.push(a); }
      break;
    }
  });
  var cards = [];
  var cardKeys = new Set();
  cardEls.forEach(function (card) {
    if (inChrome(card)) return;
    var nm = nameOf(card);
    var prices = [], was = "";
    priceEls.forEach(function (p) {
      if (!card.contains(p)) return;
      var pt = squash(p.innerText);
      if (struck(p, card.parentElement)) { if (!was) was = pt; } else prices.push(pt);
    });
    if (!prices.length && was) { prices.push(was); was = ""; }
    var link = card.tagName === "A" ? card : card.querySelector("a[href]") || card.closest("a[href]");
    var url = link ? abs(link.getAttribute("href")) : "";
    var key = (nm + "|" + url).toLowerCase();
    if (cardKeys.has(key)) return;
    cardKeys.add(key);
    var text = String(card.innerText || "");
    var extra = text.split("\n").map(squash).filter(function (l) { return l && l !== nm && l.length <= 120 && !PRICE.test(l) && !ACTION.test(l) && !LABEL.test(l) && !BADGE.test(l); }).slice(0, 4);
    cards.push({ name: nm, priceText: prices[0], prices: prices.slice(0, 4), wasText: was || undefined, url: url || undefined, imageUrl: imgOf(card) || undefined, soldOut: /sold out|out of stock|unavailable/i.test(text), extra: extra });
  });

  /* One product's own page: a main heading with a price that is not inside a card. */
  var detail;
  var h1 = document.querySelector("main h1, [itemtype*=Product] h1, h1");
  var productPage = cardEls.length < 2 || /\/(products?|p|item|items|shop)\//i.test(location.pathname + location.hash) || Boolean(document.querySelector("meta[property='og:type'][content*=product i]"));
  if (h1 && visible(h1) && productPage) try {
    var lone = priceEls.filter(function (p) { return !cardEls.some(function (c) { return c.contains(p); }) && !inChrome(p); });
    var after = lone.filter(function (p) { return h1.compareDocumentPosition(p) & 4; });
    var pick = after.length ? after : lone;
    if (pick.length) {
      var dp = [], dwas = "";
      pick.slice(0, 4).forEach(function (p) { var pt = squash(p.innerText); if (struck(p, document.body)) { if (!dwas) dwas = pt; } else dp.push(pt); });
      if (!dp.length && dwas) dp.push(dwas);
      var form = document.querySelector("form[action*=cart], form[action*=bag], [class*=product-form i], [class*=productform i], [class*=variant i], [class*=option i]") || document.querySelector("main") || document.body;
      var options = [];
      form.querySelectorAll("select").forEach(function (s) {
        var lab = null;
        try { lab = s.id ? document.querySelector("label[for=" + CSS.escape(s.id) + "]") : null; } catch (e) { lab = null; }
        var name = squash((lab && lab.innerText) || s.getAttribute("aria-label") || s.getAttribute("name") || "Option").replace(/[:*]/g, "").slice(0, 30);
        var vals = [].slice.call(s.options).map(function (o) { return squash(o.textContent).replace(PRICE_G, "").replace(/[-–(]\s*$/, "").trim(); }).filter(function (v) { return v && v.length <= 40 && !/^(choose|select|pick|--)/i.test(v); });
        if (vals.length) options.push({ name: name, values: vals.slice(0, 30) });
      });
      form.querySelectorAll("fieldset, [role=radiogroup], [class*=swatch i], [class*=option i]").forEach(function (g) {
        if (options.length >= 4) return;
        var legend = g.querySelector("legend, [class*=label i], [class*=title i]");
        var name = squash(legend ? legend.innerText : g.getAttribute("aria-label") || "").replace(/[:*].*$/, "").slice(0, 30);
        if (!name || !/size|colou?r|material|style|fit|pack|quantity|weight|flavou?r|finish|variant/i.test(name)) return;
        var vals = [].slice.call(g.querySelectorAll("label, button, [role=radio], input[type=radio]")).map(function (x) { return squash(x.getAttribute("aria-label") || x.getAttribute("title") || x.getAttribute("value") || x.innerText); }).filter(function (v) { return v && v.length <= 40 && v.toLowerCase() !== name.toLowerCase(); });
        vals = vals.filter(function (v, i2) { return vals.indexOf(v) === i2; });
        if (vals.length >= 2 && !options.some(function (o) { return o.name.toLowerCase() === name.toLowerCase(); })) options.push({ name: name, values: vals.slice(0, 30) });
      });
      var md = document.querySelector("meta[name=description]");
      detail = { name: squash(h1.innerText).slice(0, 140), priceText: dp[0], prices: dp.slice(0, 4), description: md ? squash(md.getAttribute("content")).slice(0, 600) : undefined, imageUrl: imgOf(h1.closest("main") || document.body) || undefined, soldOut: /sold out|out of stock/i.test(squash((h1.closest("main") || document.body).innerText).slice(0, 4000)), options: options };
    }
  } catch (e) { detail = undefined; }

  /* A site with no prices: a repeated list of short product-type names (four or more, mostly product words). */
  var offerings = [];
  if (!cards.length && !detail) {
    var groups = new Map();
    for (var g = 0; g < all.length; g++) {
      var e = all[g];
      if (SKIP_TAGS[e.tagName] || e.children.length > 3) continue;
      var et = squash(e.innerText);
      if (!et || et.length < 3 || et.length > 40 || et.split(" ").length > 5 || /[.!?:]$/.test(et) || /\d{3,}/.test(et)) continue;
      if (!e.parentElement || inChrome(e)) continue;
      var list = groups.get(e.parentElement);
      if (!list) { list = []; groups.set(e.parentElement, list); }
      list.push(et);
    }
    groups.forEach(function (list) {
      var uniq = [];
      list.forEach(function (x) { if (!uniq.some(function (u) { return u.toLowerCase() === x.toLowerCase(); })) uniq.push(x); });
      if (uniq.length < 4) return;
      var hits = uniq.filter(function (x) { return PRODUCT_WORDS.test(x); }).length;
      if (hits / uniq.length < 0.6) return;
      uniq.forEach(function (x) { if (offerings.length < 60 && !offerings.some(function (o) { return o.toLowerCase() === x.toLowerCase(); })) offerings.push(x); });
    });
  }

  /* Links, the next page, and shop buttons that are not links. */
  var links = [];
  var seenLinks = new Set();
  document.querySelectorAll("a[href]").forEach(function (a) {
    var u = abs(a.getAttribute("href"));
    if (!u || seenLinks.has(u) || links.length >= 400) return;
    seenLinks.add(u);
    links.push({ url: u, text: squash(a.innerText || a.getAttribute("aria-label") || a.getAttribute("title") || "").slice(0, 80), area: areaOf(a) });
  });
  var next = document.querySelector("link[rel=next], a[rel~=next], a[aria-label*='next' i], a[class*=next i][href], .pagination a[href*='page'], [class*=pagination i] a[href*='page']");
  var nextPage = "";
  if (next) nextPage = abs(next.getAttribute("href"));
  if (!nextPage) {
    var cand = [].slice.call(document.querySelectorAll("a[href]")).find(function (a) { return /^(next|next page|›|»|→|>)$/i.test(squash(a.innerText || a.getAttribute("aria-label") || "")); });
    if (cand) nextPage = abs(cand.getAttribute("href"));
  }
  var shopButtons = [];
  document.querySelectorAll("button, [role=button]").forEach(function (b) {
    var bt = squash(b.innerText || b.getAttribute("aria-label") || "");
    if (bt && bt.length <= 40 && /shop|store|catalog|catalogue|collection|products|merch|browse|menu/i.test(bt) && !/buy|order now|add to (cart|bag|basket)|checkout/i.test(bt) && visible(b) && shopButtons.indexOf(bt) < 0 && shopButtons.length < 4) shopButtons.push(bt);
  });

  var html = document.documentElement.outerHTML;
  return {
    url: location.href,
    title: squash(document.title).slice(0, 200),
    heading: h1 ? squash(h1.innerText).slice(0, 80) : "",
    text: String(document.body ? document.body.innerText : "").slice(0, maxText),
    html: html.length > maxHtml ? html.slice(0, maxHtml) : html,
    links: links,
    cards: cards.slice(0, 200),
    detail: detail,
    offerings: offerings,
    nextPage: nextPage || undefined,
    shopButtons: shopButtons
  };
})`;
