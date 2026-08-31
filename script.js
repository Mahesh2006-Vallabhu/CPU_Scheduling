/**
 * CPU Scheduling Simulator - Core Logic & Visualizer
 * Operating Systems Interactive Simulator
 * Pure Vanilla JavaScript (ES6+)
 */

// Global App State
const AppState = {
  processes: [
    { id: 'P1', arrivalTime: 0, burstTime: 5, priority: 2, color: '#3b82f6' },
    { id: 'P2', arrivalTime: 1, burstTime: 3, priority: 1, color: '#10b981' },
    { id: 'P3', arrivalTime: 2, burstTime: 8, priority: 3, color: '#f59e0b' },
    { id: 'P4', arrivalTime: 3, burstTime: 6, priority: 2, color: '#ef4444' },
    { id: 'P5', arrivalTime: 4, burstTime: 2, priority: 1, color: '#8b5cf6' }
  ],
  selectedAlgorithm: 'FCFS',
  timeQuantum: 2,
  simulationSpeed: 500, // ms per tick
  
  // Active Simulation State
  isSimulating: false,
  isPaused: false,
  currentTick: 0,
  maxTick: 0,
  timerId: null,
  
  // Computed execution model for playback & results
  executionTrace: [], // Discrete timeline units { time, pid, isIdle, readyQueue, remainingBursts, cpuStatus }
  ganttBlocks: [],    // Merged intervals { pid, start, end, duration, color, isIdle }
  processResults: [], // Calculated metrics per process
  metrics: {
    avgWT: 0,
    avgTAT: 0,
    avgRT: 0,
    cpuUtilization: 0,
    throughput: 0,
    contextSwitches: 0,
    totalTime: 0,
    busyTime: 0
  },
  
  // Comparison Data
  comparisonResults: null,
  charts: {}
};

// Distinct vibrant palette for processes
const PROCESS_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#6366f1', '#a855f7', '#d946ef', '#0284c7', '#059669'
];

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderProcessTable();
  setupEventListeners();
  updateAlgorithmDetails();
  initCharts();
  
  // Run initial default simulation
  runSimulation(false);
});

/* ==========================================================================
   Theme Management
   ========================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem('cpu_sim_theme') || 'dark';
  document.documentElement.setAttribute('data-bs-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-bs-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-bs-theme', newTheme);
  localStorage.setItem('cpu_sim_theme', newTheme);
  updateThemeIcon(newTheme);
  updateChartThemes();
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.innerHTML = theme === 'dark' 
      ? '<i class="bi bi-sun-fill text-warning"></i> <span class="d-none d-sm-inline ms-1">Light</span>' 
      : '<i class="bi bi-moon-stars-fill text-primary"></i> <span class="d-none d-sm-inline ms-1">Dark</span>';
  }
}

/* ==========================================================================
   Process Table Management & Validation
   ========================================================================== */
function isPriorityRequired(algo = AppState.selectedAlgorithm) {
  return algo === 'PRIORITY_NP' || algo === 'PRIORITY_P';
}

function renderProcessTable() {
  const tbody = document.getElementById('processTableBody');
  const table = document.getElementById('processTable');
  if (!tbody || !table) return;

  const requiresPriority = isPriorityRequired();

  // Dynamic Header based on algorithm requirements
  const thead = table.querySelector('thead');
  if (thead) {
    thead.innerHTML = `
      <tr>
        <th style="width: ${requiresPriority ? '22%' : '28%'};">ID</th>
        <th class="text-center" style="width: ${requiresPriority ? '24%' : '34%'};">Arrival (AT)</th>
        <th class="text-center" style="width: ${requiresPriority ? '24%' : '34%'};">Burst (BT)</th>
        ${requiresPriority ? '<th class="text-center" style="width: 22%;">Priority</th>' : ''}
        <th class="text-center" style="width: 8%;"></th>
      </tr>
    `;
  }

  tbody.innerHTML = '';

  AppState.processes.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.id = `proc-row-${p.id}`;
    tr.innerHTML = `
      <td>
        <div class="d-flex align-items-center gap-2">
          <span class="process-color-dot" style="background-color: ${p.color};"></span>
          <input type="text" class="form-control form-control-sm text-center fw-bold font-mono" style="width: 70px;" value="${escapeHtml(p.id)}" onchange="updateProcessField(${idx}, 'id', this.value)" />
        </div>
      </td>
      <td>
        <input type="number" min="0" class="form-control form-control-sm text-center font-mono" value="${p.arrivalTime}" onchange="updateProcessField(${idx}, 'arrivalTime', this.value)" />
      </td>
      <td>
        <input type="number" min="1" class="form-control form-control-sm text-center font-mono" value="${p.burstTime}" onchange="updateProcessField(${idx}, 'burstTime', this.value)" />
      </td>
      ${requiresPriority ? `
      <td>
        <input type="number" min="0" class="form-control form-control-sm text-center font-mono" value="${p.priority !== undefined ? p.priority : 1}" onchange="updateProcessField(${idx}, 'priority', this.value)" />
      </td>
      ` : ''}
      <td class="text-center">
        <button class="btn btn-sm btn-density-outline btn-density-sm text-danger" title="Delete Process" onclick="removeProcess(${idx})">
          <i class="bi bi-trash3"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const countBadge = document.getElementById('processCountBadge');
  if (countBadge) countBadge.textContent = `${AppState.processes.length} Processes`;

  const infoNote = document.getElementById('processConfigInfoNote');
  if (infoNote) {
    if (AppState.selectedAlgorithm === 'FCFS') {
      infoNote.innerHTML = '<i class="bi bi-info-circle me-1"></i> <strong>FCFS</strong>: Only takes Arrival Time (AT) and Burst Time (BT). Priority is not used.';
    } else if (requiresPriority) {
      infoNote.innerHTML = '<i class="bi bi-info-circle me-1"></i> <strong>Priority Scheduling</strong>: Priority value required (Lower number = Higher priority).';
    } else if (AppState.selectedAlgorithm === 'RR') {
      infoNote.innerHTML = '<i class="bi bi-info-circle me-1"></i> <strong>Round Robin</strong>: Takes Arrival Time (AT), Burst Time (BT), and Time Quantum (q).';
    } else {
      infoNote.innerHTML = '<i class="bi bi-info-circle me-1"></i> <strong>SJF/SRTF</strong>: Only takes Arrival Time (AT) and Burst Time (BT).';
    }
  }
}

function updateProcessField(index, field, value) {
  if (!AppState.processes[index]) return;
  
  if (field === 'id') {
    const trimmed = value.trim();
    if (!trimmed) {
      showToast('Process ID cannot be empty.', 'danger');
      renderProcessTable();
      return;
    }
    // Check for duplicate ID
    const exists = AppState.processes.some((p, i) => i !== index && p.id.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      showToast(`Process ID "${trimmed}" is already used. IDs must be unique.`, 'danger');
      renderProcessTable();
      return;
    }
    AppState.processes[index].id = trimmed;
  } else if (field === 'arrivalTime') {
    const val = parseInt(value, 10);
    if (isNaN(val) || val < 0) {
      showToast('Arrival Time must be an integer >= 0.', 'danger');
      renderProcessTable();
      return;
    }
    AppState.processes[index].arrivalTime = val;
  } else if (field === 'burstTime') {
    const val = parseInt(value, 10);
    if (isNaN(val) || val <= 0) {
      showToast('Burst Time must be a positive integer > 0.', 'danger');
      renderProcessTable();
      return;
    }
    AppState.processes[index].burstTime = val;
  } else if (field === 'priority') {
    const val = parseInt(value, 10);
    if (isNaN(val) || val < 0) {
      showToast('Priority must be an integer >= 0.', 'danger');
      renderProcessTable();
      return;
    }
    AppState.processes[index].priority = val;
  }

  // Reset current simulation state on data change
  resetSimulationState();
}

function addProcess() {
  if (AppState.processes.length >= 15) {
    showToast('Maximum 15 processes allowed for clean visualization.', 'warning');
    return;
  }
  
  // Find next available P number
  let nextNum = AppState.processes.length + 1;
  while (AppState.processes.some(p => p.id === `P${nextNum}`)) {
    nextNum++;
  }
  
  const lastArrival = AppState.processes.length > 0 
    ? Math.max(...AppState.processes.map(p => p.arrivalTime)) + 1 
    : 0;
    
  const color = PROCESS_COLORS[(nextNum - 1) % PROCESS_COLORS.length];
  
  AppState.processes.push({
    id: `P${nextNum}`,
    arrivalTime: lastArrival,
    burstTime: Math.floor(Math.random() * 6) + 2,
    priority: Math.floor(Math.random() * 4) + 1,
    color: color
  });
  
  renderProcessTable();
  resetSimulationState();
  showToast(`Added process P${nextNum}`, 'success');
}

function removeProcess(index) {
  if (AppState.processes.length <= 1) {
    showToast('At least one process is required for scheduling simulation.', 'warning');
    return;
  }
  const removed = AppState.processes.splice(index, 1);
  renderProcessTable();
  resetSimulationState();
  showToast(`Removed process ${removed[0].id}`, 'info');
}

function clearAllProcesses() {
  AppState.processes = [];
  renderProcessTable();
  resetSimulationState();
  showToast('Cleared all processes. Add new processes to simulate.', 'info');
}

function generateRandomProcesses() {
  const count = Math.floor(Math.random() * 4) + 4; // 4 to 7 processes
  const newProcesses = [];
  
  for (let i = 1; i <= count; i++) {
    newProcesses.push({
      id: `P${i}`,
      arrivalTime: i === 1 ? 0 : Math.floor(Math.random() * (i * 2)),
      burstTime: Math.floor(Math.random() * 9) + 1,
      priority: Math.floor(Math.random() * 5) + 1,
      color: PROCESS_COLORS[(i - 1) % PROCESS_COLORS.length]
    });
  }
  
  // Sort slightly by arrival for natural display
  newProcesses.sort((a, b) => a.arrivalTime - b.arrivalTime);
  
  AppState.processes = newProcesses;
  renderProcessTable();
  resetSimulationState();
  showToast(`Generated ${count} random processes`, 'success');
}

/* ==========================================================================
   Preset Test Cases
   ========================================================================== */
function loadTestCase(caseNum) {
  switch (caseNum) {
    case 1: // Basic Mixed
      AppState.processes = [
        { id: 'P1', arrivalTime: 0, burstTime: 5, priority: 2, color: PROCESS_COLORS[0] },
        { id: 'P2', arrivalTime: 1, burstTime: 3, priority: 1, color: PROCESS_COLORS[1] },
        { id: 'P3', arrivalTime: 2, burstTime: 8, priority: 3, color: PROCESS_COLORS[2] },
        { id: 'P4', arrivalTime: 3, burstTime: 6, priority: 2, color: PROCESS_COLORS[3] }
      ];
      break;
    case 2: // Same Arrival Time (AT=0)
      AppState.processes = [
        { id: 'P1', arrivalTime: 0, burstTime: 6, priority: 3, color: PROCESS_COLORS[0] },
        { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 1, color: PROCESS_COLORS[1] },
        { id: 'P3', arrivalTime: 0, burstTime: 8, priority: 4, color: PROCESS_COLORS[2] },
        { id: 'P4', arrivalTime: 0, burstTime: 2, priority: 2, color: PROCESS_COLORS[3] },
        { id: 'P5', arrivalTime: 0, burstTime: 5, priority: 1, color: PROCESS_COLORS[4] }
      ];
      break;
    case 3: // CPU Idle Gaps
      AppState.processes = [
        { id: 'P1', arrivalTime: 0, burstTime: 3, priority: 2, color: PROCESS_COLORS[0] },
        { id: 'P2', arrivalTime: 5, burstTime: 4, priority: 1, color: PROCESS_COLORS[1] },
        { id: 'P3', arrivalTime: 12, burstTime: 3, priority: 3, color: PROCESS_COLORS[2] },
        { id: 'P4', arrivalTime: 18, burstTime: 5, priority: 2, color: PROCESS_COLORS[3] }
      ];
      break;
    case 4: // Priority Benchmark
      AppState.processes = [
        { id: 'P1', arrivalTime: 0, burstTime: 10, priority: 3, color: PROCESS_COLORS[0] },
        { id: 'P2', arrivalTime: 1, burstTime: 1, priority: 1, color: PROCESS_COLORS[1] },
        { id: 'P3', arrivalTime: 2, burstTime: 2, priority: 4, color: PROCESS_COLORS[2] },
        { id: 'P4', arrivalTime: 3, burstTime: 1, priority: 5, color: PROCESS_COLORS[3] },
        { id: 'P5', arrivalTime: 4, burstTime: 5, priority: 2, color: PROCESS_COLORS[4] }
      ];
      break;
    case 5: // Round Robin Classic
      AppState.processes = [
        { id: 'P1', arrivalTime: 0, burstTime: 5, priority: 1, color: PROCESS_COLORS[0] },
        { id: 'P2', arrivalTime: 1, burstTime: 4, priority: 1, color: PROCESS_COLORS[1] },
        { id: 'P3', arrivalTime: 2, burstTime: 2, priority: 1, color: PROCESS_COLORS[2] },
        { id: 'P4', arrivalTime: 3, burstTime: 1, priority: 1, color: PROCESS_COLORS[3] }
      ];
      AppState.timeQuantum = 2;
      const tqInput = document.getElementById('timeQuantumInput');
      if (tqInput) tqInput.value = 2;
      break;
  }
  
  renderProcessTable();
  resetSimulationState();
  showToast(`Loaded Test Case ${caseNum}`, 'info');
}

/* ==========================================================================
   Algorithm Selection & Details
   ========================================================================== */
function selectAlgorithm(algoKey) {
  AppState.selectedAlgorithm = algoKey;
  
  // Highlight radio
  const radio = document.querySelector(`input[name="algoRadio"][value="${algoKey}"]`);
  if (radio) radio.checked = true;
  
  const tqContainer = document.getElementById('timeQuantumContainer');
  if (tqContainer) {
    tqContainer.style.display = (algoKey === 'RR') ? 'block' : 'none';
  }
  
  updateAlgorithmDetails();
  renderProcessTable();
  resetSimulationState();
}

function updateAlgorithmDetails() {
  const algo = AppState.selectedAlgorithm;
  const badge = document.getElementById('algoPreemptionBadge');
  const desc = document.getElementById('algoShortDescription');
  
  const isPreemptive = ['SRTF', 'PRIORITY_P', 'RR'].includes(algo);
  
  if (badge) {
    badge.className = `badge ${isPreemptive ? 'bg-primary' : 'bg-success'}`;
    badge.innerHTML = isPreemptive 
      ? '<i class="bi bi-lightning-charge-fill me-1"></i> Preemptive' 
      : '<i class="bi bi-shield-check me-1"></i> Non-Preemptive';
  }
  
  const descMap = {
    'FCFS': 'First-Come, First-Served: Executes processes strictly in order of arrival time without preemption.',
    'SJF_NP': 'Shortest Job First (Non-Preemptive): Selects the arrived process with the smallest CPU burst time and runs it until completion.',
    'SRTF': 'Shortest Remaining Time First (Preemptive SJF): Always runs the process with the least remaining burst time, preempting if a shorter job arrives.',
    'PRIORITY_NP': 'Priority Scheduling (Non-Preemptive): Selects the arrived process with highest priority (lower numerical value = higher priority).',
    'PRIORITY_P': 'Priority Scheduling (Preemptive): Preempts the running process whenever a process with strictly higher priority arrives.',
    'RR': `Round Robin: Preemptive scheduling allocating a fixed Time Quantum (q = ${AppState.timeQuantum}) cyclically through the ready queue.`
  };
  
  if (desc) desc.textContent = descMap[algo] || '';
}

/* ==========================================================================
   Scheduling Algorithms Core Engine
   ========================================================================== */

/**
 * Validates process data
 */
function validateInputs() {
  if (!AppState.processes || AppState.processes.length === 0) {
    showToast('Please add at least one process to run the simulation.', 'danger');
    return false;
  }
  
  const reqPriority = isPriorityRequired();

  for (const p of AppState.processes) {
    if (!p.id || p.id.trim() === '') {
      showToast('Process IDs cannot be empty.', 'danger');
      return false;
    }
    if (isNaN(p.arrivalTime) || p.arrivalTime < 0) {
      showToast(`Invalid arrival time for process ${p.id}. Must be >= 0.`, 'danger');
      return false;
    }
    if (isNaN(p.burstTime) || p.burstTime <= 0) {
      showToast(`Invalid burst time for process ${p.id}. Must be > 0.`, 'danger');
      return false;
    }
    if (reqPriority) {
      if (isNaN(p.priority) || p.priority < 0) {
        showToast(`Invalid priority for process ${p.id}. Must be >= 0.`, 'danger');
        return false;
      }
    }
  }

  if (AppState.selectedAlgorithm === 'RR') {
    const tq = parseInt(document.getElementById('timeQuantumInput')?.value || AppState.timeQuantum, 10);
    if (isNaN(tq) || tq <= 0) {
      showToast('Time Quantum must be a positive integer greater than 0.', 'danger');
      return false;
    }
    AppState.timeQuantum = tq;
  }

  return true;
}

/**
 * Core Dispatcher that simulates any algorithm and returns:
 * { executionTrace, ganttBlocks, processResults, metrics }
 */
function simulateAlgorithm(algorithm, processList, timeQuantum = 2) {
  // Deep clone processes with tracking properties
  const procs = processList.map(p => ({
    id: p.id,
    arrivalTime: Number(p.arrivalTime),
    burstTime: Number(p.burstTime),
    remainingBurst: Number(p.burstTime),
    priority: Number(p.priority),
    color: p.color,
    firstStartTime: -1,
    completionTime: -1,
    waitingTime: 0,
    turnaroundTime: 0,
    responseTime: 0,
    isCompleted: false
  }));

  switch (algorithm) {
    case 'FCFS':
      return simulateFCFS(procs);
    case 'SJF_NP':
      return simulateSJF_NonPreemptive(procs);
    case 'SRTF':
      return simulateSRTF(procs);
    case 'PRIORITY_NP':
      return simulatePriority_NonPreemptive(procs);
    case 'PRIORITY_P':
      return simulatePriority_Preemptive(procs);
    case 'RR':
      return simulateRoundRobin(procs, timeQuantum);
    default:
      return simulateFCFS(procs);
  }
}

/**
 * 1. FCFS - First Come First Serve
 */
function simulateFCFS(procs) {
  let currentTime = 0;
  let completedCount = 0;
  const totalProcesses = procs.length;
  const executionTrace = [];
  
  // Sort initially by arrival time, tie break by PID
  const sorted = [...procs].sort((a, b) => a.arrivalTime - b.arrivalTime || a.id.localeCompare(b.id));

  while (completedCount < totalProcesses) {
    const arrived = sorted.filter(p => !p.isCompleted && p.arrivalTime <= currentTime);

    if (arrived.length === 0) {
      // CPU Idle until next process arrives
      const nextArrival = Math.min(...sorted.filter(p => !p.isCompleted).map(p => p.arrivalTime));
      while (currentTime < nextArrival) {
        executionTrace.push({
          time: currentTime,
          pid: 'IDLE',
          isIdle: true,
          readyQueue: [],
          remainingBursts: getRemainingBurstsMap(procs),
          cpuStatus: { pid: 'IDLE', status: 'IDLE', remaining: 0 }
        });
        currentTime++;
      }
      continue;
    }

    const currentProc = arrived[0]; // First in arrival order
    
    if (currentProc.firstStartTime === -1) {
      currentProc.firstStartTime = currentTime;
    }

    // Run uninterrupted for full burst time
    while (currentProc.remainingBurst > 0) {
      const readyQueue = sorted
        .filter(p => !p.isCompleted && p.id !== currentProc.id && p.arrivalTime <= currentTime)
        .map(p => p.id);

      executionTrace.push({
        time: currentTime,
        pid: currentProc.id,
        isIdle: false,
        readyQueue: readyQueue,
        remainingBursts: getRemainingBurstsMap(procs),
        cpuStatus: { pid: currentProc.id, status: 'RUNNING', remaining: currentProc.remainingBurst }
      });

      currentProc.remainingBurst--;
      currentTime++;
    }

    currentProc.isCompleted = true;
    currentProc.completionTime = currentTime;
    completedCount++;
  }

  return buildSimulationOutputs(procs, executionTrace, currentTime);
}

/**
 * 2. SJF Non-Preemptive
 */
function simulateSJF_NonPreemptive(procs) {
  let currentTime = 0;
  let completedCount = 0;
  const totalProcesses = procs.length;
  const executionTrace = [];

  while (completedCount < totalProcesses) {
    const arrived = procs.filter(p => !p.isCompleted && p.arrivalTime <= currentTime);

    if (arrived.length === 0) {
      const nextArrival = Math.min(...procs.filter(p => !p.isCompleted).map(p => p.arrivalTime));
      while (currentTime < nextArrival) {
        executionTrace.push({
          time: currentTime,
          pid: 'IDLE',
          isIdle: true,
          readyQueue: [],
          remainingBursts: getRemainingBurstsMap(procs),
          cpuStatus: { pid: 'IDLE', status: 'IDLE', remaining: 0 }
        });
        currentTime++;
      }
      continue;
    }

    // Smallest burst time, tie-break: earlier arrival, then PID
    arrived.sort((a, b) => a.burstTime - b.burstTime || a.arrivalTime - b.arrivalTime || a.id.localeCompare(b.id));
    const currentProc = arrived[0];

    if (currentProc.firstStartTime === -1) {
      currentProc.firstStartTime = currentTime;
    }

    // Run until completion
    while (currentProc.remainingBurst > 0) {
      const readyQueue = procs
        .filter(p => !p.isCompleted && p.id !== currentProc.id && p.arrivalTime <= currentTime)
        .sort((a, b) => a.burstTime - b.burstTime || a.arrivalTime - b.arrivalTime || a.id.localeCompare(b.id))
        .map(p => p.id);

      executionTrace.push({
        time: currentTime,
        pid: currentProc.id,
        isIdle: false,
        readyQueue: readyQueue,
        remainingBursts: getRemainingBurstsMap(procs),
        cpuStatus: { pid: currentProc.id, status: 'RUNNING', remaining: currentProc.remainingBurst }
      });

      currentProc.remainingBurst--;
      currentTime++;
    }

    currentProc.isCompleted = true;
    currentProc.completionTime = currentTime;
    completedCount++;
  }

  return buildSimulationOutputs(procs, executionTrace, currentTime);
}

/**
 * 3. SRTF - Shortest Remaining Time First (Preemptive)
 */
function simulateSRTF(procs) {
  let currentTime = 0;
  let completedCount = 0;
  const totalProcesses = procs.length;
  const executionTrace = [];

  while (completedCount < totalProcesses) {
    const arrived = procs.filter(p => !p.isCompleted && p.arrivalTime <= currentTime);

    if (arrived.length === 0) {
      const nextArrival = Math.min(...procs.filter(p => !p.isCompleted).map(p => p.arrivalTime));
      while (currentTime < nextArrival) {
        executionTrace.push({
          time: currentTime,
          pid: 'IDLE',
          isIdle: true,
          readyQueue: [],
          remainingBursts: getRemainingBurstsMap(procs),
          cpuStatus: { pid: 'IDLE', status: 'IDLE', remaining: 0 }
        });
        currentTime++;
      }
      continue;
    }

    // Select with smallest remainingBurst, tie-break: arrivalTime, then PID
    arrived.sort((a, b) => a.remainingBurst - b.remainingBurst || a.arrivalTime - b.arrivalTime || a.id.localeCompare(b.id));
    const currentProc = arrived[0];

    if (currentProc.firstStartTime === -1) {
      currentProc.firstStartTime = currentTime;
    }

    const readyQueue = arrived.slice(1).map(p => p.id);

    executionTrace.push({
      time: currentTime,
      pid: currentProc.id,
      isIdle: false,
      readyQueue: readyQueue,
      remainingBursts: getRemainingBurstsMap(procs),
      cpuStatus: { pid: currentProc.id, status: 'RUNNING', remaining: currentProc.remainingBurst }
    });

    currentProc.remainingBurst--;
    currentTime++;

    if (currentProc.remainingBurst === 0) {
      currentProc.isCompleted = true;
      currentProc.completionTime = currentTime;
      completedCount++;
    }
  }

  return buildSimulationOutputs(procs, executionTrace, currentTime);
}

/**
 * 4. Priority Non-Preemptive (Lower number = Higher priority)
 */
function simulatePriority_NonPreemptive(procs) {
  let currentTime = 0;
  let completedCount = 0;
  const totalProcesses = procs.length;
  const executionTrace = [];

  while (completedCount < totalProcesses) {
    const arrived = procs.filter(p => !p.isCompleted && p.arrivalTime <= currentTime);

    if (arrived.length === 0) {
      const nextArrival = Math.min(...procs.filter(p => !p.isCompleted).map(p => p.arrivalTime));
      while (currentTime < nextArrival) {
        executionTrace.push({
          time: currentTime,
          pid: 'IDLE',
          isIdle: true,
          readyQueue: [],
          remainingBursts: getRemainingBurstsMap(procs),
          cpuStatus: { pid: 'IDLE', status: 'IDLE', remaining: 0 }
        });
        currentTime++;
      }
      continue;
    }

    // Highest priority (lowest numerical value)
    arrived.sort((a, b) => a.priority - b.priority || a.arrivalTime - b.arrivalTime || a.id.localeCompare(b.id));
    const currentProc = arrived[0];

    if (currentProc.firstStartTime === -1) {
      currentProc.firstStartTime = currentTime;
    }

    while (currentProc.remainingBurst > 0) {
      const readyQueue = procs
        .filter(p => !p.isCompleted && p.id !== currentProc.id && p.arrivalTime <= currentTime)
        .sort((a, b) => a.priority - b.priority || a.arrivalTime - b.arrivalTime || a.id.localeCompare(b.id))
        .map(p => p.id);

      executionTrace.push({
        time: currentTime,
        pid: currentProc.id,
        isIdle: false,
        readyQueue: readyQueue,
        remainingBursts: getRemainingBurstsMap(procs),
        cpuStatus: { pid: currentProc.id, status: 'RUNNING', remaining: currentProc.remainingBurst }
      });

      currentProc.remainingBurst--;
      currentTime++;
    }

    currentProc.isCompleted = true;
    currentProc.completionTime = currentTime;
    completedCount++;
  }

  return buildSimulationOutputs(procs, executionTrace, currentTime);
}

/**
 * 5. Priority Preemptive (Lower number = Higher priority)
 */
function simulatePriority_Preemptive(procs) {
  let currentTime = 0;
  let completedCount = 0;
  const totalProcesses = procs.length;
  const executionTrace = [];

  while (completedCount < totalProcesses) {
    const arrived = procs.filter(p => !p.isCompleted && p.arrivalTime <= currentTime);

    if (arrived.length === 0) {
      const nextArrival = Math.min(...procs.filter(p => !p.isCompleted).map(p => p.arrivalTime));
      while (currentTime < nextArrival) {
        executionTrace.push({
          time: currentTime,
          pid: 'IDLE',
          isIdle: true,
          readyQueue: [],
          remainingBursts: getRemainingBurstsMap(procs),
          cpuStatus: { pid: 'IDLE', status: 'IDLE', remaining: 0 }
        });
        currentTime++;
      }
      continue;
    }

    // Select with highest priority (lowest priority value), tie-break arrival, then PID
    arrived.sort((a, b) => a.priority - b.priority || a.arrivalTime - b.arrivalTime || a.id.localeCompare(b.id));
    const currentProc = arrived[0];

    if (currentProc.firstStartTime === -1) {
      currentProc.firstStartTime = currentTime;
    }

    const readyQueue = arrived.slice(1).map(p => p.id);

    executionTrace.push({
      time: currentTime,
      pid: currentProc.id,
      isIdle: false,
      readyQueue: readyQueue,
      remainingBursts: getRemainingBurstsMap(procs),
      cpuStatus: { pid: currentProc.id, status: 'RUNNING', remaining: currentProc.remainingBurst }
    });

    currentProc.remainingBurst--;
    currentTime++;

    if (currentProc.remainingBurst === 0) {
      currentProc.isCompleted = true;
      currentProc.completionTime = currentTime;
      completedCount++;
    }
  }

  return buildSimulationOutputs(procs, executionTrace, currentTime);
}

/**
 * 6. Round Robin (Preemptive Ready Queue)
 */
function simulateRoundRobin(procs, timeQuantum) {
  let currentTime = 0;
  let completedCount = 0;
  const totalProcesses = procs.length;
  const executionTrace = [];
  
  // Ready queue holds process objects
  const readyQueue = [];
  const inQueueSet = new Set();

  // Helper to enqueue newly arrived processes up to time t
  const enqueueNewArrivals = (t) => {
    // Sort newly arrived by arrivalTime then PID for deterministic queueing
    const arrivals = procs
      .filter(p => !p.isCompleted && p.arrivalTime <= t && !inQueueSet.has(p.id))
      .sort((a, b) => a.arrivalTime - b.arrivalTime || a.id.localeCompare(b.id));

    arrivals.forEach(p => {
      readyQueue.push(p);
      inQueueSet.add(p.id);
    });
  };

  enqueueNewArrivals(currentTime);

  while (completedCount < totalProcesses) {
    if (readyQueue.length === 0) {
      // CPU Idle
      const unfinished = procs.filter(p => !p.isCompleted);
      const nextArrival = Math.min(...unfinished.map(p => p.arrivalTime));
      
      while (currentTime < nextArrival) {
        executionTrace.push({
          time: currentTime,
          pid: 'IDLE',
          isIdle: true,
          readyQueue: [],
          remainingBursts: getRemainingBurstsMap(procs),
          cpuStatus: { pid: 'IDLE', status: 'IDLE', remaining: 0 }
        });
        currentTime++;
      }
      enqueueNewArrivals(currentTime);
      continue;
    }

    const currentProc = readyQueue.shift();
    inQueueSet.delete(currentProc.id);

    if (currentProc.firstStartTime === -1) {
      currentProc.firstStartTime = currentTime;
    }

    const sliceDuration = Math.min(timeQuantum, currentProc.remainingBurst);

    for (let s = 0; s < sliceDuration; s++) {
      // Queue visual representation: show waiting processes in queue order
      const qSnapshot = readyQueue.map(p => p.id);

      executionTrace.push({
        time: currentTime,
        pid: currentProc.id,
        isIdle: false,
        readyQueue: qSnapshot,
        remainingBursts: getRemainingBurstsMap(procs),
        cpuStatus: { pid: currentProc.id, status: 'RUNNING', remaining: currentProc.remainingBurst }
      });

      currentProc.remainingBurst--;
      currentTime++;

      // As time ticks forward by 1, any process arriving AT this tick enters the ready queue
      enqueueNewArrivals(currentTime);
    }

    if (currentProc.remainingBurst === 0) {
      currentProc.isCompleted = true;
      currentProc.completionTime = currentTime;
      completedCount++;
    } else {
      // Put back into queue behind any newly arrived
      readyQueue.push(currentProc);
      inQueueSet.add(currentProc.id);
    }
  }

  return buildSimulationOutputs(procs, executionTrace, currentTime);
}

/**
 * Calculates TAT, WT, RT, aggregates Gantt blocks, and computes performance metrics
 */
function buildSimulationOutputs(procs, executionTrace, totalTime) {
  let busyTime = 0;
  let contextSwitches = 0;
  let lastPid = null;

  // Build Gantt blocks from continuous execution intervals
  const ganttBlocks = [];
  let currentBlock = null;

  executionTrace.forEach(step => {
    if (!step.isIdle) busyTime++;

    if (lastPid !== null && lastPid !== step.pid) {
      // Context switch occurs when switching between different processes (or Idle -> Process / Process -> Process)
      if (lastPid !== 'IDLE' && step.pid !== 'IDLE') {
        contextSwitches++;
      } else if (lastPid === 'IDLE' && step.pid !== 'IDLE') {
        // Dispatched from idle
      }
    }
    lastPid = step.pid;

    if (!currentBlock) {
      currentBlock = {
        pid: step.pid,
        start: step.time,
        end: step.time + 1,
        duration: 1,
        isIdle: step.isIdle,
        color: step.isIdle ? '#374151' : (procs.find(p => p.id === step.pid)?.color || '#3b82f6')
      };
    } else if (currentBlock.pid === step.pid) {
      currentBlock.end = step.time + 1;
      currentBlock.duration++;
    } else {
      ganttBlocks.push(currentBlock);
      currentBlock = {
        pid: step.pid,
        start: step.time,
        end: step.time + 1,
        duration: 1,
        isIdle: step.isIdle,
        color: step.isIdle ? '#374151' : (procs.find(p => p.id === step.pid)?.color || '#3b82f6')
      };
    }
  });

  if (currentBlock) {
    ganttBlocks.push(currentBlock);
  }

  // Calculate per-process metrics
  const processResults = procs.map(p => {
    const turnaroundTime = p.completionTime - p.arrivalTime;
    const waitingTime = turnaroundTime - p.burstTime;
    const responseTime = p.firstStartTime - p.arrivalTime;
    
    return {
      id: p.id,
      arrivalTime: p.arrivalTime,
      burstTime: p.burstTime,
      priority: p.priority,
      completionTime: p.completionTime,
      turnaroundTime: Math.max(0, turnaroundTime),
      waitingTime: Math.max(0, waitingTime),
      responseTime: Math.max(0, responseTime),
      color: p.color
    };
  }).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  // Aggregate metrics
  const n = processResults.length;
  const sumWT = processResults.reduce((acc, p) => acc + p.waitingTime, 0);
  const sumTAT = processResults.reduce((acc, p) => acc + p.turnaroundTime, 0);
  const sumRT = processResults.reduce((acc, p) => acc + p.responseTime, 0);

  const avgWT = n > 0 ? (sumWT / n) : 0;
  const avgTAT = n > 0 ? (sumTAT / n) : 0;
  const avgRT = n > 0 ? (sumRT / n) : 0;
  const cpuUtilization = totalTime > 0 ? (busyTime / totalTime) * 100 : 0;
  const throughput = totalTime > 0 ? (n / totalTime) : 0;

  const metrics = {
    avgWT: parseFloat(avgWT.toFixed(2)),
    avgTAT: parseFloat(avgTAT.toFixed(2)),
    avgRT: parseFloat(avgRT.toFixed(2)),
    cpuUtilization: parseFloat(cpuUtilization.toFixed(2)),
    throughput: parseFloat(throughput.toFixed(3)),
    contextSwitches: contextSwitches,
    totalTime: totalTime,
    busyTime: busyTime
  };

  return {
    executionTrace,
    ganttBlocks,
    processResults,
    metrics
  };
}

function getRemainingBurstsMap(procs) {
  const map = {};
  procs.forEach(p => {
    map[p.id] = p.remainingBurst;
  });
  return map;
}

/* ==========================================================================
   Simulation Execution & Controller
   ========================================================================== */

function runSimulation(isAnimated = false) {
  if (!validateInputs()) return;

  const results = simulateAlgorithm(
    AppState.selectedAlgorithm, 
    AppState.processes, 
    AppState.timeQuantum
  );

  AppState.executionTrace = results.executionTrace;
  AppState.ganttBlocks = results.ganttBlocks;
  AppState.processResults = results.processResults;
  AppState.metrics = results.metrics;
  AppState.maxTick = results.executionTrace.length;

  if (isAnimated) {
    startAnimationPlayback();
  } else {
    // Jump straight to complete state
    AppState.currentTick = AppState.maxTick;
    renderAllViews();
    showToast(`Simulation completed using ${getAlgorithmName(AppState.selectedAlgorithm)}`, 'success');
  }
}

function startAnimationPlayback() {
  if (AppState.timerId) clearInterval(AppState.timerId);
  AppState.isSimulating = true;
  AppState.isPaused = false;
  AppState.currentTick = 0;
  
  updateSimButtons();
  
  AppState.timerId = setInterval(() => {
    if (AppState.isPaused) return;

    if (AppState.currentTick < AppState.maxTick) {
      renderLiveStep(AppState.currentTick);
      AppState.currentTick++;
    } else {
      stopAnimationPlayback();
      renderAllViews();
      showToast('Animation completed.', 'success');
    }
  }, AppState.simulationSpeed);
}

function pauseSimulation() {
  AppState.isPaused = !AppState.isPaused;
  updateSimButtons();
}

function stepForward() {
  if (!AppState.executionTrace || AppState.executionTrace.length === 0) {
    runSimulation(false);
    AppState.currentTick = 0;
  }
  
  if (AppState.timerId) {
    clearInterval(AppState.timerId);
    AppState.timerId = null;
    AppState.isSimulating = false;
    AppState.isPaused = true;
    updateSimButtons();
  }

  if (AppState.currentTick < AppState.maxTick) {
    renderLiveStep(AppState.currentTick);
    AppState.currentTick++;
  } else {
    showToast('Simulation is at the final step.', 'info');
  }
}

function stopAnimationPlayback() {
  if (AppState.timerId) {
    clearInterval(AppState.timerId);
    AppState.timerId = null;
  }
  AppState.isSimulating = false;
  AppState.isPaused = false;
  updateSimButtons();
}

function restartSimulation() {
  stopAnimationPlayback();
  startAnimationPlayback();
}

function resetSimulationState() {
  stopAnimationPlayback();
  AppState.currentTick = 0;
  AppState.executionTrace = [];
  AppState.ganttBlocks = [];
  AppState.processResults = [];
  AppState.metrics = { avgWT: 0, avgTAT: 0, avgRT: 0, cpuUtilization: 0, throughput: 0, contextSwitches: 0, totalTime: 0, busyTime: 0 };
  
  // Re-run instantly
  runSimulation(false);
}

function updateSimButtons() {
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  
  if (playBtn) {
    playBtn.disabled = AppState.isSimulating && !AppState.isPaused;
  }
  if (pauseBtn) {
    pauseBtn.disabled = !AppState.isSimulating;
    pauseBtn.innerHTML = AppState.isPaused 
      ? '<i class="bi bi-play-fill"></i> Resume' 
      : '<i class="bi bi-pause-fill"></i> Pause';
  }
}

/* ==========================================================================
   DOM Rendering Functions
   ========================================================================== */

function renderAllViews() {
  renderGanttChart();
  renderResultsTable();
  renderMetricCards();
  renderCPUStatusPanel(AppState.maxTick > 0 ? AppState.executionTrace[AppState.maxTick - 1] : null);
  updateProcessCharts();
}

/**
 * Step-by-step live visual updater
 */
function renderLiveStep(tickIndex) {
  if (!AppState.executionTrace || !AppState.executionTrace[tickIndex]) return;
  const step = AppState.executionTrace[tickIndex];
  
  renderGanttChart(tickIndex + 1);
  renderCPUStatusPanel(step);
  updateLiveProgressBadge(step.time, AppState.maxTick);
}

/**
 * Renders the horizontal Gantt Chart with time markers and tooltips
 */
function renderGanttChart(upToTime = null) {
  const container = document.getElementById('ganttChartContainer');
  if (!container) return;
  
  if (!AppState.ganttBlocks || AppState.ganttBlocks.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="bi bi-bar-chart-steps fs-1 d-block mb-2"></i>
        Run a simulation to generate the Gantt chart.
      </div>
    `;
    return;
  }

  const limitTime = upToTime !== null ? upToTime : AppState.metrics.totalTime;
  const totalScale = Math.max(1, AppState.metrics.totalTime);

  // Filter or truncate blocks up to limitTime
  const visibleBlocks = [];
  for (const block of AppState.ganttBlocks) {
    if (block.start >= limitTime) break;
    
    if (block.end <= limitTime) {
      visibleBlocks.push(block);
    } else {
      // Partial block in progress
      visibleBlocks.push({
        ...block,
        end: limitTime,
        duration: limitTime - block.start
      });
      break;
    }
  }

  let blocksHtml = '';
  let timeTicksHtml = `<div class="gantt-time-tick" style="left: 0%;">0</div>`;

  visibleBlocks.forEach(b => {
    const widthPct = (b.duration / totalScale) * 100;
    const endPosPct = (b.end / totalScale) * 100;
    
    const isIdle = b.isIdle;
    const label = isIdle ? 'CPU IDLE' : b.pid;
    const tooltip = isIdle 
      ? `Idle from t=${b.start} to t=${b.end} (${b.duration} units)` 
      : `${b.pid}: ${b.start} → ${b.end} (${b.duration} units)`;

    blocksHtml += `
      <div class="gantt-block ${isIdle ? 'idle-block' : ''}" 
           style="width: ${widthPct}%; background-color: ${b.color};" 
           title="${tooltip}">
        <span class="fs-6">${label}</span>
        <small class="opacity-75" style="font-size: 0.7rem;">${b.duration}u</small>
      </div>
    `;

    timeTicksHtml += `
      <div class="gantt-time-tick" style="left: ${endPosPct}%;">
        ${b.end}
      </div>
    `;
  });

  container.innerHTML = `
    <div class="gantt-scroll-container">
      <div class="gantt-chart-wrapper" style="min-width: ${Math.max(650, totalScale * 35)}px;">
        <div class="gantt-blocks-row">
          ${blocksHtml}
        </div>
        <div class="gantt-time-labels">
          ${timeTicksHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders Process Results Table
 */
function renderResultsTable() {
  const tbody = document.getElementById('resultsTableBody');
  const tfoot = document.getElementById('resultsTableFoot');
  const table = document.getElementById('resultsTable');
  if (!tbody || !tfoot || !table) return;

  const requiresPriority = isPriorityRequired();

  const thead = table.querySelector('thead');
  if (thead) {
    thead.innerHTML = `
      <tr>
        <th>Proc</th>
        <th class="text-center">Arrival (AT)</th>
        <th class="text-center">Burst (BT)</th>
        ${requiresPriority ? '<th class="text-center">Priority</th>' : ''}
        <th class="text-center">Completion (CT)</th>
        <th class="text-center">Turnaround (TAT)</th>
        <th class="text-center">Waiting (WT)</th>
        <th class="text-center">Response (RT)</th>
      </tr>
    `;
  }

  tbody.innerHTML = '';
  
  if (!AppState.processResults || AppState.processResults.length === 0) {
    const colCount = requiresPriority ? 8 : 7;
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="text-center py-3 text-muted">No results available</td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  AppState.processResults.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="process-pill" style="background-color: ${p.color}22; color: ${p.color}; border: 1px solid ${p.color}55;">
          ${escapeHtml(p.id)}
        </span>
      </td>
      <td class="text-center font-mono">${p.arrivalTime}</td>
      <td class="text-center font-mono">${p.burstTime}</td>
      ${requiresPriority ? `<td class="text-center font-mono">${p.priority}</td>` : ''}
      <td class="text-center fw-bold font-mono text-info">${p.completionTime}</td>
      <td class="text-center fw-bold font-mono text-primary">${p.turnaroundTime}</td>
      <td class="text-center fw-bold font-mono text-warning">${p.waitingTime}</td>
      <td class="text-center fw-bold font-mono text-success">${p.responseTime}</td>
    `;
    tbody.appendChild(tr);
  });

  // Summary Row with Averages
  const colSpan = requiresPriority ? 4 : 3;
  tfoot.innerHTML = `
    <tr class="fw-bold table-active border-top-2">
      <td colspan="${colSpan}" class="text-end">Average / Overall:</td>
      <td class="text-center text-muted">-</td>
      <td class="text-center text-primary fs-6 font-mono">${AppState.metrics.avgTAT}</td>
      <td class="text-center text-warning fs-6 font-mono">${AppState.metrics.avgWT}</td>
      <td class="text-center text-success fs-6 font-mono">${AppState.metrics.avgRT}</td>
    </tr>
  `;
}

/**
 * Renders Metric Statistic Cards
 */
function renderMetricCards() {
  const m = AppState.metrics;
  
  setCardValue('metricAvgWT', `${m.avgWT} <span class="fs-6 fw-normal text-muted">units</span>`);
  setCardValue('metricAvgTAT', `${m.avgTAT} <span class="fs-6 fw-normal text-muted">units</span>`);
  setCardValue('metricAvgRT', `${m.avgRT} <span class="fs-6 fw-normal text-muted">units</span>`);
  setCardValue('metricCpuUtil', `${m.cpuUtilization}%`);
  setCardValue('metricThroughput', `${m.throughput} <span class="fs-6 fw-normal text-muted">p/u</span>`);
  setCardValue('metricContextSwitches', `${m.contextSwitches}`);
}

function setCardValue(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/**
 * Renders the Visual CPU Component & Ready Queue
 */
function renderCPUStatusPanel(step) {
  const cpuBox = document.getElementById('cpuCoreVisualizer');
  const activePidEl = document.getElementById('cpuActiveProcess');
  const statusBadge = document.getElementById('cpuStatusBadge');
  const remBurstEl = document.getElementById('cpuRemainingBurst');
  const curTimeEl = document.getElementById('cpuCurrentTime');
  const queueTrack = document.getElementById('readyQueueTrack');
  const completedTrack = document.getElementById('completedProcessList');

  if (!step) {
    if (activePidEl) activePidEl.textContent = 'IDLE';
    if (statusBadge) {
      statusBadge.className = 'badge bg-secondary';
      statusBadge.textContent = 'STANDBY';
    }
    if (remBurstEl) remBurstEl.textContent = '-';
    if (curTimeEl) curTimeEl.textContent = '0';
    if (queueTrack) queueTrack.innerHTML = '<span class="text-muted fst-italic">Queue is empty</span>';
    if (completedTrack) completedTrack.innerHTML = '<span class="text-muted fst-italic">None</span>';
    return;
  }

  const isIdle = step.isIdle || step.pid === 'IDLE';

  if (cpuBox) {
    cpuBox.className = `cpu-core-box ${isIdle ? 'idle' : 'running'}`;
  }

  if (activePidEl) {
    activePidEl.textContent = isIdle ? 'IDLE' : step.pid;
    const pColor = AppState.processes.find(p => p.id === step.pid)?.color || 'inherit';
    activePidEl.style.color = isIdle ? 'var(--text-muted)' : pColor;
  }

  if (statusBadge) {
    statusBadge.className = `badge ${isIdle ? 'bg-secondary' : 'bg-success'}`;
    statusBadge.textContent = isIdle ? 'IDLE' : 'RUNNING';
  }

  if (remBurstEl) {
    const rem = step.remainingBursts[step.pid];
    remBurstEl.textContent = isIdle ? '0' : (rem !== undefined ? rem : 0);
  }

  if (curTimeEl) {
    curTimeEl.textContent = `${step.time}u`;
  }

  // Render Ready Queue
  if (queueTrack) {
    if (!step.readyQueue || step.readyQueue.length === 0) {
      queueTrack.innerHTML = '<span class="text-muted fst-italic py-2">Queue is empty</span>';
    } else {
      let qHtml = '';
      step.readyQueue.forEach((pid, idx) => {
        const proc = AppState.processes.find(p => p.id === pid);
        const rem = step.remainingBursts[pid] !== undefined ? step.remainingBursts[pid] : proc?.burstTime;
        const color = proc?.color || '#3b82f6';

        qHtml += `
          <div class="queue-process-item" style="border-left: 4px solid ${color};">
            <div class="fw-bold" style="color: ${color};">${pid}</div>
            <small class="text-muted" style="font-size: 0.7rem;">Rem: ${rem}</small>
          </div>
        `;
        if (idx < step.readyQueue.length - 1) {
          qHtml += `<i class="bi bi-arrow-right queue-arrow"></i>`;
        }
      });
      queueTrack.innerHTML = qHtml;
    }
  }

  // Render Completed list
  if (completedTrack) {
    const completedPids = Object.entries(step.remainingBursts)
      .filter(([pid, rem]) => rem === 0 && pid !== 'IDLE')
      .map(([pid]) => pid);

    if (completedPids.length === 0) {
      completedTrack.innerHTML = '<span class="text-muted fst-italic">None</span>';
    } else {
      completedTrack.innerHTML = completedPids.map(pid => {
        const proc = AppState.processes.find(p => p.id === pid);
        const color = proc?.color || '#10b981';
        return `<span class="badge me-1 mb-1" style="background-color: ${color}25; color: ${color}; border: 1px solid ${color}55;">✓ ${pid}</span>`;
      }).join(' ');
    }
  }
}

function updateLiveProgressBadge(time, maxTime) {
  const badge = document.getElementById('simulationProgressBadge');
  if (badge) {
    badge.textContent = `Time: ${time} / ${maxTime}`;
  }
}

/* ==========================================================================
   Algorithm Comparison (Run All)
   ========================================================================== */

function compareAllAlgorithms() {
  if (!validateInputs()) return;

  const algos = [
    { key: 'FCFS', name: 'First Come First Serve (FCFS)', preemptive: 'No' },
    { key: 'SJF_NP', name: 'Shortest Job First (SJF Non-Preemptive)', preemptive: 'No' },
    { key: 'SRTF', name: 'Shortest Remaining Time First (SRTF)', preemptive: 'Yes' },
    { key: 'PRIORITY_NP', name: 'Priority (Non-Preemptive)', preemptive: 'No' },
    { key: 'PRIORITY_P', name: 'Priority (Preemptive)', preemptive: 'Yes' },
    { key: 'RR', name: `Round Robin (q = ${AppState.timeQuantum})`, preemptive: 'Yes' }
  ];

  const results = algos.map(algo => {
    const sim = simulateAlgorithm(algo.key, AppState.processes, AppState.timeQuantum);
    return {
      key: algo.key,
      name: algo.name,
      preemptive: algo.preemptive,
      avgWT: sim.metrics.avgWT,
      avgTAT: sim.metrics.avgTAT,
      avgRT: sim.metrics.avgRT,
      cpuUtilization: sim.metrics.cpuUtilization,
      contextSwitches: sim.metrics.contextSwitches,
      throughput: sim.metrics.throughput
    };
  });

  AppState.comparisonResults = results;
  renderComparisonTable(results);
  updateComparisonCharts(results);
  
  showToast('Ran comparison across all 6 scheduling algorithms!', 'success');

  // Scroll smoothly to comparison section
  const section = document.getElementById('comparison');
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

function renderComparisonTable(results) {
  const tbody = document.getElementById('comparisonTableBody');
  if (!tbody) return;

  // Identify Best Values
  const minWT = Math.min(...results.map(r => r.avgWT));
  const minTAT = Math.min(...results.map(r => r.avgTAT));
  const minRT = Math.min(...results.map(r => r.avgRT));
  const maxUtil = Math.max(...results.map(r => r.cpuUtilization));
  const minSwitches = Math.min(...results.map(r => r.contextSwitches));

  tbody.innerHTML = '';

  results.forEach(r => {
    const isBestWT = r.avgWT === minWT;
    const isBestTAT = r.avgTAT === minTAT;
    const isBestRT = r.avgRT === minRT;
    const isBestUtil = r.cpuUtilization === maxUtil;
    const isBestSwitches = r.contextSwitches === minSwitches;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-bold">
        ${escapeHtml(r.name)}
      </td>
      <td class="text-center">
        <span class="badge ${r.preemptive === 'Yes' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-success-subtle text-success border border-success-subtle'}">
          ${r.preemptive}
        </span>
      </td>
      <td class="text-center ${isBestWT ? 'best-cell' : ''}">
        ${r.avgWT} ${isBestWT ? '<span class="badge-winner"><i class="bi bi-trophy-fill"></i> Best</span>' : ''}
      </td>
      <td class="text-center ${isBestTAT ? 'best-cell' : ''}">
        ${r.avgTAT} ${isBestTAT ? '<span class="badge-winner"><i class="bi bi-lightning-fill"></i> Best</span>' : ''}
      </td>
      <td class="text-center ${isBestRT ? 'best-cell' : ''}">
        ${r.avgRT} ${isBestRT ? '<span class="badge-winner"><i class="bi bi-bullseye"></i> Best</span>' : ''}
      </td>
      <td class="text-center ${isBestUtil ? 'best-cell' : ''}">
        ${r.cpuUtilization}% ${isBestUtil ? '<span class="badge-winner"><i class="bi bi-battery-charging"></i> Best</span>' : ''}
      </td>
      <td class="text-center ${isBestSwitches ? 'best-cell' : ''}">
        ${r.contextSwitches}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ==========================================================================
   Chart.js Visualizations
   ========================================================================== */

function initCharts() {
  if (typeof Chart === 'undefined') return;

  const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#475569';

  // Chart 1: Average Waiting Time Comparison
  const ctx1 = document.getElementById('chartAvgWT')?.getContext('2d');
  if (ctx1) {
    AppState.charts.avgWT = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: ['FCFS', 'SJF', 'SRTF', 'Priority NP', 'Priority P', 'Round Robin'],
        datasets: [{
          label: 'Avg Waiting Time (units)',
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: getCommonChartOptions(gridColor, textColor, 'Waiting Time (Lower is Better)')
    });
  }

  // Chart 2: Average Turnaround Time Comparison
  const ctx2 = document.getElementById('chartAvgTAT')?.getContext('2d');
  if (ctx2) {
    AppState.charts.avgTAT = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ['FCFS', 'SJF', 'SRTF', 'Priority NP', 'Priority P', 'Round Robin'],
        datasets: [{
          label: 'Avg Turnaround Time (units)',
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: '#8b5cf6',
          borderRadius: 4
        }]
      },
      options: getCommonChartOptions(gridColor, textColor, 'Turnaround Time (Lower is Better)')
    });
  }

  // Chart 3: CPU Utilization Comparison
  const ctx3 = document.getElementById('chartCpuUtil')?.getContext('2d');
  if (ctx3) {
    AppState.charts.cpuUtil = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: ['FCFS', 'SJF', 'SRTF', 'Priority NP', 'Priority P', 'Round Robin'],
        datasets: [{
          label: 'CPU Utilization (%)',
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: '#10b981',
          borderRadius: 4
        }]
      },
      options: getCommonChartOptions(gridColor, textColor, 'CPU Utilization % (Higher is Better)', 100)
    });
  }

  // Chart 4: Process-wise Breakdown for Current Simulation
  const ctx4 = document.getElementById('chartProcessBreakdown')?.getContext('2d');
  if (ctx4) {
    AppState.charts.processBreakdown = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Waiting Time',
            data: [],
            backgroundColor: '#f59e0b',
            borderRadius: 3
          },
          {
            label: 'Turnaround Time',
            data: [],
            backgroundColor: '#06b6d4',
            borderRadius: 3
          }
        ]
      },
      options: getCommonChartOptions(gridColor, textColor, 'Time Units')
    });
  }
}

function getCommonChartOptions(gridColor, textColor, yAxisTitle, maxY = null) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: textColor, font: { family: 'ui-monospace, monospace', size: 11, weight: 'bold' } }
      },
      tooltip: {
        padding: 8,
        cornerRadius: 4
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { family: 'ui-monospace, monospace', size: 10 } }
      },
      y: {
        beginAtZero: true,
        max: maxY,
        title: { display: true, text: yAxisTitle, color: textColor, font: { size: 10, weight: 'bold' } },
        grid: { color: gridColor },
        ticks: { color: textColor, font: { family: 'ui-monospace, monospace', size: 10 } }
      }
    }
  };
}

function updateProcessCharts() {
  if (!AppState.charts.processBreakdown || !AppState.processResults) return;

  const chart = AppState.charts.processBreakdown;
  chart.data.labels = AppState.processResults.map(p => p.id);
  chart.data.datasets[0].data = AppState.processResults.map(p => p.waitingTime);
  chart.data.datasets[1].data = AppState.processResults.map(p => p.turnaroundTime);
  chart.update();
}

function updateComparisonCharts(results) {
  if (!results) return;

  const labels = ['FCFS', 'SJF', 'SRTF', 'Pri NP', 'Pri P', 'RR'];

  if (AppState.charts.avgWT) {
    AppState.charts.avgWT.data.labels = labels;
    AppState.charts.avgWT.data.datasets[0].data = results.map(r => r.avgWT);
    AppState.charts.avgWT.update();
  }

  if (AppState.charts.avgTAT) {
    AppState.charts.avgTAT.data.labels = labels;
    AppState.charts.avgTAT.data.datasets[0].data = results.map(r => r.avgTAT);
    AppState.charts.avgTAT.update();
  }

  if (AppState.charts.cpuUtil) {
    AppState.charts.cpuUtil.data.labels = labels;
    AppState.charts.cpuUtil.data.datasets[0].data = results.map(r => r.cpuUtilization);
    AppState.charts.cpuUtil.update();
  }
}

function updateChartThemes() {
  const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#475569';

  Object.values(AppState.charts).forEach(chart => {
    if (chart) {
      if (chart.options.scales.x) {
        chart.options.scales.x.grid.color = gridColor;
        chart.options.scales.x.ticks.color = textColor;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.grid.color = gridColor;
        chart.options.scales.y.ticks.color = textColor;
        if (chart.options.scales.y.title) chart.options.scales.y.title.color = textColor;
      }
      if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = textColor;
      }
      chart.update();
    }
  });
}

/* ==========================================================================
   Export & Report Generation (PDF)
   ========================================================================== */

function exportResultsPDF() {
  if (!AppState.processResults || AppState.processResults.length === 0) {
    showToast('Please run the simulation first before exporting the PDF report.', 'warning');
    return;
  }

  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      // Fallback if jsPDF is unavailable
      window.print();
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [30, 41, 59]; // slate-800
    const accentColor = [37, 99, 235]; // blue-600
    const secondaryColor = [71, 85, 105]; // slate-600
    const reqPriority = isPriorityRequired();
    const algoName = getAlgorithmName(AppState.selectedAlgorithm);
    const dateStr = new Date().toLocaleString();

    // 1. Header Banner
    doc.setFillColor(15, 23, 42); // dark navy/slate
    doc.rect(0, 0, 210, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('CPU SCHEDULING SIMULATION REPORT', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Interactive Operating Systems Simulation Suite', 14, 18);

    doc.setFontSize(8);
    doc.text(`Generated: ${dateStr}`, 196, 18, { align: 'right' });

    // 2. Configuration & Algorithm Overview
    let currentY = 32;

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('1. Simulation Configuration', 14, currentY);

    currentY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    let configDetails = `Algorithm: ${algoName}`;
    if (AppState.selectedAlgorithm === 'RR') {
      configDetails += `  |  Time Quantum: ${AppState.timeQuantum} units`;
    }
    configDetails += `  |  Process Count: ${AppState.processes.length}`;
    doc.text(configDetails, 14, currentY);

    // 3. Performance Metrics Summary Table
    currentY += 8;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('2. Performance Metrics', 14, currentY);

    currentY += 4;
    const metricsData = [
      ['Average Waiting Time (WT)', `${AppState.metrics.avgWT} units`, 'CPU Utilization', `${AppState.metrics.cpuUtilization}%`],
      ['Average Turnaround Time (TAT)', `${AppState.metrics.avgTAT} units`, 'Throughput', `${AppState.metrics.throughput} proc/unit`],
      ['Average Response Time (RT)', `${AppState.metrics.avgRT} units`, 'Context Switches', `${AppState.metrics.contextSwitches}`]
    ];

    if (doc.autoTable) {
      doc.autoTable({
        startY: currentY,
        head: [['Metric', 'Value', 'System Metric', 'Value']],
        body: metricsData,
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: 14, right: 14 }
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }

    // 4. Process Scheduling Results Table
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('3. Detailed Process Results', 14, currentY);

    currentY += 4;
    const tableHeaders = reqPriority
      ? ['Process', 'Arrival (AT)', 'Burst (BT)', 'Priority', 'Completion (CT)', 'Turnaround (TAT)', 'Waiting (WT)', 'Response (RT)']
      : ['Process', 'Arrival (AT)', 'Burst (BT)', 'Completion (CT)', 'Turnaround (TAT)', 'Waiting (WT)', 'Response (RT)'];

    const tableRows = AppState.processResults.map(p => {
      if (reqPriority) {
        return [p.id, String(p.arrivalTime), String(p.burstTime), String(p.priority), String(p.completionTime), String(p.turnaroundTime), String(p.waitingTime), String(p.responseTime)];
      }
      return [p.id, String(p.arrivalTime), String(p.burstTime), String(p.completionTime), String(p.turnaroundTime), String(p.waitingTime), String(p.responseTime)];
    });

    // Summary row
    if (reqPriority) {
      tableRows.push(['Average', '-', '-', '-', '-', String(AppState.metrics.avgTAT), String(AppState.metrics.avgWT), String(AppState.metrics.avgRT)]);
    } else {
      tableRows.push(['Average', '-', '-', '-', String(AppState.metrics.avgTAT), String(AppState.metrics.avgWT), String(AppState.metrics.avgRT)]);
    }

    if (doc.autoTable) {
      doc.autoTable({
        startY: currentY,
        head: [tableHeaders],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59],
          halign: 'center'
        },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'left' }
        },
        margin: { left: 14, right: 14 },
        didParseCell: function (data) {
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [226, 232, 240];
            data.cell.styles.textColor = [15, 23, 42];
          }
        }
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }

    // 5. Timeline / Gantt Schedule Sequence
    if (AppState.simulationTimeline && AppState.simulationTimeline.length > 0) {
      if (currentY > 235) {
        doc.addPage();
        currentY = 20;
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('4. Execution Timeline Schedule', 14, currentY);

      currentY += 4;
      const timelineRows = AppState.simulationTimeline.map((item, idx) => [
        `#${idx + 1}`,
        `[${item.startTime} -> ${item.endTime}]`,
        `${item.endTime - item.startTime} units`,
        item.processId === 'IDLE' ? 'CPU Idle' : item.processId,
        item.processId === 'IDLE' ? 'Idle Time' : 'Execution'
      ]);

      if (doc.autoTable) {
        doc.autoTable({
          startY: currentY,
          head: [['Step', 'Time Interval', 'Duration', 'Process / State', 'Type']],
          body: timelineRows,
          theme: 'grid',
          headStyles: {
            fillColor: [71, 85, 105],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center'
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [51, 65, 85],
            halign: 'center'
          },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 8;
      }
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`CPU Scheduling Simulator  |  Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`CPU_Schedule_${AppState.selectedAlgorithm}_Report.pdf`);
    showToast('Simulation report downloaded as PDF.', 'success');
  } catch (err) {
    console.error('Failed to export PDF:', err);
    showToast('Could not generate PDF. Opening print dialog as fallback.', 'warning');
    window.print();
  }
}

/* ==========================================================================
   Event Listeners & Utilities
   ========================================================================== */

function setupEventListeners() {
  // Algorithm selection radio cards
  const radios = document.querySelectorAll('input[name="algoRadio"]');
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      selectAlgorithm(e.target.value);
    });
  });

  // Time Quantum input
  const tqInput = document.getElementById('timeQuantumInput');
  if (tqInput) {
    tqInput.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0) {
        AppState.timeQuantum = val;
        resetSimulationState();
      }
    });
  }

  // Speed selector
  const speedSelect = document.getElementById('simSpeedSelect');
  if (speedSelect) {
    speedSelect.addEventListener('change', (e) => {
      AppState.simulationSpeed = parseInt(e.target.value, 10);
      if (AppState.isSimulating && !AppState.isPaused) {
        restartSimulation();
      }
    });
  }
}

function getAlgorithmName(key) {
  const map = {
    'FCFS': 'First Come First Serve (FCFS)',
    'SJF_NP': 'Shortest Job First (SJF Non-Preemptive)',
    'SRTF': 'Shortest Remaining Time First (SRTF)',
    'PRIORITY_NP': 'Priority (Non-Preemptive)',
    'PRIORITY_P': 'Priority (Preemptive)',
    'RR': `Round Robin (q = ${AppState.timeQuantum})`
  };
  return map[key] || key;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toastId = 'toast-' + Date.now();
  const iconMap = {
    'success': 'bi-check-circle-fill',
    'danger': 'bi-exclamation-triangle-fill',
    'warning': 'bi-exclamation-circle-fill',
    'info': 'bi-info-circle-fill'
  };
  const icon = iconMap[type] || 'bi-info-circle';

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${type} border-0 show shadow-lg mb-2`;
  toastEl.id = toastId;
  toastEl.role = 'alert';
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${icon} fs-5"></i>
        <span>${escapeHtml(message)}</span>
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.toast').remove()"></button>
    </div>
  `;

  container.appendChild(toastEl);
  setTimeout(() => {
    if (toastEl && toastEl.parentNode) toastEl.remove();
  }, 4000);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}
