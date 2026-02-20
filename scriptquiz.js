// === CONFIGURACIÓN ===
const AIKEN_URL = "https://jorge21028.github.io/estudiantes/aiken/AIKENDDBD.txt";
const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyadEFiIn80HMR8eq1sdOhqwSkN7zLcoCqPJ-sMS9QJw-UQ1s0G7_Lr-3kZdfULzVl1/exec";

let config = {};
let allQuestions = [];
let selectedQuestions = [];
let currentIdx = 0;
let timerInterval;
let timeLeft;
let focusAlerts = 0;
let startTime;

// --- Funciones de Pantalla Completa ---
function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
}

function exitFullscreen() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
}

// --- Control de Seguridad ---
document.addEventListener("visibilitychange", () => {
    if (document.hidden) focusAlerts++;
});

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        focusAlerts++; // Registrar si intentan salir del modo pantalla completa
    }
});

// --- Lógica del Examen ---
async function init() {
    try {
        const response = await fetch(GOOGLE_API);
        config = await response.json();
    } catch (e) {
        console.error("Error cargando configuración:", e);
    }
}

async function startExam() {
    const name = document.getElementById('student-name').value;
    const pass = document.getElementById('test-pass').value;

    if (!name || pass !== config.password) {
        alert("Por favor, ingrese su nombre y la contraseña correcta.");
        return;
    }

    enterFullscreen();
    startTime = new Date();
    await loadAiken();
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('exam-screen').style.display = 'block';
    
    startTimer(config.tiempo);
    showQuestion();
}

async function loadAiken() {
    const res = await fetch(AIKEN_URL);
    const text = await res.text();
    // Separar por bloques de preguntas (doble salto de línea)
    const blocks = text.trim().split(/\n\s*\n/);
    
    allQuestions = blocks.map(block => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l !== "");
        const question = lines[0];
        
        // Buscar la línea que contiene la respuesta correcta
        const answerLineIndex = lines.findIndex(l => l.toUpperCase().startsWith('ANSWER:'));
        const answerLine = lines[answerLineIndex];
        const correctAnswer = answerLine.split(":")[1].trim();
        
        // Extraer opciones entre la pregunta y la respuesta
        const options = lines.slice(1, answerLineIndex).map(l => {
            // Esta regex separa la letra (A, B, C...) del texto de la opción
            const match = l.match(/^([A-Z])[\.\s\)]+(.*)$/);
            return {
                letter: match ? match[1] : "",
                text: match ? match[2].trim() : l // Si no hay match, toma la línea completa
            };
        });
        
        return { question, options, correctAnswer };
    });

    selectedQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, config.cantidad);
}

function showQuestion() {
    const q = selectedQuestions[currentIdx];
    document.getElementById('question-text').innerText = q.question;
    document.getElementById('progress-text').innerText = `Pregunta ${currentIdx + 1} de ${selectedQuestions.length}`;
    document.getElementById('progress-bar').style.width = `${((currentIdx + 1) / selectedQuestions.length) * 100}%`;

    const container = document.getElementById('options-container');
    container.innerHTML = "";
    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "option-btn";
        btn.innerText = `${opt.letter}) ${opt.text}`;
        btn.onclick = () => {
            document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            q.userAnswer = opt.letter;
        };
        container.appendChild(btn);
    });
}

function nextQuestion() {
    if (!selectedQuestions[currentIdx].userAnswer) {
        alert("Debe seleccionar una respuesta.");
        return;
    }

    if (currentIdx < selectedQuestions.length - 1) {
        currentIdx++;
        showQuestion();
    } else {
        finishExam();
    }
}

function startTimer(minutes) {
    timeLeft = minutes * 60;
    timerInterval = setInterval(() => {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        document.getElementById('timer').innerText = `Tiempo: ${m}:${s < 10 ? '0' : ''}${s}`;
        if (timeLeft <= 0) finishExam();
        timeLeft--;
    }, 1000);
}

async function finishExam() {
    clearInterval(timerInterval);
    exitFullscreen();

    const endTime = new Date();
    const duration = Math.floor((endTime - startTime) / 1000 / 60) + " min";
    
    let correctas = 0;
    selectedQuestions.forEach(q => {
        if (q.userAnswer === q.correctAnswer) correctas++;
    });

    const finalGrade = ((correctas / selectedQuestions.length) * 100).toFixed(2);
    
    const payload = {
        nombre: document.getElementById('student-name').value,
        nota: finalGrade,
        tiempoUsado: duration,
        alertasFoco: focusAlerts,
        respuestasCorrectas: correctas,
        totalPreguntas: selectedQuestions.length
    };

    document.getElementById('exam-screen').innerHTML = "<h3>Enviando resultados al sistema de Google Drive...</h3>";

    await fetch(GOOGLE_API, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
    });

    document.getElementById('exam-screen').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';
    document.getElementById('final-score').innerText = `${finalGrade} / 100`;
}

init();