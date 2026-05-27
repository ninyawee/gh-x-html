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
    if (Array.isArray(stored) && stored.length > 0) {
      trustedAuthors = new Set(stored);
      return;
    }
    // First run OR list is empty — seed with self if we can detect it.
    // An empty list almost certainly means the popup ran on a non-GitHub tab
    // (no meta[name="user-login"] available) and saved []. The content script
    // is the right place to do the seed because it always runs on github.com.
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
  // @-mentions inside an attacker's comment — a hostile commenter typing
  // "@trusted-user" creates a hovercard link in their markdown body that would
  // otherwise be treated as the comment's author and bypass the allowlist.
  //
  // We support two UI generations:
  //
  //   1. New issue UI (React, CSS modules) — exposes a stable data-testid
  //      ending in "-header-author". Walk up from the matched node and stop
  //      at the nearest ancestor that contains such an element. That ancestor
  //      is, by construction, the smallest comment container.
  //
  //   2. Legacy UI (classic timeline) — uses .js-comment / .timeline-comment
  //      etc. Walk up to a container, then read a.author / hovercard link
  //      from outside the markdown body.
  const LEGACY_CONTAINER_SELECTOR = [
    ".js-comment",
    ".timeline-comment",
    ".review-comment",
    ".TimelineItem",
    ".js-timeline-item",
    ".discussion-timeline-item",
  ].join(", ");
  // BODY_SELECTOR matches only the rendered-markdown content area, NOT
  // header/footer chrome. We deliberately do NOT include `[data-testid="issue-body"]`
  // — that testid wraps both the comment header AND the markdown body in the
  // new UI, so closest() against it would falsely reject a header-author link.
  // The data-testid$="-header-author" filter is itself the primary security
  // boundary (mentions in user markdown can never carry that testid because
  // GitHub strips data-* attributes from user content); BODY_SELECTOR is
  // defense-in-depth for the legacy UI's hovercard-on-mention case.
  const BODY_SELECTOR = [
    ".markdown-body",
    ".comment-body",
    ".js-comment-body",
    '[data-testid="markdown-body"]',
  ].join(", ");

  function extractLogin(el) {
    const fromAttr = el.getAttribute("data-author-login");
    if (fromAttr) return fromAttr.trim();
    const url = el.getAttribute("data-hovercard-url") || el.getAttribute("href") || "";
    const m = url.match(/^(?:https?:\/\/github\.com)?\/(?:users\/)?([A-Za-z0-9-]+)(?:\/|$)/);
    if (m) return m[1];
    const t = el.textContent?.trim();
    return t ? t.replace(/^@/, "") : null;
  }

  function findCommentAuthor(node) {
    // Pass 1 — new UI. Walk up; the smallest ancestor containing a
    // -header-author link is the comment container by definition.
    let el = node.parentElement;
    while (el && el !== document.body) {
      const headerAuthor = el.querySelector('a[data-testid$="-header-author"]');
      if (headerAuthor && !headerAuthor.closest(BODY_SELECTOR)) {
        const login = extractLogin(headerAuthor);
        if (login) return login;
      }
      el = el.parentElement;
    }

    // Pass 2 — legacy UI fallback.
    const container = node.closest?.(LEGACY_CONTAINER_SELECTOR);
    if (!container) return null;
    const candidates = container.querySelectorAll(
      'a.author, a[data-hovercard-type="user"], [data-author-login]',
    );
    for (const link of candidates) {
      if (link.closest(BODY_SELECTOR)) continue;
      const login = extractLogin(link);
      if (login) return login;
    }
    return null;
  }

  // Trust check result is discriminated so callers can distinguish "author not
  // yet detectable" (retry on later scan tick — React may still be hydrating)
  // from "author detectable but not in allowlist" (permanent skip, mark applied).
  function trustCheck(node) {
    const author = findCommentAuthor(node);
    if (author == null) return { state: "pending" };
    return { state: trustedAuthors.has(author) ? "trusted" : "untrusted", author };
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

  function rewriteFence(pre) {
    if (pre.hasAttribute(APPLIED)) return;
    const code = pre.querySelector("code");
    if (!code) return;
    const trust = trustCheck(pre);
    if (trust.state === "pending") return; // retry on next scan tick
    if (trust.state === "untrusted") {
      pre.setAttribute(APPLIED, "untrusted");
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

    // GitHub wraps fences in <div class="snippet-clipboard-content"> with a
    // floating copy button. Replace the whole wrapper if present, otherwise
    // just the <pre>.
    const wrapper = pre.closest(".snippet-clipboard-content") || pre;
    wrapper.replaceWith(iframe);
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
    const trust = trustCheck(node);
    if (trust.state === "pending") return; // retry on next scan tick
    if (trust.state === "untrusted") {
      node.setAttribute(APPLIED, "untrusted");
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
    // Fences. GitHub renders unknown-language fences as <pre lang="x-html">
    // with no language class on the inner <code>. Older surfaces wrap known
    // languages in <div class="highlight-source-x-html">, so we cover both.
    root.querySelectorAll(`pre[lang="x-html"]:not([${APPLIED}])`).forEach(rewriteFence);
    root.querySelectorAll(
      `div.highlight-source-x-html pre:not([${APPLIED}])`,
    ).forEach(rewriteFence);
    // Legacy fallback: language class on <code> directly.
    root.querySelectorAll(`pre > code.language-x-html:not([${APPLIED}])`).forEach((code) => {
      const pre = code.closest("pre");
      if (pre) rewriteFence(pre);
    });

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
