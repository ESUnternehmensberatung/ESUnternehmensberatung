/* === NAV SCROLL === */
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
});

/* === MOBILE NAV === */
const burger = document.querySelector('.nav__burger');
burger?.addEventListener('click', () => nav.classList.toggle('open'));
document.querySelectorAll('.nav__links a').forEach(a =>
  a.addEventListener('click', () => nav.classList.remove('open'))
);

/* === SCROLL REVEAL === */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

/* === KI READINESS CHECK === */
const questions = [
  {
    text: "Wie viele Prozesse in Ihrem Unternehmen sind noch vollständig manuell (z.B. Dateneingabe, E-Mail-Antworten, Reportings)?",
    options: ["Fast alle – wir arbeiten sehr manuell", "Viele – gelegentlich nutzen wir Tools", "Einige – wir haben schon erste Automatisierungen", "Wenige – wir sind bereits gut aufgestellt"]
  },
  {
    text: "Nutzen Sie bereits KI-Tools im Arbeitsalltag (z.B. ChatGPT, Copilot, Langdock)?",
    options: ["Nein, noch gar nicht", "Einzelne Mitarbeiter testen privat", "Wir testen es in einem Pilotprojekt", "Ja, mehrere Tools sind im Einsatz"]
  },
  {
    text: "Wie gut sind Ihre Unternehmensdaten organisiert und zugänglich?",
    options: ["Chaotisch – alles verteilt auf E-Mails und Ordner", "Teilweise strukturiert, aber nicht einheitlich", "Gut strukturiert, aber noch nicht digital optimiert", "Sehr gut – zentrale Datenhaltung vorhanden"]
  },
  {
    text: "Haben Sie Budget und Bereitschaft, KI-Lösungen in den nächsten 12 Monaten einzuführen?",
    options: ["Kein Budget und kein Plan", "Idee vorhanden, aber kein konkretes Budget", "Budget ist vorhanden, Plan fehlt noch", "Budget und grober Plan sind vorhanden"]
  },
  {
    text: "Wie ist Ihre Belegschaft gegenüber neuen digitalen Tools eingestellt?",
    options: ["Sehr skeptisch – große Widerstände", "Gemischt – einige offen, andere skeptisch", "Überwiegend offen für Neues", "Sehr aufgeschlossen – aktive Nachfrage"]
  }
];

let currentQ = 0;
let answers = [];

const checkForm = document.getElementById('ki-check-form');
const checkResult = document.getElementById('ki-check-result');

function renderQuestion(idx) {
  const container = document.getElementById('check-questions');
  if (!container) return;
  container.innerHTML = '';
  const q = questions[idx];
  const div = document.createElement('div');
  div.className = 'check-question active';
  div.innerHTML = `
    <div class="check-question__step">Frage ${idx + 1} von ${questions.length}</div>
    <p>${q.text}</p>
    <div class="check-options">
      ${q.options.map((opt, i) => `
        <label class="check-option${answers[idx] === i ? ' selected' : ''}">
          <input type="radio" name="q${idx}" value="${i}" ${answers[idx] === i ? 'checked' : ''}>
          <span class="check-option__dot"></span>
          ${opt}
        </label>
      `).join('')}
    </div>
    <div class="check-nav">
      <button class="btn btn-outline" onclick="prevQ()" ${idx === 0 ? 'style="visibility:hidden"' : ''}>← Zurück</button>
      <button class="btn btn-primary" onclick="nextQ()">${idx === questions.length - 1 ? 'Ergebnis anzeigen' : 'Weiter →'}</button>
    </div>
  `;
  container.appendChild(div);
  updateProgress(idx);

  div.querySelectorAll('.check-option').forEach(opt => {
    opt.addEventListener('click', function() {
      div.querySelectorAll('.check-option').forEach(o => o.classList.remove('selected'));
      this.classList.add('selected');
      answers[idx] = parseInt(this.querySelector('input').value);
    });
  });
}

function updateProgress(idx) {
  const bar = document.querySelector('.check-progress__bar');
  if (bar) bar.style.width = `${((idx) / questions.length) * 100}%`;
}

window.nextQ = function() {
  if (answers[currentQ] === undefined) {
    alert('Bitte wählen Sie eine Antwort aus.');
    return;
  }
  if (currentQ < questions.length - 1) {
    currentQ++;
    renderQuestion(currentQ);
  } else {
    showResult();
  }
};

window.prevQ = function() {
  if (currentQ > 0) {
    currentQ--;
    renderQuestion(currentQ);
  }
};

function showResult() {
  const total = answers.reduce((sum, v) => sum + v, 0);
  const max = (questions.length * 3);
  const pct = Math.round((total / max) * 100);

  let label, msg, color;
  if (pct < 30) {
    label = "KI-Einsteiger"; color = "#ef4444";
    msg = "Es gibt großes Potenzial! Genau hier setze ich an – pragmatisch, ohne IT-Chaos.";
  } else if (pct < 60) {
    label = "KI-Fortgeschrittener"; color = "#f59e0b";
    msg = "Sie sind auf einem guten Weg. Mit gezielter Unterstützung sparen Sie in 90 Tagen messbar Zeit.";
  } else {
    label = "KI-Vorreiter"; color = "#22c55e";
    msg = "Stark aufgestellt! Jetzt geht es darum, das Potenzial vollständig auszuschöpfen.";
  }

  if (checkForm) checkForm.style.display = 'none';
  if (checkResult) {
    checkResult.style.display = 'block';
    document.getElementById('result-score').textContent = pct + '%';
    document.getElementById('result-label').textContent = label;
    document.getElementById('result-msg').textContent = msg;
    const fill = document.getElementById('result-fill');
    if (fill) setTimeout(() => { fill.style.width = pct + '%'; }, 100);
  }
}

window.restartCheck = function() {
  currentQ = 0;
  answers = [];
  if (checkForm) checkForm.style.display = 'block';
  if (checkResult) checkResult.style.display = 'none';
  renderQuestion(0);
};

if (document.getElementById('check-questions')) {
  renderQuestion(0);
}

/* === CONTACT FORM === */
document.getElementById('contact-form')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const btn = this.querySelector('button[type=submit]');
  btn.textContent = 'Wird gesendet…';
  btn.disabled = true;

  // Formspree or similar — update action URL
  fetch(this.action, {
    method: 'POST',
    body: new FormData(this),
    headers: { 'Accept': 'application/json' }
  }).then(r => {
    if (r.ok) {
      this.innerHTML = `
        <div style="text-align:center;padding:2rem 0">
          <div style="font-size:3rem;margin-bottom:1rem">✅</div>
          <h3 style="color:var(--clr-primary);font-size:1.3rem;margin-bottom:.5rem">Vielen Dank!</h3>
          <p style="color:var(--clr-text-muted)">Ich melde mich innerhalb von 24 Stunden bei Ihnen.</p>
        </div>`;
    } else {
      btn.textContent = 'Fehler – bitte erneut versuchen';
      btn.disabled = false;
    }
  }).catch(() => {
    btn.textContent = 'Fehler – bitte erneut versuchen';
    btn.disabled = false;
  });
});

/* === EMAIL CAPTURE (KI CHECK) === */
document.getElementById('ki-email-form')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const email = this.querySelector('input[type=email]').value;
  this.innerHTML = `<p style="color:var(--clr-accent);font-weight:600;text-align:center">✓ Auswertung wird gesendet an ${email}</p>`;
});
