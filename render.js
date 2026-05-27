// gh-x-html render frame.
//
// Loaded as `chrome-extension://<id>/render.html` inside a sandboxed iframe in
// a GitHub comment. Used by two rewrite paths:
//
//   1. Fence — author HTML arrives via postMessage as { html } and is
//      written into the document with document.write so <script> tags run.
//
//   2. Media — a video/audio URL arrives as { media: {tag, src, text} } and
//      is rendered as <video controls> or <audio controls>. The reason we
//      go through this iframe (rather than rewriting in place) is GitHub's
//      page CSP: media-src only allows github.com/githubusercontent.com, so
//      a <video src=https://r2.dev/clip.mp4> on the GitHub page is refused
//      by the browser. Inside the chrome-extension iframe, that CSP is no
//      longer inherited; the extension page's own CSP has no media-src
//      restriction, so the fetch goes through.

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

  function applyMedia({ tag, src, text }) {
    if (tag !== "video" && tag !== "audio") return;
    const media = document.createElement(tag);
    media.setAttribute("controls", "");
    media.setAttribute("src", src);
    if (tag === "video") media.setAttribute("preload", "metadata");
    // width:100% / height:auto so the video fills the iframe horizontally and
    // its natural aspect drives the iframe's height (computed by the parent
    // from the natural dims we post in `gh-x-html:resize`).
    media.style.cssText =
      tag === "video"
        ? "width: 100%; height: auto; display: block; margin: 0;"
        : "display: block; margin: 0; width: 100%;";

    // "Open in new tab" fallback so the URL is still recoverable if playback
    // fails or the user wants to download. allow-popups-to-escape-sandbox on
    // the iframe lets target=_blank break out into a normal tab.
    const fallback = document.createElement("a");
    fallback.href = src;
    fallback.textContent = text || src;
    fallback.target = "_blank";
    fallback.rel = "noopener";
    fallback.style.cssText =
      "font-size: .85em; color: #57606a; display: inline-block; margin-top: .25rem;";

    document.body.appendChild(media);
    document.body.appendChild(fallback);

    const sendMedia = () => {
      const h = Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
      );
      const naturalW = tag === "video" ? media.videoWidth || 0 : 0;
      const naturalH = tag === "video" ? media.videoHeight || 0 : 0;
      parent.postMessage(
        { type: "gh-x-html:resize", height: h, naturalW, naturalH },
        "*",
      );
    };
    sendMedia();
    if (tag === "video") media.addEventListener("loadedmetadata", sendMedia);
    if (window.ResizeObserver) new ResizeObserver(sendMedia).observe(document.body);
  }

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.type !== "gh-x-html:render") return;
    if (typeof d.html === "string") applyHtml(d.html);
    else if (d.media) applyMedia(d.media);
  });

  // Tell the parent we're ready to receive content.
  parent.postMessage({ type: "gh-x-html:ready" }, "*");
})();
