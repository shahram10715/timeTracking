// State management
let projects = [];
let currentProject = null;
let timerInterval = null;
let startTime = null;
let elapsedTime = 0;
let isRunning = false;

// DOM elements
const projectNameInput = document.getElementById('projectName');
const addProjectBtn = document.getElementById('addProjectBtn');
const projectsList = document.getElementById('projectsList');
const timerDisplay = document.getElementById('timerDisplay');
const currentProjectDisplay = document.getElementById('currentProject');
const focusBtn = document.getElementById('focusBtn');
const stopBtn = document.getElementById('stopBtn');
const detailsBtn = document.getElementById('detailsBtn');
const reportsBtn = document.getElementById('reportsBtn');
const deleteBtn = document.getElementById('deleteBtn');
const detailsModal = document.getElementById('detailsModal');
const closeDetailsBtn = document.getElementById('closeDetails');
const detailsWrapper = document.getElementById('detailsWrapper');
const detailsTableBody = document.getElementById('detailsTableBody');
const detailsEmptyState = document.getElementById('detailsEmptyState');

// Load data from localStorage
function loadData() {
    const savedProjects = localStorage.getItem('timeTrackerProjects');

    if (savedProjects) {
        projects = JSON.parse(savedProjects);
    }

    renderProjects();
    updateGlobalActionButtons();
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('timeTrackerProjects', JSON.stringify(projects));
}

// Format time (seconds to HH:MM:SS)
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
    if (isNaN(date)) return dateString;
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
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
    
    if (needsSave) {
        localStorage.setItem('timeTrackerLog', JSON.stringify(log));
    }
    
    return log;
}

// Add project
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
        name: name,
        totalTime: 0,
        startDate: new Date().toISOString().split('T')[0]
    });
    
    projectNameInput.value = '';
    saveData();
    renderProjects();
    updateGlobalActionButtons();
}

// Delete project
function deleteProject() {
    if (!currentProject) return;
    
    if (confirm(`Are you sure you want to delete "${currentProject.name}"?`)) {
        const projectId = currentProject.id;
        projects = projects.filter(p => p.id !== projectId);
        stopTimer();
        currentProject = null;
        saveData();
        renderProjects();
        updateTimerUI();
        updateGlobalActionButtons();
    }
}

// Select project
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

// Render projects list
function renderProjects() {
    projectsList.innerHTML = '';
    
    if (projects.length === 0) {
        projectsList.innerHTML = '<p class="empty-log">No projects yet. Add one to get started!</p>';
        return;
    }
    
    // Calculate working days per project (days with at least some logged time)
    // and today's total time per project
    const logEntries = getLogEntries();
    const projectWorkingDaysMap = {};
    const projectTodayTotalsMap = {};
    const todayIso = new Date().toISOString().split('T')[0];

    logEntries.forEach(entry => {
        if (!entry || !entry.project || !entry.date || !entry.duration || entry.duration <= 0) return;
        const projectName = entry.project;
        if (!projectWorkingDaysMap[projectName]) {
            projectWorkingDaysMap[projectName] = new Set();
        }
        projectWorkingDaysMap[projectName].add(entry.date);

        if (entry.date === todayIso) {
            if (!projectTodayTotalsMap[projectName]) {
                projectTodayTotalsMap[projectName] = 0;
            }
            projectTodayTotalsMap[projectName] += entry.duration;
        }
    });
    
    projects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.className = `project-item ${currentProject && currentProject.id === project.id ? 'active' : ''}`;
        projectItem.onclick = () => selectProject(project);

        const workingDaysSet = projectWorkingDaysMap[project.name] || new Set();
        const workingDaysCount = workingDaysSet.size;
        const averagePerWorkingDaySeconds = workingDaysCount > 0
            ? project.totalTime / workingDaysCount
            : 0;
        const averagePerWorkingDayLabel = formatHoursMinutesFromSeconds(averagePerWorkingDaySeconds);

        const todaySeconds = projectTodayTotalsMap[project.name] || 0;
        const todayLabel = formatHoursMinutesFromSeconds(todaySeconds);
        
        const startDateLabel = project.startDate ? `Started: ${formatEntryDate(project.startDate)} &nbsp;|&nbsp; ` : '';
        
        projectItem.innerHTML = `
            <div class="project-info">
                <span class="project-name">${project.name}</span>
                <span class="project-time">${startDateLabel}Today: ${todayLabel} &nbsp;|&nbsp; Avg: ${averagePerWorkingDayLabel} &nbsp;|&nbsp; Total: ${formatTime(project.totalTime)}</span>
            </div>
        `;
        
        projectsList.appendChild(projectItem);
    });
    
    // Update button states
    focusBtn.disabled = !currentProject;
    updateGlobalActionButtons();
}

// Update global action buttons state
function updateGlobalActionButtons() {
    const hasProject = !!currentProject;
    detailsBtn.disabled = !hasProject;
    reportsBtn.disabled = !hasProject;
    deleteBtn.disabled = !hasProject;
}

// Start timer
function startTimer() {
    if (!currentProject) {
        alert('Please select a project first');
        return;
    }
    
    if (isRunning) return;
    
    isRunning = true;
    startTime = Date.now() - (elapsedTime * 1000);
    
    timerInterval = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        updateTimerDisplay();
    }, 1000);
    
    focusBtn.textContent = 'Focusing...';
    focusBtn.classList.add('active');
    focusBtn.disabled = true;
    stopBtn.disabled = false;
    
    updateTimerUI();
}

// Stop timer
function stopTimer() {
    if (!isRunning) return;
    
    isRunning = false;
    clearInterval(timerInterval);
    
    if (currentProject && elapsedTime > 0) {
        // Add time to project
        currentProject.totalTime += elapsedTime;
        saveData();

        // Add to log for detailed view and reports
        addToTimeLog(currentProject.name, elapsedTime);

        // Reset elapsed time
        elapsedTime = 0;
    }
    
    focusBtn.textContent = 'Start Focus';
    focusBtn.classList.remove('active');
    focusBtn.disabled = !currentProject;
    stopBtn.disabled = true;
    
    updateTimerDisplay();
    renderProjects();
    updateGlobalActionButtons();
}

// Update timer display
function updateTimerDisplay() {
    timerDisplay.textContent = formatTime(elapsedTime);
}

// Update timer UI
function updateTimerUI() {
    if (currentProject) {
        currentProjectDisplay.textContent = currentProject.name;
    } else {
        currentProjectDisplay.textContent = 'No project selected';
    }
    updateTimerDisplay();
}

// Add entry to time log (no on-page "today" summary UI)
function addToTimeLog(projectName, duration) {
    const today = new Date().toISOString().split('T')[0];
    let log = getLogEntries();

    const entry = {
        id: generateEntryId(),
        date: today,
        project: projectName,
        duration: duration,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };

    log.push(entry);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    log = log.filter(e => {
        const entryDate = new Date(e.date);
        return entryDate >= thirtyDaysAgo;
    });

    localStorage.setItem('timeTrackerLog', JSON.stringify(log));
}

// Chart instances
let barChartInstance = null;
let currentPeriod = 'daily';
let currentProjectForReports = null;
let currentProjectForDetails = null;

// Get project data for charts
function getProjectData(projectId, period) {
    const log = JSON.parse(localStorage.getItem('timeTrackerLog') || '[]');
    const project = projects.find(p => p.id === projectId);
    if (!project) return { labels: [], data: [] };
    
    const projectEntries = log.filter(entry => entry.project === project.name);
    
    const aggregated = {};
    
    const getWeekStart = (date) => {
        const weekStart = new Date(date);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return weekStart;
    };
    
    const getMonthStart = (date) => {
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        return monthStart;
    };
    
    projectEntries.forEach(entry => {
        const entryDate = new Date(entry.date + 'T00:00:00');
        let key;
        
        if (period === 'daily') {
            key = entryDate.toISOString().split('T')[0];
        } else if (period === 'weekly') {
            key = getWeekStart(entryDate).toISOString();
        } else if (period === 'monthly') {
            key = `${entryDate.getFullYear()}-${entryDate.getMonth()}`;
        }
        
        if (!aggregated[key]) {
            aggregated[key] = 0;
        }
        aggregated[key] += entry.duration;
    });
    
    const periods = [];
    
    if (period === 'daily') {
        for (let i = 9; i >= 0; i--) {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - i);
            const key = date.toISOString().split('T')[0];
            const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            periods.push({ key, label });
        }
    } else if (period === 'weekly') {
        let currentWeekStart = getWeekStart(new Date());
        for (let i = 9; i >= 0; i--) {
            const weekStart = new Date(currentWeekStart);
            weekStart.setDate(weekStart.getDate() - (7 * i));
            const key = weekStart.toISOString();
            const label = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            periods.push({ key, label });
        }
    } else if (period === 'monthly') {
        const currentMonthStart = getMonthStart(new Date());
        for (let i = 9; i >= 0; i--) {
            const month = new Date(currentMonthStart);
            month.setMonth(month.getMonth() - i);
            const key = `${month.getFullYear()}-${month.getMonth()}`;
            const label = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            periods.push({ key, label });
        }
    }
    
    const labels = periods.map(periodInfo => periodInfo.label);
    const data = periods.map(periodInfo => aggregated[periodInfo.key] || 0);
    
    return { labels, data };
}

// Create or update charts
function updateCharts(projectId, period) {
    const { labels, data } = getProjectData(projectId, period);
    
    // Ensure chart container exists
    let barContainer = document.getElementById('barChart');
    
    if (!barContainer) {
        // Restore container if it was removed
        const chartSections = document.querySelectorAll('.chart-section');
        if (chartSections.length >= 1) {
            chartSections[0].innerHTML = '<h3>Time Spent</h3><canvas id="barChart"></canvas>';
            barContainer = document.getElementById('barChart');
        }
    }
    
    if (labels.length === 0) {
        // Show message if no data
        if (barChartInstance) {
            barChartInstance.destroy();
            barChartInstance = null;
        }
        if (barContainer) {
            barContainer.parentElement.innerHTML = '<h3>Time Spent</h3><p class="empty-log">No data available for this period</p>';
        }
        if (period === 'daily') {
            updateDailyAverages(null);
        }
        return;
    }
    
    // Convert seconds to hours for better readability (keep as numbers)
    const dataInHours = data.map(seconds => seconds / 3600);
    
    // Destroy existing chart
    if (barChartInstance) barChartInstance.destroy();
    
    // Build datasets (bars + optional flat average lines for daily view)
    const datasets = [{
        type: 'bar',
        label: 'Time Spent (hours)',
        data: dataInHours,
        backgroundColor: 'rgba(102, 126, 234, 0.7)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 2
    }];

    if (period === 'daily' && data.length > 0) {
        const totalSecondsAll = data.reduce((sum, value) => sum + value, 0);
        const avgAllHours = (totalSecondsAll / data.length) / 3600;

        const workingDays = data.filter(value => value > 0);
        const totalSecondsWorking = workingDays.reduce((sum, value) => sum + value, 0);
        const avgWorkingHours = workingDays.length > 0
            ? (totalSecondsWorking / workingDays.length) / 3600
            : null;

        if (!Number.isNaN(avgAllHours) && avgAllHours > 0) {
            datasets.push({
                type: 'line',
                label: 'Average (all days)',
                data: labels.map(() => avgAllHours),
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 2,
                borderDash: [6, 6],
                pointRadius: 0,
                pointHitRadius: 0
            });
        }

        if (avgWorkingHours && avgWorkingHours > 0) {
            datasets.push({
                type: 'line',
                label: 'Average (working days)',
                data: labels.map(() => avgWorkingHours),
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                borderDash: [2, 4],
                pointRadius: 0,
                pointHitRadius: 0
            });
        }
    }

    // Create bar chart
    const barCtx = document.getElementById('barChart').getContext('2d');
    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Time (hours)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + 'h';
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: period === 'daily' ? 'Day' : period === 'weekly' ? 'Week' : 'Month'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const hours = parseFloat(context.parsed.y);
                            if (Number.isNaN(hours)) return '';
                            const minutes = Math.round((hours % 1) * 60);
                            const wholeHours = Math.floor(hours);
                            return `${context.dataset.label}: ${wholeHours}h ${minutes}m (${hours.toFixed(2)}h)`;
                        }
                    }
                }
            }
        }
    });

    if (period === 'daily') {
        updateDailyAverages(data);
    } else {
        updateDailyAverages(null);
    }
}

function updateDailyAverages(data) {
    const statsContainer = document.getElementById('dailyStats');
    const avgAllEl = document.getElementById('dailyAverageAllValue');
    const avgWorkingEl = document.getElementById('dailyAverageWorkingValue');

    if (!statsContainer || !avgAllEl || !avgWorkingEl) return;

    if (!Array.isArray(data) || data.length === 0) {
        statsContainer.style.display = 'none';
        return;
    }

    const totalSecondsAll = data.reduce((sum, value) => sum + value, 0);
    const avgAllSeconds = totalSecondsAll / data.length;

    const workingDays = data.filter(value => value > 0);
    const totalSecondsWorking = workingDays.reduce((sum, value) => sum + value, 0);
    const avgWorkingSeconds = workingDays.length > 0 ? totalSecondsWorking / workingDays.length : 0;

    avgAllEl.textContent = formatHoursMinutesFromSeconds(avgAllSeconds);
    avgWorkingEl.textContent = workingDays.length > 0
        ? formatHoursMinutesFromSeconds(avgWorkingSeconds)
        : 'N/A';

    statsContainer.style.display = 'block';
}

// View reports for a project
function viewReports() {
    if (!currentProject) return;
    
    currentProjectForReports = currentProject;
    currentPeriod = 'daily';
    
    document.getElementById('modalProjectName').textContent = `${currentProject.name} - Reports`;
    document.getElementById('reportsModal').style.display = 'block';
    
    // Reset tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === 'daily') {
            btn.classList.add('active');
        }
    });
    
    // Restore chart container
    const chartSections = document.querySelectorAll('.chart-section');
    if (chartSections.length > 0 && chartSections[0].querySelector('canvas') === null) {
        chartSections[0].innerHTML = '<h3>Time Spent</h3><canvas id="barChart"></canvas>';
    }
    
    updateCharts(currentProject.id, 'daily');
}

// Detailed entries table for a project
function renderDetailsTable(log) {
    if (!detailsWrapper || !detailsTableBody || !detailsEmptyState) return;

    detailsTableBody.innerHTML = '';

    if (!Array.isArray(log) || log.length === 0) {
        detailsWrapper.classList.add('empty');
        return;
    }

    detailsWrapper.classList.remove('empty');

    const sortedEntries = [...log].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (b.time || '').localeCompare(a.time || '');
    });

    sortedEntries.forEach(entry => {
        const row = document.createElement('tr');

        const dateCell = document.createElement('td');
        dateCell.textContent = formatEntryDate(entry.date);

        const timeCell = document.createElement('td');
        timeCell.textContent = entry.time || 'N/A';

        const projectCell = document.createElement('td');
        projectCell.textContent = entry.project;

        const durationCell = document.createElement('td');
        durationCell.textContent = formatTime(entry.duration);

        const actionCell = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-entry';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteLogEntry(entry.id));
        actionCell.appendChild(deleteBtn);

        row.appendChild(dateCell);
        row.appendChild(timeCell);
        row.appendChild(projectCell);
        row.appendChild(durationCell);
        row.appendChild(actionCell);

        detailsTableBody.appendChild(row);
    });
}

function openDetailsModalForProject() {
    if (!detailsModal || !currentProject) return;

    currentProjectForDetails = currentProject;

    const log = getLogEntries().filter(entry => entry.project === currentProject.name);
    renderDetailsTable(log);

    const header = detailsModal.querySelector('.modal-header h2');
    if (header) {
        header.textContent = `Detailed Focus Entries - ${currentProject.name}`;
    }

    detailsModal.style.display = 'block';
}

function closeDetailsModal() {
    if (detailsModal) {
        detailsModal.style.display = 'none';
    }
}

function deleteLogEntry(entryId) {
    if (!entryId) return;

    let log = getLogEntries();
    const entryIndex = log.findIndex(entry => entry.id === entryId);
    if (entryIndex === -1) return;

    const [removedEntry] = log.splice(entryIndex, 1);
    localStorage.setItem('timeTrackerLog', JSON.stringify(log));

    if (removedEntry) {
        const project = projects.find(p => p.name.toLowerCase() === removedEntry.project.toLowerCase());
        if (project) {
            project.totalTime = Math.max(0, project.totalTime - removedEntry.duration);
        }
    }

    saveData();
    renderProjects();
    updateTimerUI();

    if (currentProjectForDetails) {
        const projectLog = log.filter(entry => entry.project === currentProjectForDetails.name);
        renderDetailsTable(projectLog);
    } else {
        renderDetailsTable(log);
    }
}

// Close modal
function closeModal() {
    document.getElementById('reportsModal').style.display = 'none';
    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }
}

// Handle tab switching
function switchPeriod(period) {
    if (!currentProjectForReports) return;
    
    currentPeriod = period;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === period) {
            btn.classList.add('active');
        }
    });
    
    updateCharts(currentProjectForReports.id, period);
}

// Event listeners
addProjectBtn.addEventListener('click', addProject);
projectNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addProject();
    }
});

focusBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', stopTimer);

// Global action buttons
detailsBtn.addEventListener('click', openDetailsModalForProject);
reportsBtn.addEventListener('click', viewReports);
deleteBtn.addEventListener('click', deleteProject);

// Modal event listeners
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('reportsModal').addEventListener('click', (e) => {
    if (e.target.id === 'reportsModal') {
        closeModal();
    }
});

if (closeDetailsBtn) {
    closeDetailsBtn.addEventListener('click', closeDetailsModal);
}

if (detailsModal) {
    detailsModal.addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') {
            closeDetailsModal();
        }
    });
}

// Tab button event listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchPeriod(btn.dataset.period);
    });
});

// Initialize
loadData();

// Save timer state on page unload
window.addEventListener('beforeunload', () => {
    if (isRunning) {
        // Save current state
        localStorage.setItem('timeTrackerTimerState', JSON.stringify({
            projectId: currentProject.id,
            startTime: startTime,
            elapsedTime: elapsedTime
        }));
    } else {
        localStorage.removeItem('timeTrackerTimerState');
    }
});

// Restore timer state on page load
window.addEventListener('load', () => {
    const savedState = localStorage.getItem('timeTrackerTimerState');
    if (savedState) {
        const state = JSON.parse(savedState);
        const project = projects.find(p => p.id === state.projectId);
        if (project) {
            currentProject = project;
            startTime = state.startTime;
            elapsedTime = state.elapsedTime;
            startTimer();
        }
    }
});

