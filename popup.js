// Popup: edit the trusted-authors allowlist in chrome.storage.sync.

const listEl = document.getElementById("authors");
const formEl = document.getElementById("add-form");
const inputEl = document.getElementById("login-input");

async function getSelfLoginFromActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.querySelector('meta[name="user-login"]')?.content || null,
    });
    return result?.result || null;
  } catch {
    return null;
  }
}

async function load() {
  const { trustedAuthors } = await chrome.storage.sync.get("trustedAuthors");
  return Array.isArray(trustedAuthors) ? trustedAuthors : [];
}

async function save(authors) {
  await chrome.storage.sync.set({ trustedAuthors: authors });
}

function render(authors, selfLogin) {
  listEl.replaceChildren();
  authors.forEach((login) => {
    const li = document.createElement("li");
    if (login === selfLogin) li.classList.add("is-self");

    const span = document.createElement("span");
    span.className = "login";
    span.textContent = `@${login}`;
    li.appendChild(span);

    if (login === selfLogin) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "you";
      li.appendChild(badge);
    }

    const rm = document.createElement("button");
    rm.className = "remove";
    rm.type = "button";
    rm.textContent = "remove";
    rm.addEventListener("click", async () => {
      const next = (await load()).filter((x) => x !== login);
      await save(next);
      render(next, selfLogin);
    });
    li.appendChild(rm);

    listEl.appendChild(li);
  });
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const login = inputEl.value.trim().replace(/^@/, "");
  if (!login) return;
  const current = await load();
  if (!current.includes(login)) {
    const next = [...current, login];
    await save(next);
    inputEl.value = "";
    const selfLogin = await getSelfLoginFromActiveTab();
    render(next, selfLogin);
  } else {
    inputEl.value = "";
  }
});

(async () => {
  const selfLogin = await getSelfLoginFromActiveTab();
  let authors = await load();
  if (authors.length === 0 && selfLogin) {
    authors = [selfLogin];
    await save(authors);
  }
  render(authors, selfLogin);
})();
