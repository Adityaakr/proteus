/*
 * Proteus AI deal agent for your website. Paste one line before </body>:
 *   <script src="https://app.proteus.co.in/embed.js" data-seller="your-slug" async></script>
 * Options (data-*): product (a product slug), label (button text, default "Get a quote"),
 *   color (#rrggbb), mode ("button" floating button, default, or "inline" to render the agent in place),
 *   height (inline mode, px, default 620).
 * The agent runs in an iframe from Proteus AI. Offers come from the seller's rules; signing and funding always open
 * Proteus AI in a new tab, never inside your page.
 */
(function () {
  var s = document.currentScript;
  if (!s || !s.dataset.seller) return;
  var origin = new URL(s.src).origin;
  var seller = encodeURIComponent(s.dataset.seller);
  var inlineMode = s.dataset.mode === "inline";
  var query = [];
  if (s.dataset.product) query.push("product=" + encodeURIComponent(s.dataset.product));
  // Inline cards have nothing to close, so the agent hides its close button.
  if (inlineMode) query.push("inline=1");
  var src = origin + "/embed/" + seller + (query.length ? "?" + query.join("&") : "");
  var color = /^#[0-9a-f]{6}$/i.test(s.dataset.color || "") ? s.dataset.color : "#1b4dff";

  function frame(style) {
    var f = document.createElement("iframe");
    f.src = src;
    f.title = "Deal agent";
    f.setAttribute("allow", "clipboard-write");
    f.style.cssText = "border:0;background:#fff;color-scheme:light;" + style;
    return f;
  }

  if (inlineMode) {
    // A contained chat card, centred in its container: never wider than a chat widget.
    var h = parseInt(s.dataset.height || "620", 10) || 620;
    var inline = frame("display:block;width:100%;max-width:420px;margin:0 auto;height:" + h + "px;border-radius:18px;box-shadow:0 0 0 1px rgba(0,0,0,.08),0 16px 40px -16px rgba(16,24,40,.22);");
    s.parentNode.insertBefore(inline, s);
    return;
  }

  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = s.dataset.label || "Get a quote";
  btn.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483646;padding:12px 18px;border:0;border-radius:999px;font:600 14px/1 system-ui,-apple-system,sans-serif;color:#fff;background:" + color + ";box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer";
  var panel = null;
  function close() {
    if (panel) { panel.remove(); panel = null; btn.style.display = ""; }
  }
  btn.onclick = function () {
    if (panel) return close();
    // Phones get the whole screen; anything wider gets a narrow panel above the button, the size of the chat card.
    var mobile = window.innerWidth < 520;
    panel = frame(mobile
      ? "position:fixed;inset:0;width:100%;height:100%;z-index:2147483647;"
      : "position:fixed;right:20px;bottom:20px;width:min(400px,calc(100vw - 40px));height:min(660px,calc(100vh - 40px));z-index:2147483647;border-radius:20px;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 24px 56px -12px rgba(16,24,40,.32);");
    document.body.appendChild(panel);
    btn.style.display = "none";
  };
  window.addEventListener("message", function (e) {
    if (e.origin === origin && e.data && e.data.type === "proteus:close") close();
  });
  document.body.appendChild(btn);
})();
