// ─── State ─────────────────────────────────────────────────────────────────
let projects = [];
let currentProject = null;
let timerInterval = null;
let startTime = null;
let elapsedTime = 0;
let isRunning = false;
let barChartInstance = null;
let currentPeriod = 'daily';
let currentProjectForReports = null;
let currentProjectForDetails = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────
const projectNameInput = document.getElementById('projectName');
const addProjectBtn = document.getElementById('addProjectBtn');
const projectsList = document.getElementById('projectsList');
const timerDisplay = document.getElementById('timerDisplay');
const focusBtn = document.getElementById('focusBtn');
const stopBtn = document.getElementById('stopBtn');
const detailsBtn = document.getElementById('detailsBtn');
const reportsBtn = document.getElementById('reportsBtn');
const deleteBtn = document.getElementById('deleteBtn');
const timerStats = document.getElementById('timerStats');
const projectStartDate = document.getElementById('projectStartDate');
const projectToday = document.getElementById('projectToday');
const projectAvg = document.getElementById('projectAvg');
const projectTotal = document.getElementById('projectTotal');
const detailsModal = document.getElementById('detailsModal');
const closeDetailsBtn = document.getElementById('closeDetails');
const detailsWrapper = document.getElementById('detailsWrapper');
const detailsTableBody = document.getElementById('detailsTableBody');
const detailsEmptyState = document.getElementById('detailsEmptyState');

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatHoursMinutesFromSeconds(seconds) {
    if (!seconds || seconds <= 0) return '0h 0m';
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

function formatEntryDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function generateEntryId() {
    return `entry_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function getLogEntries() {
    let log = JSON.parse(localStorage.getItem('timeTrackerLog') || '[]');
    let needsSave = false;
    log = log.map(entry => {
        if (!entry.id) {
            entry.id = generateEntryId();
            needsSave = true;
        }
        return entry;
    });
    if (needsSave) localStorage.setItem('timeTrackerLog', JSON.stringify(log));
    return log;
}

// ─── Data load/save ───────────────────────────────────────────────────────
function loadData() {
    const saved = localStorage.getItem('timeTrackerProjects');
    if (saved) {
        projects = JSON.parse(saved).map(p => {
            // Remove any archived field if present from old data
            const { archived, ...cleanProject } = p;
            return cleanProject;
        });
    }
    renderProjects();
    updateGlobalActionButtons();
    updateTimerUI();
}

function saveData() {
    localStorage.setItem('timeTrackerProjects', JSON.stringify(projects));
}

// ─── Projects CRUD ─────────────────────────────────────────────────────────
function addProject() {
    const name = projectNameInput.value.trim();
    if (!name) {
        alert('Please enter a project name');
        return;
    }
    if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        alert('Project already exists');
        return;
    }
    projects.push({
        id: Date.now(),
        name,
        totalTime: 0,
        startDate: new Date().toISOString().split('T')[0]
    });
    projectNameInput.value = '';
    saveData();
    renderProjects();
    updateGlobalActionButtons();
}

function selectProject(project) {
    if (isRunning) {
        alert('Please stop the current timer before selecting a different project');
        return;
    }
    currentProject = project;
    elapsedTime = 0;
    renderProjects();
    updateTimerUI();
    updateGlobalActionButtons();
}

function deleteProject() {
    if (!currentProject) return;
    if (!confirm(`Are you sure you want to delete "${currentProject.name}"?`)) return;
    projects = projects.filter(p => p.id !== currentProject.id);
    stopTimer();
    currentProject = null;
    saveData();
    renderProjects();
    updateTimerUI();
    updateGlobalActionButtons();
}

// ─── Render projects list ─────────────────────────────────────────────────
function renderProjects() {
    projectsList.innerHTML = '';
    if (projects.length === 0) {
        projectsList.innerHTML = '<p class="empty-log">No projects yet. Add one to get started!</p>';
        focusBtn.disabled = true;
        updateGlobalActionButtons();
        return;
    }
    projects.forEach(project => {
        const el = document.createElement('div');
        el.className = `project-item ${currentProject && currentProject.id === project.id ? 'active' : ''}`;
        el.onclick = () => selectProject(project);
        el.innerHTML = `<div class="project-info"><span class="project-name">${escapeHtml(project.name)}</span></div>`;
        projectsList.appendChild(el);
    });
    focusBtn.disabled = !currentProject;
    updateGlobalActionButtons();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ─── Action buttons state ─────────────────────────────────────────────────
function updateGlobalActionButtons() {
    const hasActive = !!currentProject;
    detailsBtn.disabled = !hasActive;
    reportsBtn.disabled = !hasActive;
    deleteBtn.disabled = !hasActive;
}

// ─── Timer ─────────────────────────────────────────────────────────────────
function startTimer() {
    if (!currentProject) {
        alert('Please select a project first');
        return;
    }
    if (isRunning) return;
    isRunning = true;
    startTime = Date.now() - elapsedTime * 1000;
    timerInterval = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        updateTimerDisplay();
    }, 1000);
    focusBtn.textContent = 'Focusing...';
    focusBtn.classList.add('active');
    focusBtn.setAttribute('aria-pressed', 'true');
    focusBtn.disabled = true;
    stopBtn.disabled = false;
    updateTimerUI();
}

function stopTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    if (currentProject && elapsedTime > 0) {
        currentProject.totalTime += elapsedTime;
        saveData();
        addToTimeLog(currentProject.name, elapsedTime);
        elapsedTime = 0;
    }
    focusBtn.textContent = 'Start Focus';
    focusBtn.classList.remove('active');
    focusBtn.setAttribute('aria-pressed', 'false');
    focusBtn.disabled = !currentProject;
    stopBtn.disabled = true;
    updateTimerDisplay();
    updateTimerUI();
    renderProjects();
    updateGlobalActionButtons();
}

function updateTimerDisplay() {
    if (timerDisplay) timerDisplay.textContent = formatTime(elapsedTime);
}

function updateTimerUI() {
    if (timerStats) timerStats.style.display = 'block';
    updateTimerStats();
    updateTimerDisplay();
}

function updateTimerStats() {
    const placeholders = { start: 'N/A', time: '0h 0m', total: '0h 0m' };
    if (!currentProject) {
        if (projectStartDate) projectStartDate.textContent = placeholders.start;
        if (projectToday) projectToday.textContent = placeholders.time;
        if (projectAvg) projectAvg.textContent = placeholders.time;
        if (projectTotal) projectTotal.textContent = placeholders.total;
        return;
    }
    if (projectStartDate) {
        projectStartDate.textContent = currentProject.startDate ? formatEntryDate(currentProject.startDate) : placeholders.start;
    }
    if (projectTotal) projectTotal.textContent = formatHoursMinutesFromSeconds(currentProject.totalTime);
    const logEntries = getLogEntries();
    const todayIso = new Date().toISOString().split('T')[0];
    const todayEntries = logEntries.filter(e => e.project === currentProject.name && e.date === todayIso);
    const todaySeconds = todayEntries.reduce((s, e) => s + e.duration, 0);
    if (projectToday) projectToday.textContent = formatHoursMinutesFromSeconds(todaySeconds);
    const byDate = {};
    logEntries.forEach(e => {
        if (e.project !== currentProject.name) return;
        byDate[e.date] = (byDate[e.date] || 0) + e.duration;
    });
    const workingDaysCount = Object.keys(byDate).length;
    const avgSeconds = workingDaysCount > 0 ? currentProject.totalTime / workingDaysCount : 0;
    if (projectAvg) projectAvg.textContent = formatHoursMinutesFromSeconds(avgSeconds);
}


// ─── Time log ─────────────────────────────────────────────────────────────
function addToTimeLog(projectName, duration) {
    const today = new Date().toISOString().split('T')[0];
    let log = getLogEntries();
    log.push({
        id: generateEntryId(),
        date: today,
        project: projectName,
        duration,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    log = log.filter(e => new Date(e.date) >= cutoff);
    localStorage.setItem('timeTrackerLog', JSON.stringify(log));
}

// ─── Charts ──────────────────────────────────────────────────────────────
function getProjectData(projectId, period) {
    const log = JSON.parse(localStorage.getItem('timeTrackerLog') || '[]');
    const project = projects.find(p => p.id === projectId);
    if (!project) return { labels: [], data: [] };
    const entries = log.filter(e => e.project === project.name);
    const aggregated = {};
    const getWeekStart = (d) => {
        const w = new Date(d);
        w.setHours(0, 0, 0, 0);
        w.setDate(w.getDate() - w.getDay());
        return w;
    };
    const getMonthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
    entries.forEach(entry => {
        const d = new Date(entry.date + 'T00:00:00');
        let key;
        if (period === 'daily') key = d.toISOString().split('T')[0];
        else if (period === 'weekly') key = getWeekStart(d).toISOString();
        else key = `${d.getFullYear()}-${d.getMonth()}`;
        aggregated[key] = (aggregated[key] || 0) + entry.duration;
    });
    const periods = [];
    if (period === 'daily') {
        for (let i = 9; i >= 0; i--) {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - i);
            periods.push({ key: d.toISOString().split('T')[0], label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
        }
    } else if (period === 'weekly') {
        const weekStart = getWeekStart(new Date());
        for (let i = 9; i >= 0; i--) {
            const w = new Date(weekStart);
            w.setDate(w.getDate() - 7 * i);
            periods.push({ key: w.toISOString(), label: `Week of ${w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` });
        }
    } else {
        const monthStart = getMonthStart(new Date());
        for (let i = 9; i >= 0; i--) {
            const m = new Date(monthStart);
            m.setMonth(m.getMonth() - i);
            periods.push({ key: `${m.getFullYear()}-${m.getMonth()}`, label: m.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) });
        }
    }
    return {
        labels: periods.map(p => p.label),
        data: periods.map(p => aggregated[p.key] || 0)
    };
}

function updateCharts(projectId, period) {
    const { labels, data } = getProjectData(projectId, period);
    let barContainer = document.getElementById('barChart');
    if (!barContainer) {
        const section = document.querySelector('.chart-section');
        if (section) {
            section.innerHTML = '<h3>Time Spent</h3><canvas id="barChart"></canvas>';
            barContainer = document.getElementById('barChart');
        }
    }
    if (!labels.length) {
        if (barChartInstance) {
            barChartInstance.destroy();
            barChartInstance = null;
        }
        if (barContainer && barContainer.parentElement) {
            barContainer.parentElement.innerHTML = '<h3>Time Spent</h3><p class="empty-log">No data for this period</p>';
        }
        return;
    }
    if (barChartInstance) barChartInstance.destroy();
    const dataInHours = data.map(s => s / 3600);
    const ctx = document.getElementById('barChart');
    if (!ctx) return;
    barChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                type: 'bar',
                label: 'Time Spent (hours)',
                data: dataInHours,
                backgroundColor: 'rgba(102, 126, 234, 0.7)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Time (hours)' },
                    ticks: { callback: v => v + 'h' }
                },
                x: { title: { display: true, text: period === 'daily' ? 'Day' : period === 'weekly' ? 'Week' : 'Month' } }
            },
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const h = parseFloat(ctx.parsed.y);
                            if (Number.isNaN(h)) return '';
                            const m = Math.round((h % 1) * 60);
                            return `${ctx.dataset.label}: ${Math.floor(h)}h ${m}m`;
                        }
                    }
                }
            }
        }
    });
}

// ─── Reports modal ─────────────────────────────────────────────────────────
function viewReports() {
    if (!currentProject) return;
    currentProjectForReports = currentProject;
    currentPeriod = 'daily';
    const modal = document.getElementById('reportsModal');
    const title = document.getElementById('modalProjectName');
    if (title) title.textContent = `${currentProject.name} – Reports`;
    if (modal) {
        modal.style.display = 'block';
        modal.setAttribute('aria-hidden', 'false');
    }
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === 'daily');
        btn.setAttribute('aria-selected', btn.dataset.period === 'daily');
    });
    const section = document.querySelector('.chart-section');
    if (section && !section.querySelector('canvas')) {
        section.innerHTML = '<h3>Time Spent</h3><canvas id="barChart"></canvas>';
    }
    updateCharts(currentProject.id, 'daily');
}

function closeModal() {
    const modal = document.getElementById('reportsModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }
}

function switchPeriod(period) {
    if (!currentProjectForReports) return;
    currentPeriod = period;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
        btn.setAttribute('aria-selected', btn.dataset.period === period);
    });
    updateCharts(currentProjectForReports.id, period);
}

// ─── Details modal ─────────────────────────────────────────────────────────
function renderDetailsTable(log) {
    if (!detailsTableBody || !detailsWrapper || !detailsEmptyState) return;
    detailsTableBody.innerHTML = '';
    if (!Array.isArray(log) || log.length === 0) {
        detailsWrapper.classList.add('empty');
        return;
    }
    detailsWrapper.classList.remove('empty');
    const sorted = [...log].sort((a, b) => {
        const c = b.date.localeCompare(a.date);
        return c !== 0 ? c : (b.time || '').localeCompare(a.time || '');
    });
    sorted.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(formatEntryDate(entry.date))}</td>
            <td>${escapeHtml(entry.time || 'N/A')}</td>
            <td>${escapeHtml(entry.project)}</td>
            <td>${formatTime(entry.duration)}</td>
            <td><button type="button" class="btn-delete-entry" data-entry-id="${escapeHtml(entry.id)}">Delete</button></td>
        `;
        row.querySelector('.btn-delete-entry').addEventListener('click', () => deleteLogEntry(entry.id));
        detailsTableBody.appendChild(row);
    });
}

function openDetailsModalForProject() {
    if (!detailsModal || !currentProject) return;
    currentProjectForDetails = currentProject;
    const log = getLogEntries().filter(e => e.project === currentProject.name);
    renderDetailsTable(log);
    const h2 = detailsModal.querySelector('.modal-header h2');
    if (h2) h2.textContent = `Detailed Focus Entries – ${currentProject.name}`;
    detailsModal.style.display = 'block';
    detailsModal.setAttribute('aria-hidden', 'false');
}

function closeDetailsModal() {
    if (detailsModal) {
        detailsModal.style.display = 'none';
        detailsModal.setAttribute('aria-hidden', 'true');
    }
}

function deleteLogEntry(entryId) {
    if (!entryId) return;
    let log = getLogEntries();
    const idx = log.findIndex(e => e.id === entryId);
    if (idx === -1) return;
    const removed = log.splice(idx, 1)[0];
    localStorage.setItem('timeTrackerLog', JSON.stringify(log));
    if (removed) {
        const project = projects.find(p => p.name.toLowerCase() === removed.project.toLowerCase());
        if (project) project.totalTime = Math.max(0, project.totalTime - removed.duration);
    }
    saveData();
    renderProjects();
    updateTimerUI();
    if (currentProjectForDetails) {
        renderDetailsTable(log.filter(e => e.project === currentProjectForDetails.name));
    } else {
        renderDetailsTable(log);
    }
}

// ─── Event listeners ───────────────────────────────────────────────────────
if (addProjectBtn) addProjectBtn.addEventListener('click', addProject);
if (projectNameInput) {
    projectNameInput.addEventListener('keypress', e => { if (e.key === 'Enter') addProject(); });
}
if (focusBtn) focusBtn.addEventListener('click', startTimer);
if (stopBtn) stopBtn.addEventListener('click', stopTimer);
if (detailsBtn) detailsBtn.addEventListener('click', openDetailsModalForProject);
if (reportsBtn) reportsBtn.addEventListener('click', viewReports);
if (deleteBtn) deleteBtn.addEventListener('click', deleteProject);

const closeModalBtn = document.getElementById('closeModal');
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
const reportsModal = document.getElementById('reportsModal');
if (reportsModal) {
    reportsModal.addEventListener('click', e => { if (e.target === reportsModal) closeModal(); });
}
if (closeDetailsBtn) closeDetailsBtn.addEventListener('click', closeDetailsModal);
if (detailsModal) {
    detailsModal.addEventListener('click', e => { if (e.target === detailsModal) closeDetailsModal(); });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPeriod(btn.dataset.period));
});

// ─── Init & persistence ───────────────────────────────────────────────────
loadData();

window.addEventListener('beforeunload', () => {
    if (isRunning && currentProject) {
        localStorage.setItem('timeTrackerTimerState', JSON.stringify({
            projectId: currentProject.id,
            startTime,
            elapsedTime
        }));
    } else {
        localStorage.removeItem('timeTrackerTimerState');
    }
});

window.addEventListener('load', () => {
    const saved = localStorage.getItem('timeTrackerTimerState');
    if (!saved) return;
    try {
        const state = JSON.parse(saved);
        const project = projects.find(p => p.id === state.projectId);
        if (project) {
            currentProject = project;
            startTime = state.startTime;
            elapsedTime = state.elapsedTime;
            startTimer();
        }
    } catch (_) {}
});