// --- Globale Variablen ---
const CSV_FILE = 'fragen.csv'; 
const QUIZ_BOARD_EL = document.getElementById('quiz-board');
const MODAL_EL = document.getElementById('question-modal');
const CLOSE_MODAL_BTN = document.getElementById('close-modal-btn');
const SHOW_ANSWER_BTN = document.getElementById('show-answer-btn');
const MODAL_ANSWER_EL = document.getElementById('modal-answer');

let quizData = []; 
let categories = []; 
let currentQuestion = null; 

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
        const N = values.length;

        // Mindestens 4 Spalten (Kategorie, Schwierigkeit, Frage, Lösung)
        if (N < 4) continue; 

        const question = {};
        
        // 1. Feste Spalten (Kategorie, Schwierigkeit, Frage)
        question.Kategorie = values[0];
        question.Schwierigkeit = values[1];
        question.Frage = values[2];
        
        // 2. Antwortmöglichkeiten (alles zwischen Frage und Lösung)
        // Beginnt bei Index 3 (nach Frage) und endet vor der letzten Spalte (Lösung)
        const optionsArray = values.slice(3, N - 1).filter(v => v !== '');
        
        // Optionen wieder mit Semikolon zusammenfügen, um sie später im Modal zu splitten
        question.Antwortmöglichkeiten = optionsArray.join(';'); 
        
        // 3. Lösung (die letzte Spalte)
        question.Lösung = values[N - 1];

        // Hinzufügen einer eindeutigen ID und des "gespielt"-Status
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
    
    // Setzt die Texte im Modal
    document.getElementById('modal-category').textContent = question.Kategorie;
    document.getElementById('modal-points').textContent = `${question.Schwierigkeit} Punkte`;
    document.getElementById('modal-question').textContent = question.Frage;
    MODAL_ANSWER_EL.textContent = question.Lösung; 
    
    // Antwortmöglichkeiten rendern
    const optionsList = document.getElementById('modal-options');
    optionsList.innerHTML = '';
    
    if (question.Antwortmöglichkeiten) {
        optionsList.style.display = 'block';
        // Splittet die zusammengeführten Optionen wieder auf
        const options = question.Antwortmöglichkeiten.split(';').filter(o => o.trim() !== '');
        options.forEach(option => {
            const li = document.createElement('li');
            li.textContent = option.trim();
            optionsList.appendChild(li);
        });
    } else {
        optionsList.style.display = 'none';
    }

    // FIX: Antwort verstecken beim Öffnen der Frage
    MODAL_ANSWER_EL.classList.add('hidden'); 
    SHOW_ANSWER_BTN.disabled = false;
    
    MODAL_EL.classList.remove('hidden');
}

/**
 * Zeigt die Lösung im Modal an.
 */
function showAnswer() {
    MODAL_ANSWER_EL.classList.remove('hidden'); 
    SHOW_ANSWER_BTN.disabled = true; 
}

/**
 * Schließt das Modal und markiert die Frage als gespielt.
 */
function closeQuestion() {
    if (currentQuestion) {
        // Frage als gespielt markieren
        const playedQuestionIndex = quizData.findIndex(q => q.id === currentQuestion.id);
        if (playedQuestionIndex !== -1) {
            quizData[playedQuestionIndex].played = true;
        }

        // Karte auf der Tafel ausgrauen
        const cardEl = document.getElementById(`card-${currentQuestion.id}`);
        if (cardEl) {
            cardEl.classList.add('played');
        }
    }

    MODAL_EL.classList.add('hidden');
    currentQuestion = null;
}

// --- Event Listener ---
SHOW_ANSWER_BTN.addEventListener('click', showAnswer);
CLOSE_MODAL_BTN.addEventListener('click', closeQuestion);

// --- Initialisierung ---
async function init() {
    quizData = await loadAndParseCSV();
    if (quizData.length > 0) {
        renderQuizBoard();
    }
}

init();