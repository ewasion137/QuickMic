const screens = {
    record: document.getElementById('record-screen'),
    editor: document.getElementById('editor-screen')
};

const btns = {
    main: document.getElementById('mainBtn'),
    cancel: document.getElementById('cancelBtn'),
    finish: document.getElementById('finishBtn')
};

const statusText = document.getElementById('statusText');
const canvas = document.getElementById('liveWaveform');
const ctx = canvas.getContext('2d');

// Настройка холста
canvas.width = canvas.parentElement.clientWidth;
canvas.height = canvas.parentElement.clientHeight;

// Настройка скорости и плотности волны
const PIXELS_PER_POINT = 2; // Ширина одного замера в пикселях (влияет на скорость движения)
const MAX_POINTS = Math.floor(canvas.width / PIXELS_PER_POINT);
let audioLevels =[]; // Теперь массив растет с нуля

let state = 'idle'; // 'idle', 'recording', 'paused'

function updateUI() {
    if (state === 'idle') {
        btns.main.className = 'btn-main';
        btns.cancel.classList.add('hidden');
        btns.finish.classList.add('hidden');
        statusText.innerText = 'Готов к записи';
        statusText.className = 'status-text';
        audioLevels =[]; // Очищаем волну
        drawWaveform();
    } else if (state === 'recording') {
        btns.main.className = 'btn-main recording';
        btns.cancel.classList.remove('hidden');
        btns.finish.classList.remove('hidden');
        statusText.innerText = 'Запись...';
        statusText.className = 'status-text recording';
    } else if (state === 'paused') {
        btns.main.className = 'btn-main paused';
        statusText.innerText = 'Пауза';
        statusText.className = 'status-text';
    }
}

// Управление кликами
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
    statusText.innerText = 'Обработка...';
});

// ТОТ САМЫЙ РЕНДЕР ИЗ ТВОЕГО СКРИНА
function drawWaveform() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerY = canvas.height / 2;

    // 1. Рисуем тусклую центральную линию
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (audioLevels.length === 0) return;

    // 2. Рисуем саму сплошную волну
    ctx.fillStyle = (state === 'recording') ? '#1de9b6' : '#555555'; // Неоново-зеленый (или серый на паузе)
    ctx.beginPath();
    
    // Верхняя половина (идем слева направо)
    for (let i = 0; i < audioLevels.length; i++) {
        const x = i * PIXELS_PER_POINT;
        const h = Math.max(2, audioLevels[i] * canvas.height * 0.9);
        ctx.lineTo(x, centerY - h / 2);
    }
    
    // Нижняя половина (идем справа налево, чтобы замкнуть фигуру)
    for (let i = audioLevels.length - 1; i >= 0; i--) {
        const x = i * PIXELS_PER_POINT;
        const h = Math.max(2, audioLevels[i] * canvas.height * 0.9);
        ctx.lineTo(x, centerY + h / 2);
    }
    
    ctx.fill(); // Заливаем цветом

    // 3. Рисуем курсор (Playhead) в конце волны
    const cursorX = (audioLevels.length - 1) * PIXELS_PER_POINT;
    const cursorHeight = 45; // Высота палки курсора

    ctx.beginPath();
    ctx.moveTo(cursorX, centerY - cursorHeight);
    ctx.lineTo(cursorX, centerY + cursorHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Кружочки на концах курсора
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cursorX, centerY - cursorHeight, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cursorX, centerY + cursorHeight, 4, 0, Math.PI * 2); ctx.fill();
}

// Прием громкости из C#
window.chrome.webview.addEventListener('message', event => {
    const data = event.data;
    
    if (data.type === 'volume' && state === 'recording') {
        audioLevels.push(data.value);
        // Если дошли до края экрана - сдвигаем волну влево
        if (audioLevels.length > MAX_POINTS) {
            audioLevels.shift(); 
        }
        drawWaveform();
    } 
    else if (data.type === 'ready_to_cut') {
        screens.record.classList.remove('active');
        screens.editor.classList.add('active');
        document.getElementById('filePathText').innerText = "Временный файл: " + data.file;
    }
});

drawWaveform();