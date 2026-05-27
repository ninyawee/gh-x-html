// gh-x-html render frame.
//
// Loaded as `chrome-extension://<id>/render.html` inside a sandboxed iframe in
// a GitHub comment. We can't put the author's HTML directly into the iframe's
// src or srcdoc because GitHub's CSP gets inherited by blob:/data:/srcdoc, and
// inline scripts get blocked. By navigating to a real chrome-extension://
// URL, the iframe gets its own document origin and the inherited CSP no
// longer applies. The author's HTML then arrives via postMessage from the
// parent content script.

(function () {
  function postHeight() {
    const h = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0,
    );
    parent.postMessage({ type: "gh-x-html:resize", height: h }, "*");
  }

  function applyHtml(html) {
    // document.open + write is intentional. The whole purpose of this
    // extension is to let trusted authors' HTML (including <script> tags) run
    // in a sandboxed iframe. innerHTML / DOMParser-then-append would skip
    // script execution, defeating the design. Defense in depth lives at two
    // layers above this call: (1) the content script will only forward fence
    // contents from comments authored by users in the trusted-authors
    // allowlist, and (2) this render frame is sandboxed without
    // allow-same-origin, so anything that does run here is in an opaque
    // origin with no GitHub cookies, no parent-DOM access, and no top-frame
    // navigation. See docs/adr/0002 and 0003.
    document.open();
    document.write(html);
    document.close();

    // After the author's HTML loads, fire one resize and watch for changes.
    const send = () => postHeight();
    if (document.readyState === "complete") send();
    else window.addEventListener("load", send, { once: true });
    if (window.ResizeObserver && document.body) {
      new ResizeObserver(send).observe(document.body);
    } else {
      setTimeout(send, 200);
    }
  }

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.type !== "gh-x-html:render" || typeof d.html !== "string") return;
    applyHtml(d.html);
  });

  // Tell the parent we're ready to receive content.
  parent.postMessage({ type: "gh-x-html:ready" }, "*");
})();
