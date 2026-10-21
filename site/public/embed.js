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
  var src = origin + "/embed/" + seller + (s.dataset.product ? "?product=" + encodeURIComponent(s.dataset.product) : "");
  var color = /^#[0-9a-f]{6}$/i.test(s.dataset.color || "") ? s.dataset.color : "#1b4dff";

  function frame(style) {
    var f = document.createElement("iframe");
    f.src = src;
    f.title = "Deal agent";
    f.setAttribute("allow", "clipboard-write");
    f.style.cssText = "border:0;background:#fff;color-scheme:light;" + style;
    return f;
  }

  if (s.dataset.mode === "inline") {
    var h = parseInt(s.dataset.height || "620", 10) || 620;
    var inline = frame("width:100%;max-width:440px;height:" + h + "px;border-radius:16px;box-shadow:0 0 0 1px rgba(0,0,0,.08),0 12px 32px rgba(0,0,0,.08);");
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
    var mobile = window.innerWidth < 520;
    panel = frame(mobile
      ? "position:fixed;inset:0;width:100%;height:100%;z-index:2147483647;"
      : "position:fixed;right:20px;bottom:20px;width:400px;height:min(640px,calc(100vh - 40px));z-index:2147483647;border-radius:18px;box-shadow:0 16px 48px rgba(0,0,0,.22);");
    document.body.appendChild(panel);
    btn.style.display = "none";
  };
  window.addEventListener("message", function (e) {
    if (e.origin === origin && e.data && e.data.type === "proteus:close") close();
  });
  document.body.appendChild(btn);
})();
