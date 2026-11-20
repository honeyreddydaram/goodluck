"use strict";

const element = (id) => document.getElementById(id);
const form = element("form");
const message = element("message");
const send = element("send");
const status = element("status");
const wallStatus = element("wall-status");
const config = window.FAREWELL;
const endpoint = config.supabaseUrl.trim().replace(/\/+$/, "") + "/rest/v1/farewell_notes";
const headers = { apikey: config.publishableKey.trim() };
const ready = /^https:\/\//i.test(endpoint) && Boolean(headers.apikey);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
let refreshVersion = 0;
let attempt;

function noteCard(note) {
  const card = document.createElement("article");
  card.className = "note";
  const body = document.createElement("p");
  body.textContent = note.message;
  const footer = document.createElement("div");
  footer.className = "meta";
  const author = document.createElement("strong");
  author.textContent = note.author || "Anonymous";
  const time = document.createElement("time");
  time.dateTime = note.created_at;
  time.textContent = dateFormat.format(new Date(note.created_at));
  footer.append(author, time);
  card.append(body, footer);
  return card;
}

async function refreshWall() {
  const version = ++refreshVersion;
  try {
    const response = await fetch(
      endpoint + "?select=id,author,message,created_at&order=created_at.desc,id.desc&limit=1000",
      { headers, cache: "no-store", signal: AbortSignal.timeout(12000) }
    );
    if (!response.ok) throw new Error("Read failed");
    const notes = await response.json();
    if (version !== refreshVersion) return;
    element("notes").replaceChildren(...notes.map(noteCard));
    element("total").textContent = notes.length ? String(notes.length) : "";
    wallStatus.textContent = notes.length ? "" : "Be the first to leave Ananya a note.";
  } catch {
    if (version === refreshVersion) wallStatus.textContent = "The wall couldn’t refresh. Trying again shortly.";
  }
}

function updateCount() {
  element("count").textContent = message.value.length + " / 500";
}

message.addEventListener("input", updateCount);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (send.disabled) return;
  const author = element("author").value.trim();
  const body = message.value.trim();
  if (!body) {
    status.textContent = "Write a note before sending.";
    message.focus();
    return;
  }
  if (!attempt || attempt.author !== author || attempt.message !== body) {
    attempt = { id: crypto.randomUUID(), author, message: body };
  }
  send.disabled = true;
  element("author").readOnly = message.readOnly = true;
  status.textContent = "Sending…";
  try {
    const response = await fetch(endpoint + "?on_conflict=id", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(attempt),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error("Write failed");
    attempt = undefined;
    form.reset();
    updateCount();
    status.textContent = "Your note was sent!";
    await refreshWall();
  } catch {
    status.textContent = "We couldn’t confirm your note was sent. You can tap Send note to retry.";
  } finally {
    send.disabled = false;
    element("author").readOnly = message.readOnly = false;
  }
});

if (ready) {
  send.disabled = false;
  refreshWall();
  setInterval(() => { if (!document.hidden) refreshWall(); }, 8000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshWall(); });
} else {
  wallStatus.textContent = "The wall opens once shared notes are connected.";
  status.textContent = "Preview mode. Sending opens after setup.";
}

const dialog = element("share-dialog");
const shareStatus = element("share-status");
const shareUrl = config.publicUrl.trim() || location.href.split(/[?#]/)[0];

function renderQr() {
  if (!/^https:\/\//i.test(shareUrl) || /^(https:\/\/)(localhost|127\.0\.0\.1)([:/]|$)/i.test(shareUrl)) {
    throw new Error("Open the published HTTPS page to make a shareable QR code.");
  }
  if (typeof window.qrcode !== "function") throw new Error("QR generation is unavailable. You can still copy the link.");
  const code = window.qrcode(0, "M");
  code.addData(shareUrl);
  code.make();
  const margin = 4;
  const scale = 12;
  const size = code.getModuleCount();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = (size + margin * 2) * scale;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "QR code for the farewell wall");
  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "black";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (code.isDark(row, col)) context.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
    }
  }
  element("qr").replaceChildren(canvas);
  element("download").href = canvas.toDataURL("image/png");
  element("download").hidden = false;
}

element("share").addEventListener("click", () => {
  shareStatus.textContent = "";
  dialog.showModal();
  try { renderQr(); }
  catch (error) { shareStatus.textContent = error.message; }
});

element("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareUrl);
    shareStatus.textContent = "Link copied.";
  } catch {
    shareStatus.textContent = shareUrl;
  }
});
