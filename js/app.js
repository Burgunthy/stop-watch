// 앱 상태 관리
const state = {
    // 스톱워치 상태
    stopwatch: {
        isRunning: false,
        startTime: 0,
        elapsedTime: 0,
        lapTimes: [],
        animationId: null
    },
    // 타이머 상태
    timer: {
        isRunning: false,
        isPaused: false,
        totalDuration: 0,
        remainingTime: 0,
        endTime: 0,
        animationId: null
    },
    // 현재 탭
    currentTab: 'stopwatch',
    // 테마
    theme: localStorage.getItem('theme') || 'light'
};

// DOM 요소 참조
const elements = {
    // 테마
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.querySelector('.theme-icon'),
    // 탭
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    // 스톱워치
    swStart: document.getElementById('swStart'),
    swLap: document.getElementById('swLap'),
    swReset: document.getElementById('swReset'),
    stopwatchTime: document.getElementById('stopwatchTime'),
    lapList: document.getElementById('lapList'),
    // 타이머
    tmStart: document.getElementById('tmStart'),
    tmPause: document.getElementById('tmPause'),
    tmReset: document.getElementById('tmReset'),
    timerHours: document.getElementById('timerHours'),
    timerMinutes: document.getElementById('timerMinutes'),
    timerSeconds: document.getElementById('timerSeconds'),
    timerTime: document.getElementById('timerTime'),
    timerSetup: document.getElementById('timerSetup'),
    timerDisplay: document.getElementById('timerDisplay'),
    progressBar: document.getElementById('progressBar'),
    // 기록
    recordsList: document.getElementById('recordsList'),
    clearRecords: document.getElementById('clearRecords')
};

// ============ 유틸리티 함수 ============

// 시간 포맷팅 (시:분:초.밀리초)
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
}

// 타이머 시간 포맷팅 (시:분:초)
function formatTimerTime(ms) {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// 기록 저장
function saveRecord(type, data) {
    const records = JSON.parse(localStorage.getItem('timeRecords') || '[]');
    const record = {
        id: Date.now(),
        type,
        date: new Date().toLocaleString('ko-KR'),
        ...data
    };
    records.unshift(record);
    localStorage.setItem('timeRecords', JSON.stringify(records.slice(0, 100))); // 최대 100개
}

// 기록 불러오기
function loadRecords() {
    return JSON.parse(localStorage.getItem('timeRecords') || '[]');
}

// ============ 테마 관리 ============

function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    elements.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    setTheme(state.theme === 'light' ? 'dark' : 'light');
}

// ============ 탭 전환 ============

function switchTab(tabName) {
    state.currentTab = tabName;

    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabName);
    });

    if (tabName === 'records') {
        renderRecords();
    }
}

// ============ 스톱워치 기능 ============

function updateStopwatch() {
    const currentTime = Date.now();
    state.stopwatch.elapsedTime = currentTime - state.stopwatch.startTime;

    elements.stopwatchTime.textContent = formatTime(state.stopwatch.elapsedTime);

    if (state.stopwatch.isRunning) {
        state.stopwatch.animationId = requestAnimationFrame(updateStopwatch);
    }
}

function startStopwatch() {
    if (state.stopwatch.isRunning) {
        // 일시정지
        state.stopwatch.isRunning = false;
        state.stopwatch.elapsedTime = Date.now() - state.stopwatch.startTime;
        cancelAnimationFrame(state.stopwatch.animationId);
        elements.swStart.textContent = '시작';
        elements.swLap.disabled = true;
    } else {
        // 시작
        state.stopwatch.isRunning = true;
        state.stopwatch.startTime = Date.now() - state.stopwatch.elapsedTime;
        elements.swStart.textContent = '일시정지';
        elements.swLap.disabled = false;
        updateStopwatch();
    }
}

function resetStopwatch() {
    if (state.stopwatch.elapsedTime > 0) {
        // 기록 저장
        saveRecord('stopwatch', {
            totalTime: formatTime(state.stopwatch.elapsedTime),
            laps: state.stopwatch.lapTimes.map(lap => ({
                number: lap.number,
                time: formatTime(lap.total),
                split: formatTime(lap.split)
            }))
        });
    }

    state.stopwatch.isRunning = false;
    state.stopwatch.startTime = 0;
    state.stopwatch.elapsedTime = 0;
    state.stopwatch.lapTimes = [];
    cancelAnimationFrame(state.stopwatch.animationId);

    elements.stopwatchTime.textContent = '00:00:00.00';
    elements.swStart.textContent = '시작';
    elements.swLap.disabled = true;
    renderLapTimes();
}

function recordLap() {
    const currentTotal = Date.now() - state.stopwatch.startTime;
    const prevTotal = state.stopwatch.lapTimes.length > 0
        ? state.stopwatch.lapTimes[state.stopwatch.lapTimes.length - 1].total
        : 0;

    const lap = {
        number: state.stopwatch.lapTimes.length + 1,
        total: currentTotal,
        split: currentTotal - prevTotal
    };

    state.stopwatch.lapTimes.push(lap);
    renderLapTimes();
}

function renderLapTimes() {
    if (state.stopwatch.lapTimes.length === 0) {
        elements.lapList.innerHTML = '<p class="empty-message">랩타임이 없습니다</p>';
        return;
    }

    elements.lapList.innerHTML = state.stopwatch.lapTimes
        .slice()
        .reverse()
        .map(lap => `
            <div class="lap-item">
                <span class="lap-number">#${lap.number}</span>
                <span class="lap-split">+${formatTime(lap.split)}</span>
                <span class="lap-total">${formatTime(lap.total)}</span>
            </div>
        `).join('');
}

// ============ 타이머 기능 ============

function updateTimer() {
    const now = Date.now();
    const remaining = Math.max(0, state.timer.endTime - now);
    state.timer.remainingTime = remaining;

    elements.timerTime.textContent = formatTimerTime(remaining);

    // 프로그레스 바 업데이트
    const progress = (remaining / state.timer.totalDuration) * 100;
    elements.progressBar.style.setProperty('--progress', `${progress}%`);
    elements.progressBar.style.transform = `scaleX(${progress / 100})`;

    if (remaining > 0 && state.timer.isRunning) {
        state.timer.animationId = requestAnimationFrame(updateTimer);
    } else if (remaining <= 0) {
        timerComplete();
    }
}

function timerComplete() {
    state.timer.isRunning = false;
    cancelAnimationFrame(state.timer.animationId);

    // 시각적 알림
    document.body.classList.add('timer-complete');
    setTimeout(() => document.body.classList.remove('timer-complete'), 1500);

    // 기록 저장
    saveRecord('timer', {
        duration: formatTimerTime(state.timer.totalDuration),
        completedAt: new Date().toLocaleString('ko-KR')
    });

    // 버튼 상태 업데이트
    elements.tmStart.textContent = '시작';
    elements.tmPause.disabled = true;
    elements.tmStart.disabled = false;

    // 설정 화면 표시
    elements.timerSetup.style.display = 'block';
}

function startTimer() {
    if (state.timer.isRunning) return;

    if (!state.timer.isPaused) {
        // 새로운 타이머 시작
        const hours = parseInt(elements.timerHours.value) || 0;
        const minutes = parseInt(elements.timerMinutes.value) || 0;
        const seconds = parseInt(elements.timerSeconds.value) || 0;

        state.timer.totalDuration = (hours * 3600 + minutes * 60 + seconds) * 1000;

        if (state.timer.totalDuration === 0) return;

        elements.timerSetup.style.display = 'none';
    }

    state.timer.isRunning = true;
    state.timer.isPaused = false;
    state.timer.endTime = Date.now() + state.timer.remainingTime;

    elements.tmStart.disabled = true;
    elements.tmPause.disabled = false;

    updateTimer();
}

function pauseTimer() {
    if (!state.timer.isRunning) return;

    state.timer.isRunning = false;
    state.timer.isPaused = true;
    state.timer.remainingTime = state.timer.endTime - Date.now();

    cancelAnimationFrame(state.timer.animationId);

    elements.tmStart.disabled = false;
    elements.tmStart.textContent = '재개';
    elements.tmPause.disabled = true;
}

function resetTimer() {
    state.timer.isRunning = false;
    state.timer.isPaused = false;
    state.timer.remainingTime = 0;
    state.timer.totalDuration = 0;

    cancelAnimationFrame(state.timer.animationId);

    const hours = parseInt(elements.timerHours.value) || 0;
    const minutes = parseInt(elements.timerMinutes.value) || 0;
    const seconds = parseInt(elements.timerSeconds.value) || 0;

    elements.timerTime.textContent = formatTimerTime((hours * 3600 + minutes * 60 + seconds) * 1000);
    elements.progressBar.style.transform = 'scaleX(1)';

    elements.tmStart.textContent = '시작';
    elements.tmStart.disabled = false;
    elements.tmPause.disabled = true;
    elements.timerSetup.style.display = 'block';
}

// 타이머 입력 변경 시 표시 업데이트
function updateTimerDisplay() {
    const hours = parseInt(elements.timerHours.value) || 0;
    const minutes = parseInt(elements.timerMinutes.value) || 0;
    const seconds = parseInt(elements.timerSeconds.value) || 0;

    if (!state.timer.isRunning && !state.timer.isPaused) {
        elements.timerTime.textContent = formatTimerTime((hours * 3600 + minutes * 60 + seconds) * 1000);
    }
}

// ============ 기록 관리 ============

function renderRecords() {
    const records = loadRecords();

    if (records.length === 0) {
        elements.recordsList.innerHTML = '<p class="empty-message">저장된 기록이 없습니다</p>';
        return;
    }

    elements.recordsList.innerHTML = records.map(record => {
        let content = `
            <div class="record-item">
                <div class="record-header">
                    <span class="record-type">${record.type === 'stopwatch' ? '⏱️ 스톱워치' : '⏳ 타이머'}</span>
                    <span class="record-date">${record.date}</span>
                </div>
                <div class="record-time">${record.totalTime || record.duration}</div>
        `;

        if (record.laps && record.laps.length > 0) {
            content += `<div class="record-laps">
                ${record.laps.map(lap => `
                    <div class="record-lap">
                        <span>#${lap.number}</span>
                        <span>${lap.time}</span>
                    </div>
                `).join('')}
            </div>`;
        }

        content += '</div>';
        return content;
    }).join('');
}

function clearRecords() {
    if (confirm('모든 기록을 삭제하시겠습니까?')) {
        localStorage.removeItem('timeRecords');
        renderRecords();
    }
}

// ============ 이벤트 리스너 등록 ============

function init() {
    // 테마 초기화
    setTheme(state.theme);
    elements.themeToggle.addEventListener('click', toggleTheme);

    // 탭 전환
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 스톱워치 이벤트
    elements.swStart.addEventListener('click', startStopwatch);
    elements.swReset.addEventListener('click', resetStopwatch);
    elements.swLap.addEventListener('click', recordLap);

    // 타이머 이벤트
    elements.tmStart.addEventListener('click', startTimer);
    elements.tmPause.addEventListener('click', pauseTimer);
    elements.tmReset.addEventListener('click', resetTimer);

    // 타이머 입력
    [elements.timerHours, elements.timerMinutes, elements.timerSeconds].forEach(input => {
        input.addEventListener('input', updateTimerDisplay);
        input.addEventListener('change', updateTimerDisplay);
    });

    // 기록 관리
    elements.clearRecords.addEventListener('click', clearRecords);

    // 초기 타이머 표시
    updateTimerDisplay();

    // 진행 바 초기화
    elements.progressBar.style.transformOrigin = 'left';
    elements.progressBar.style.transition = 'transform 0.3s linear';
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', init);
