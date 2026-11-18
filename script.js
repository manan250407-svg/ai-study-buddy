const $ = (id) => document.getElementById(id);
const notesEl = $("notes"), genBtn = $("genBtn"), keyEl = $("apiKey");
const GEN_LABEL = "✨ Make my study kit";
const LOADING = ["Reading your notes...", "Picking out the important bits...", "Cooking up some questions...", "Almost there..."];

// friendly little toast instead of ugly alert()
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 3500);
}

// greeting based on time of day
(function greet() {
  const h = new Date().getHours();
  const part = h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Late night study session";
  $("greet").textContent = part + (h < 5 || h >= 21 ? "? Let's make it count 🌙" : "! Ready to study smart? 👋");
})();

function cheer(score, total) {
  const r = score / total;
  if (r === 1) return "Perfect score! You clearly know your stuff 🎉";
  if (r >= 0.6) return "Nice work, you're almost there 💪";
  return "Good start! Skim the summary once more and try again 🌱";
}

const SAMPLE = `Photosynthesis is the process by which green plants convert light energy into chemical energy. It takes place in the chloroplasts, which contain the pigment chlorophyll. Chlorophyll absorbs sunlight, mainly in the red and blue wavelengths. During the light reactions, water molecules are split to release oxygen and produce ATP and NADPH. In the Calvin cycle, carbon dioxide is fixed into glucose using the energy stored in ATP and NADPH. Photosynthesis is essential because it produces oxygen and forms the base of most food chains on Earth.`;

const STOP = new Set(("a an the and or but if then of to in on at by for with from as is are was were be been being it its this that these those which who whom " +
  "into than so such can could may might will would shall should do does did has have had not no also more most other some any each both their there where when while during about over under between").split(" "));

// ---------- helpers ----------
const words = (t) => (t.toLowerCase().match(/[a-z][a-z'-]+/g) || []);
const sentences = (t) => t.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(" ").length >= 6);
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

function freqMap(text) {
  const f = {};
  words(text).forEach((w) => { if (w.length > 3 && !STOP.has(w)) f[w] = (f[w] || 0) + 1; });
  return f;
}

// ---------- offline generator ----------
function localGenerate(text) {
  const sents = sentences(text);
  if (sents.length < 2) throw new Error("That's a bit short! Paste a few sentences so I have something to work with.");
  const f = freqMap(text);
  const scored = sents.map((s, i) => {
    const ws = words(s);
    const score = ws.reduce((a, w) => a + (f[w] || 0), 0) / Math.sqrt(ws.length);
    return { s, i, score };
  });
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, Math.min(5, scored.length));
  const summary = top.sort((a, b) => a.i - b.i).map((x) => x.s);

  const keywords = Object.entries(f).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map((x) => x[0]);

  const quiz = [];
  for (const { s } of [...scored].sort((a, b) => b.score - a.score)) {
    if (quiz.length >= 5) break;
    const ans = words(s).filter((w) => f[w]).sort((a, b) => f[b] - f[a] || b.length - a.length)[0];
    if (!ans) continue;
    const distract = shuffle(keywords.filter((k) => k !== ans)).slice(0, 3);
    if (distract.length < 3) continue;
    const q = s.replace(new RegExp("\\b" + ans + "\\b", "i"), "_____");
    const options = shuffle([ans, ...distract]);
    quiz.push({ q: "Fill in the blank: " + q, options, answer: options.indexOf(ans) });
  }

  const cards = keywords.slice(0, 8).map((k) => {
    const back = sents.find((s) => new RegExp("\\b" + k + "\\b", "i").test(s));
    return back ? { front: "Explain: " + k, back } : null;
  }).filter(Boolean);

  return { summary, quiz, cards, mode: "Running offline 🔌" };
}

// ---------- Gemini generator ----------
async function aiGenerate(text, key) {
  const prompt = `You are a study assistant. From the notes below, return ONLY valid JSON (no markdown) in this exact shape:
{"summary":["5 short bullet strings"],"quiz":[{"q":"question","options":["A","B","C","D"],"answer":0}],"cards":[{"front":"term or question","back":"short answer"}]}
Make 5 quiz questions and 8 flashcards. "answer" is the index (0-3) of the correct option.

NOTES:
${text}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error("Gemini API error " + res.status);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const out = JSON.parse(raw.replace(/```json|```/g, "").trim());
  return { summary: out.summary || [], quiz: out.quiz || [], cards: out.cards || [], mode: "Powered by Gemini ✨" };
}

// ---------- renderers ----------
function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

function renderSummary(list) {
  $("summary").innerHTML = "<ul>" + list.map((s) => `<li>${esc(s)}</li>`).join("") + "</ul>";
}

function renderQuiz(quiz) {
  const box = $("quiz");
  if (!quiz.length) { box.innerHTML = "<p class='muted'>Hmm, I couldn't find enough to quiz you on. Try adding a few more sentences.</p>"; return; }
  let score = 0, done = 0;
  box.innerHTML = `<div class="score" id="score">Score: 0 / ${quiz.length}</div>`;
  quiz.forEach((item, qi) => {
    const wrap = document.createElement("div");
    wrap.className = "q";
    wrap.innerHTML = `<p>${qi + 1}. ${esc(item.q)}</p>`;
    item.options.forEach((opt, oi) => {
      const b = document.createElement("button");
      b.className = "opt"; b.textContent = opt;
      b.onclick = () => {
        wrap.querySelectorAll(".opt").forEach((x, xi) => {
          x.disabled = true;
          if (xi === item.answer) x.classList.add("correct");
        });
        if (oi === item.answer) score++; else b.classList.add("wrong");
        done++;
        $("score").textContent = `Score: ${score} / ${quiz.length}` + (done === quiz.length ? "  ·  " + cheer(score, quiz.length) : "");
      };
      wrap.appendChild(b);
    });
    box.appendChild(wrap);
  });
}

function renderCards(cards) {
  const box = $("cards");
  if (!cards.length) { box.innerHTML = "<p class='muted'>No flashcards this time. A longer note usually does the trick.</p>"; return; }
  box.innerHTML = '<p class="muted">Click a card to flip it.</p><div class="grid"></div>';
  const grid = box.querySelector(".grid");
  cards.forEach((c) => {
    const el = document.createElement("div");
    el.className = "flip";
    el.innerHTML = `<div class="flip-inner"><div class="face front">${esc(c.front)}</div><div class="face back">${esc(c.back)}</div></div>`;
    el.onclick = () => el.classList.toggle("on");
    grid.appendChild(el);
  });
}

// ---------- events ----------
document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    ["summary", "quiz", "cards"].forEach((id) => $(id).classList.toggle("hidden", id !== t.dataset.tab));
  };
});

notesEl.addEventListener("input", () => {
  $("count").textContent = words(notesEl.value).length + " words";
});
$("sampleBtn").onclick = () => { notesEl.value = SAMPLE; notesEl.dispatchEvent(new Event("input")); };
$("clearBtn").onclick = () => { notesEl.value = ""; notesEl.dispatchEvent(new Event("input")); $("results").classList.add("hidden"); };

genBtn.onclick = async () => {
  const text = notesEl.value.trim();
  if (!text) { toast("Paste some notes first, then I can work my magic ✨"); return; }
  let i = 0, loadTimer;
  genBtn.disabled = true; genBtn.textContent = LOADING[0];
  loadTimer = setInterval(() => { i = (i + 1) % LOADING.length; genBtn.textContent = LOADING[i]; }, 900);
  try {
    const key = keyEl.value.trim();
    let out;
    if (key) {
      try { out = await aiGenerate(text, key); }
      catch (e) { out = localGenerate(text); out.mode = "Gemini was shy, so I ran offline 🔌"; }
    } else {
      out = localGenerate(text);
    }
    renderSummary(out.summary); renderQuiz(out.quiz); renderCards(out.cards);
    $("modeBadge").textContent = out.mode;
    $("results").classList.remove("hidden");
    $("results").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    toast(e.message);
  } finally {
    clearInterval(loadTimer);
    genBtn.disabled = false; genBtn.textContent = GEN_LABEL;
  }
};

// theme + saved key
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  $("themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
  try { localStorage.setItem("theme", t); } catch (e) {}
}
$("themeBtn").onclick = () => applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
try {
  applyTheme(localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  keyEl.value = localStorage.getItem("gkey") || "";
  keyEl.addEventListener("change", () => localStorage.setItem("gkey", keyEl.value.trim()));
} catch (e) { applyTheme("light"); }
