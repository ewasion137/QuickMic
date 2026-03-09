const screens = {
    record: document.getElementById('record-screen'),
    editor: document.getElementById('editor-screen')
};

const btns = {
    main: document.getElementById('mainBtn'),
    cancel: document.getElementById('cancelBtn'),
    finish: document.getElementById('finishBtn'),
    export: document.getElementById('exportBtn'),
    back: document.getElementById('backBtn')
};

const statusText = document.getElementById('statusText');
const canvas = document.getElementById('liveWaveform');
const ctx = canvas.getContext('2d');

canvas.width = canvas.parentElement.clientWidth;
canvas.height = canvas.parentElement.clientHeight;

const PIXELS_PER_POINT = 2; 
const MAX_POINTS = Math.floor(canvas.width / PIXELS_PER_POINT);
let audioLevels =[]; 

let state = 'idle'; 
let ws = null; // Переменная для редактора Wavesurfer
let wsRegions = null; // Плагин выделения

function updateUI() {
    if (state === 'idle') {
        btns.main.className = 'btn-main';
        btns.cancel.classList.add('hidden');
        btns.finish.classList.add('hidden');
        statusText.innerText = 'Ready to record';
        statusText.className = 'status-text';
        audioLevels =[]; 
        drawWaveform();
    } else if (state === 'recording') {
        btns.main.className = 'btn-main recording';
        btns.cancel.classList.remove('hidden');
        btns.finish.classList.remove('hidden');
        statusText.innerText = 'Recording...';
        statusText.className = 'status-text recording';
    } else if (state === 'paused') {
        btns.main.className = 'btn-main paused';
        statusText.innerText = 'Paused';
        statusText.className = 'status-text';
    }
}

// Запись
btns.main.addEventListener('click', () => {
    if (state === 'idle') {
        state = 'recording';
        window.chrome.webview.postMessage('start_rec');
    } else if (state === 'recording') {
        state = 'paused';
        window.chrome.webview.postMessage('pause_rec');
    } else if (state === 'paused') {
        state = 'recording';
        window.chrome.webview.postMessage('resume_rec');
    }
    updateUI();
});

btns.cancel.addEventListener('click', () => {
    state = 'idle';
    window.chrome.webview.postMessage('cancel_rec');
    updateUI();
});

btns.finish.addEventListener('click', () => {
    state = 'idle';
    window.chrome.webview.postMessage('finish_rec');
    statusText.innerText = 'Processing...';
});

// Кнопка DISCARD в редакторе (возврат назад)
btns.back.addEventListener('click', () => {
    if (ws) ws.destroy(); // Убиваем старый плеер
    screens.editor.classList.remove('active');
    screens.record.classList.add('active');
    updateUI();
});

function drawWaveform() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerY = canvas.height / 2;

    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (audioLevels.length === 0) return;

    ctx.fillStyle = (state === 'recording') ? '#1de9b6' : '#555555'; 
    ctx.beginPath();
    
    for (let i = 0; i < audioLevels.length; i++) {
        const x = i * PIXELS_PER_POINT;
        const h = Math.max(2, audioLevels[i] * canvas.height * 0.9);
        ctx.lineTo(x, centerY - h / 2);
    }
    
    for (let i = audioLevels.length - 1; i >= 0; i--) {
        const x = i * PIXELS_PER_POINT;
        const h = Math.max(2, audioLevels[i] * canvas.height * 0.9);
        ctx.lineTo(x, centerY + h / 2);
    }
    ctx.fill(); 

    const cursorX = (audioLevels.length - 1) * PIXELS_PER_POINT;
    const cursorHeight = 45; 

    ctx.beginPath();
    ctx.moveTo(cursorX, centerY - cursorHeight);
    ctx.lineTo(cursorX, centerY + cursorHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cursorX, centerY - cursorHeight, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cursorX, centerY + cursorHeight, 4, 0, Math.PI * 2); ctx.fill();
}

window.chrome.webview.addEventListener('message', event => {
    const data = event.data;
    
    if (data.type === 'volume' && state === 'recording') {
        audioLevels.push(data.value);
        if (audioLevels.length > MAX_POINTS) {
            audioLevels.shift(); 
        }
        drawWaveform();
    } 
    else if (data.type === 'ready_to_cut') {
        screens.record.classList.remove('active');
        screens.editor.classList.add('active');
        document.getElementById('filePathText').innerText = "Source: Temp File";

        // Теперь C# присылает нам готовый http://temp.local/quickmic_temp.wav
        // Ошибки CORS больше не будет!
        initEditor(data.file);
    }
});

// Не забудь, что внизу еще должны остаться функция initEditor() и вызов drawWaveform(), 
// их не трогаем!

let activeRegion = null; // Храним тут зеленое выделение

function initEditor(audioUrl) {
    if (ws) ws.destroy(); 

    ws = WaveSurfer.create({
        container: '#editor-waveform',
        waveColor: '#1de9b6',
        progressColor: '#00bfa5',
        cursorColor: '#ffffff',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 100,
        normalize: true
    });

    wsRegions = ws.registerPlugin(WaveSurfer.Regions.create());
    ws.load(audioUrl);

    ws.on('ready', () => {
        // Создаем регион и сохраняем его в переменную
        activeRegion = wsRegions.addRegion({
            start: 0,
            end: ws.getDuration(),
            color: 'rgba(29, 233, 182, 0.2)',
            drag: false,
            resize: true
        });
    });

    // МЕНЯЕМ ИКОНКУ PLAY/PAUSE при воспроизведении
    const playPauseBtn = document.getElementById('playPauseBtn');
    ws.on('play', () => playPauseBtn.innerText = '⏸');
    ws.on('pause', () => playPauseBtn.innerText = '▶');
}

// === УПРАВЛЕНИЕ РЕДАКТОРОМ === //

const playPauseBtn = document.getElementById('playPauseBtn');
const cutLeftBtn = document.getElementById('cutLeftBtn');
const cutRightBtn = document.getElementById('cutRightBtn');

// Логика обрезки (двигаем края зеленой зоны к курсору)
function applyCut(direction) {
    if (!ws || !activeRegion) return;
    const currentTime = ws.getCurrentTime(); // Где сейчас стоит белая палка
    
    if (direction === 'left') {
        // Отрезать всё слева = сдвинуть НАЧАЛО региона к курсору
        if (currentTime < activeRegion.end) {
            activeRegion.setOptions({ start: currentTime });
        }
    } else if (direction === 'right') {
        // Отрезать всё справа = сдвинуть КОНЕЦ региона к курсору
        if (currentTime > activeRegion.start) {
            activeRegion.setOptions({ end: currentTime });
        }
    }
}

// Клики по кнопкам интерфейса
playPauseBtn.addEventListener('click', () => ws && ws.playPause());
cutLeftBtn.addEventListener('click', () => applyCut('left'));
cutRightBtn.addEventListener('click', () => applyCut('right'));

// ГЛОБАЛЬНЫЕ ХОТКЕИ (Пробел, C, V)
document.addEventListener('keydown', (e) => {
    // Реагируем на кнопки ТОЛЬКО если мы на экране редактора
    if (screens.editor.classList.contains('active')) {
        if (e.code === 'Space') {
            e.preventDefault(); // Чтобы страница не скроллилась от пробела
            if (ws) ws.playPause();
        } else if (e.code === 'KeyC') {
            applyCut('left');
        } else if (e.code === 'KeyV') {
            applyCut('right');
        }
    }
});

drawWaveform();