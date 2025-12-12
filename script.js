// --- Globale Variablen ---
const CSV_FILE = 'fragen.csv'; 
const QUIZ_BOARD_EL = document.getElementById('quiz-board');
const MODAL_EL = document.getElementById('question-modal');
const CLOSE_MODAL_BTN = document.getElementById('close-modal-btn');
const SHOW_ANSWER_BTN = document.getElementById('show-answer-btn');
const START_TIMER_BTN = document.getElementById('start-timer-btn');
const MODAL_ANSWER_EL = document.getElementById('modal-answer');
let currentQuestion = null; 
let timerInterval = null;
let timerActive = false;
let blinkInterval = null;

// Mapping für CSS-Farben der Kategorien
const CATEGORY_COLORS = [
    'var(--cat-color-1)', 
    'var(--cat-color-2)', 
    'var(--cat-color-3)', 
    'var(--cat-color-4)', // NEU: 4. Farbe
    'var(--cat-color-default)' // Falls es mehr als 4 gibt
];

// --- Datenverarbeitung ---

/**
 * Holt die CSV-Datei per fetch vom Server und parst sie.
 * @returns {Promise<Array>} Ein Promise, das die geparsten Quiz-Daten zurückgibt.
 */
async function loadAndParseCSV() {
    try {
        const response = await fetch(CSV_FILE); 
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} (${response.statusText})`);
        }
        
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error("Fehler beim Laden oder Parsen der CSV-Datei:", error);
        alert(`Konnte die Quiz-Daten (${CSV_FILE}) nicht laden. Bitte lokalen Server prüfen.`);
        return [];
    }
}


/**
 * Parst den CSV-Text in ein Array von Objekten.
 * KORRIGIERT: Behandelt variable Spaltenanzahl für Antwortmöglichkeiten.
 * @param {string} csvText Der Inhalt der CSV-Datei.
 * @returns {Array} Die geparsten Daten.
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];

    // Die Header (Spaltennamen) sind nicht mehr entscheidend, aber gut für Konsistenz
    // const headers = lines[0].split(';'); 
    const data = [];


    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';').map(v => v.trim());
        // Neue Reihenfolge: Kategorie;Schwierigkeit;Frage;Lösung;Antwortmöglichkeiten
        if (values.length < 5) continue;

        const question = {};
        question.Kategorie = values[0];
        question.Schwierigkeit = values[1];
        question.Frage = values[2];
        question.Lösung = values[3];
        question.Antwortmöglichkeiten = values[4];
        question.id = `${question.Kategorie}-${question.Schwierigkeit}`;
        question.played = false;
        data.push(question);
    }

    // Eindeutige Kategorien ermitteln
    categories = [...new Set(data.map(q => q.Kategorie))];
    
    return data;
}


// --- Rendering der Haupttafel ---

/**
 * Rendert die gesamte Quiz-Tafel basierend auf den geladenen Daten.
 */
function renderQuizBoard() {
    if (categories.length === 0) return;

    // Setzt die CSS Grid-Spaltenanzahl
    QUIZ_BOARD_EL.style.setProperty('--num-columns', categories.length);
    QUIZ_BOARD_EL.innerHTML = ''; // Leert die Tafel

    // 1. Kategorien-Header rendern
    categories.forEach((cat, index) => {
        const headerEl = document.createElement('div');
        headerEl.className = 'category-header';
        headerEl.textContent = cat;
        // Dynamische Zuweisung der Kategorie-Farbe
        headerEl.style.setProperty('--card-color', CATEGORY_COLORS[index] || CATEGORY_COLORS[CATEGORY_COLORS.length - 1]);
        QUIZ_BOARD_EL.appendChild(headerEl);
    });

    // 2. Fragekarten rendern
    const difficulties = [100, 200, 300, 400]; // Die festgelegten Schwierigkeitsstufen

    difficulties.forEach(diff => {
        categories.forEach((cat, index) => {
            const question = quizData.find(q => q.Kategorie === cat && parseInt(q.Schwierigkeit) === diff);
            
            if (question) {
                const cardEl = document.createElement('div');
                cardEl.className = `question-card diff-${diff}`;
                cardEl.id = `card-${question.id}`; // Wichtig für das Ausgrauen
                cardEl.textContent = diff;
                
                // Setzt die Farbe und den Event-Listener
                cardEl.style.setProperty('--card-color', CATEGORY_COLORS[index] || CATEGORY_COLORS[CATEGORY_COLORS.length - 1]);
                cardEl.addEventListener('click', () => openQuestion(question));

                if (question.played) {
                    cardEl.classList.add('played');
                }

                QUIZ_BOARD_EL.appendChild(cardEl);
            } else {
                // Fügt leere Zellen hinzu, wenn keine Frage existiert (für gleichmäßiges Grid)
                const emptyEl = document.createElement('div');
                emptyEl.className = 'empty-card';
                QUIZ_BOARD_EL.appendChild(emptyEl);
            }
        });
    });
}

// --- Modal-Logik ---

/**
 * Öffnet das Modal und zeigt die ausgewählte Frage an.
 * @param {Object} question Das Frage-Objekt.
 */
function openQuestion(question) {
    currentQuestion = question;

    document.getElementById('modal-category').textContent = question.Kategorie;
    document.getElementById('modal-points').textContent = `${question.Schwierigkeit} Punkte`;
    document.getElementById('modal-question').textContent = question.Frage;
    MODAL_ANSWER_EL.textContent = question.Lösung;

    // Antwortmöglichkeiten rendern
    const optionsList = document.getElementById('modal-options');
    optionsList.innerHTML = '';
    if (question.Antwortmöglichkeiten) {
        optionsList.style.display = 'block';
        const options = question.Antwortmöglichkeiten.split('|').filter(o => o.trim() !== '');
        options.forEach(option => {
            const li = document.createElement('li');
            li.textContent = option.trim();
            optionsList.appendChild(li);
        });
    } else {
        optionsList.style.display = 'none';
    }

    // Timer zurücksetzen
    resetTimer();

    // Antwort verstecken beim Öffnen der Frage
    MODAL_ANSWER_EL.classList.add('hidden');
    SHOW_ANSWER_BTN.disabled = false;

    MODAL_EL.classList.remove('hidden');
}

function startTimer() {
    if (timerActive) return;
    let timeLeft = 10;
    timerActive = true;
    START_TIMER_BTN.disabled = true;
    START_TIMER_BTN.textContent = `⏱️ ${timeLeft} Sekunden`;
    START_TIMER_BTN.classList.remove('timer-blink');
    timerInterval = setInterval(() => {
        timeLeft--;
        START_TIMER_BTN.textContent = `⏱️ ${timeLeft} Sekunden`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerActive = false;
            START_TIMER_BTN.textContent = '⏱️ Zeit abgelaufen!';
            START_TIMER_BTN.classList.add('timer-blink');
            // Blinken starten
            let blink = true;
            blinkInterval = setInterval(() => {
                if (blink) {
                    START_TIMER_BTN.style.backgroundColor = 'red';
                    START_TIMER_BTN.style.color = 'white';
                } else {
                    START_TIMER_BTN.style.backgroundColor = 'white';
                    START_TIMER_BTN.style.color = 'red';
                }
                blink = !blink;
            }, 400);
        }
    }, 1000);
}

function resetTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (blinkInterval) clearInterval(blinkInterval);
    timerActive = false;
    if (START_TIMER_BTN) {
        START_TIMER_BTN.textContent = '⏱️ Timer starten';
        START_TIMER_BTN.disabled = false;
        START_TIMER_BTN.style.backgroundColor = '';
        START_TIMER_BTN.style.color = '';
        START_TIMER_BTN.classList.remove('timer-blink');
    }
}
function showAnswer() {
    MODAL_ANSWER_EL.classList.remove('hidden'); 
    SHOW_ANSWER_BTN.disabled = true; 
}

/**
 * Schließt das Modal und markiert die Frage als gespielt.
 */
function closeQuestion() {
    if (currentQuestion) {
        const playedQuestionIndex = quizData.findIndex(q => q.id === currentQuestion.id);
        if (playedQuestionIndex !== -1) {
            quizData[playedQuestionIndex].played = true;
        }
        const cardEl = document.getElementById(`card-${currentQuestion.id}`);
        if (cardEl) {
            cardEl.classList.add('played');
        }
    }
    resetTimer();
    MODAL_EL.classList.add('hidden');
    currentQuestion = null;
}

// --- Event Listener ---
SHOW_ANSWER_BTN.addEventListener('click', showAnswer);
CLOSE_MODAL_BTN.addEventListener('click', closeQuestion);
if (START_TIMER_BTN) START_TIMER_BTN.addEventListener('click', startTimer);

// --- Initialisierung ---
async function init() {
    quizData = await loadAndParseCSV();
    if (quizData.length > 0) {
        renderQuizBoard();
    }
    // Zufallsbutton-Logik
    const randomBtn = document.getElementById('random-question-btn');
    if (randomBtn) {
        randomBtn.addEventListener('click', () => {
            const unplayed = quizData.filter(q => !q.played);
            if (unplayed.length === 0) {
                alert('Alle Fragen wurden bereits gespielt!');
                return;
            }
            const randomIndex = Math.floor(Math.random() * unplayed.length);
            openQuestion(unplayed[randomIndex]);
        });
    }
}

init();
