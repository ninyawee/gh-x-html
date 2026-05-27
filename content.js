// gh-x-html content script.
//
// Two rewrite paths, both gated by the trusted-authors allowlist:
//
//   1. Fence:    pre > code[class~="language-x-html"]  →  sandboxed iframe srcdoc
//   2. Media:    img[src$=.mp4|.webm|.mov]             →  <video controls preload="metadata">
//                a[href$=.mp4|.webm|.mov]              →  <video controls preload="metadata">
//                img/a ending in .mp3|.m4a|.ogg        →  <audio controls>
//
// Author detection walks up the DOM from the matched node to the nearest
// comment container, then reads the author login from one of GitHub's
// hovercard / author-link elements.

(() => {
  const APPLIED = "data-gh-x-html-applied";
  const VIDEO_EXTS = ["mp4", "webm", "mov"];
  const AUDIO_EXTS = ["mp3", "m4a", "ogg"];
  const MEDIA_EXTS = [...VIDEO_EXTS, ...AUDIO_EXTS];
  const IFRAME_HEIGHT_MIN = 80;
  const IFRAME_HEIGHT_MAX = 4000;

  // ---------- state ----------

  let trustedAuthors = new Set();
  let selfLogin = readSelfLogin();
  // iframe.contentWindow → iframe element, so postMessage handler can find which iframe to resize
  const iframeByWindow = new WeakMap();

  // ---------- author allowlist (chrome.storage.sync) ----------

  async function loadAllowlist() {
    const { trustedAuthors: stored } = await chrome.storage.sync.get("trustedAuthors");
    if (Array.isArray(stored)) {
      trustedAuthors = new Set(stored);
      return;
    }
    // First run: seed with self if we can detect it.
    if (selfLogin) {
      trustedAuthors = new Set([selfLogin]);
      await chrome.storage.sync.set({ trustedAuthors: [selfLogin] });
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.trustedAuthors) return;
    trustedAuthors = new Set(changes.trustedAuthors.newValue || []);
    // Re-scan so newly trusted authors' comments render without a reload.
    document.querySelectorAll(`[${APPLIED}]`).forEach((n) => n.removeAttribute(APPLIED));
    scan(document);
  });

  // ---------- DOM helpers ----------

  function readSelfLogin() {
    const meta = document.querySelector('meta[name="user-login"]');
    return meta?.content?.trim() || null;
  }

  // Find the comment author from the nearest comment container.
  //
  // SECURITY: the author element must come from the comment header, NOT from
  // anywhere inside .markdown-body / .comment-body. A naive descendant search
  // over an ancestor that wraps both the header and the body would pick up
  // @-mentions inside an attacker's comment — e.g. a hostile commenter typing
  // "@trusted-user" creates a hovercard link in their markdown body that would
  // otherwise be treated as the comment's author and bypass the allowlist.
  //
  // The fix: walk up to a known comment container, then scope author search to
  // the container's descendants explicitly excluding the markdown/comment body.
  const COMMENT_CONTAINER_SELECTOR = [
    ".js-comment",
    ".timeline-comment",
    ".review-comment",
    ".TimelineItem",
    ".js-timeline-item",
    ".discussion-timeline-item",
  ].join(", ");
  const BODY_SELECTOR = ".markdown-body, .comment-body, .js-comment-body";

  function findCommentAuthor(node) {
    const container = node.closest?.(COMMENT_CONTAINER_SELECTOR);
    if (!container) return null;

    const candidates = container.querySelectorAll(
      'a.author, a[data-hovercard-type="user"], [data-author-login]',
    );
    for (const link of candidates) {
      // Skip @-mentions and any author-shaped element inside the comment body.
      if (link.closest(BODY_SELECTOR)) continue;

      const fromAttr = link.getAttribute("data-author-login");
      if (fromAttr) return fromAttr.trim();
      // Prefer hovercard URL — that's the canonical header form.
      const url = link.getAttribute("data-hovercard-url") || link.getAttribute("href") || "";
      const m = url.match(/^\/(?:users\/)?([A-Za-z0-9-]+)(?:\/|$)/);
      if (m) return m[1];
      const t = link.textContent?.trim();
      if (t) return t.replace(/^@/, "");
    }
    return null;
  }

  function isTrusted(node) {
    const author = findCommentAuthor(node);
    return author != null && trustedAuthors.has(author);
  }

  function extOf(url) {
    try {
      const u = new URL(url, location.href);
      const dot = u.pathname.lastIndexOf(".");
      if (dot < 0) return "";
      return u.pathname.slice(dot + 1).toLowerCase();
    } catch {
      return "";
    }
  }

  function isUserAttachmentsUrl(url) {
    try {
      const u = new URL(url, location.href);
      return u.hostname === "github.com" && u.pathname.startsWith("/user-attachments/");
    } catch {
      return false;
    }
  }

  // ---------- fence rewrite ----------

  function rewriteFence(code) {
    if (code.hasAttribute(APPLIED)) return;
    const pre = code.closest("pre") || code.parentElement;
    if (!pre) return;
    if (!isTrusted(pre)) {
      code.setAttribute(APPLIED, "skipped");
      return;
    }

    const source = code.textContent || "";
    const iframe = document.createElement("iframe");
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-popups allow-popups-to-escape-sandbox",
    );
    iframe.setAttribute("loading", "lazy");
    iframe.style.cssText =
      "width: 100%; border: 0; display: block; height: 200px; background: transparent;";
    iframe.srcdoc = withResizer(source);
    iframe.dataset.ghXHtml = "fence";

    pre.replaceWith(iframe);
    iframeByWindow.set(iframe.contentWindow, iframe);
  }

  function withResizer(html) {
    // Injected at end of <body>. Posts height to parent on load + on body resize.
    // Caller is responsible for the srcdoc being a complete document — but we
    // also tolerate fragments by wrapping when there's no <html> root.
    const resizer = `<script>(function(){
      function send(){
        var h = Math.max(
          document.documentElement.scrollHeight,
          document.body ? document.body.scrollHeight : 0
        );
        parent.postMessage({type:'gh-x-html:resize', height: h}, '*');
      }
      window.addEventListener('load', send);
      if (window.ResizeObserver && document.body) {
        new ResizeObserver(send).observe(document.body);
      } else {
        setTimeout(send, 200);
      }
    })();<\/script>`;

    if (/<\/body\s*>/i.test(html)) {
      return html.replace(/<\/body\s*>/i, `${resizer}</body>`);
    }
    if (/<\/html\s*>/i.test(html)) {
      return html.replace(/<\/html\s*>/i, `${resizer}</html>`);
    }
    // Fragment: wrap so resize hook runs.
    return `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}${resizer}</body></html>`;
  }

  // ---------- media rewrite ----------

  function rewriteMedia(node, url) {
    if (node.hasAttribute(APPLIED)) return;
    if (isUserAttachmentsUrl(url)) {
      node.setAttribute(APPLIED, "user-attachments");
      return;
    }
    if (!isTrusted(node)) {
      node.setAttribute(APPLIED, "skipped");
      return;
    }
    const ext = extOf(url);
    if (!MEDIA_EXTS.includes(ext)) return;

    const tag = VIDEO_EXTS.includes(ext) ? "video" : "audio";
    const media = document.createElement(tag);
    media.setAttribute("controls", "");
    if (tag === "video") media.setAttribute("preload", "metadata");
    media.setAttribute("src", url);
    media.style.cssText =
      tag === "video"
        ? "max-width: 100%; display: block; margin: .25rem 0;"
        : "display: block; margin: .25rem 0;";
    media.dataset.ghXHtml = `media-${tag}`;

    // Preserve the original href as a fallback "open in new tab" link below the player.
    const fallback = document.createElement("a");
    fallback.href = url;
    fallback.textContent = node.tagName === "IMG" ? (node.alt || url) : (node.textContent || url);
    fallback.target = "_blank";
    fallback.rel = "noopener";
    fallback.style.cssText = "font-size: .85em; color: var(--fgColor-muted, #57606a); display: inline-block; margin-bottom: .25rem;";

    const wrap = document.createElement("span");
    wrap.dataset.ghXHtmlWrap = "1";
    wrap.style.cssText = "display: block;";
    wrap.appendChild(media);
    wrap.appendChild(fallback);

    node.replaceWith(wrap);
  }

  // ---------- scan + observe ----------

  function scan(root) {
    // Fences
    root.querySelectorAll(
      `pre > code.language-x-html:not([${APPLIED}]), pre > code[class*="language-x-html"]:not([${APPLIED}])`,
    ).forEach(rewriteFence);

    // Also catch x-html when rendered inside .highlight-source-x-html (rare).
    root.querySelectorAll(`div.highlight-source-x-html pre code:not([${APPLIED}])`).forEach(
      rewriteFence,
    );

    // Media-URL: img[src] inside markdown-rendered comment bodies.
    root.querySelectorAll(`.markdown-body img[src]:not([${APPLIED}])`).forEach((img) => {
      const src = img.getAttribute("src");
      if (src && MEDIA_EXTS.includes(extOf(src))) rewriteMedia(img, src);
    });

    // Media-URL: a[href] inside markdown-rendered comment bodies.
    root.querySelectorAll(`.markdown-body a[href]:not([${APPLIED}])`).forEach((a) => {
      const href = a.getAttribute("href");
      if (href && MEDIA_EXTS.includes(extOf(href))) rewriteMedia(a, href);
    });
  }

  let pending = false;
  function scheduleScan() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      scan(document);
    });
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Turbo navigations (GitHub uses Turbo for soft nav between pages).
  document.addEventListener("turbo:load", () => {
    selfLogin = readSelfLogin();
    scheduleScan();
  });
  document.addEventListener("pjax:end", scheduleScan);

  // ---------- iframe resize listener ----------

  window.addEventListener("message", (e) => {
    const data = e.data;
    if (!data || data.type !== "gh-x-html:resize") return;
    const iframe = iframeByWindow.get(e.source);
    if (!iframe) return;
    const h = Math.max(IFRAME_HEIGHT_MIN, Math.min(IFRAME_HEIGHT_MAX, Number(data.height) || 0));
    if (h > 0) iframe.style.height = `${h}px`;
  });

  // ---------- bootstrap ----------

  loadAllowlist().then(() => scan(document));
})();
