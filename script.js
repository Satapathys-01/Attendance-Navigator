let appState = {
    studentName: "", collegeName: "", targetPercentage: 75, calcMode: "future",
    startDate: "", endDate: "", workingDays: [1, 2, 3, 4, 5], holidays: [], historyStates: {}
};

document.addEventListener("DOMContentLoaded", () => {
    loadProgressFromLocalStorage();
    registerDOMEventListeners();
    evaluateRenderCalendarView();
});

function registerDOMEventListeners() {
    document.getElementById("student-name").addEventListener("input", (e) => { appState.studentName = e.target.value.trim(); saveProgressToLocalStorage(); });
    document.getElementById("college-name").addEventListener("input", (e) => { appState.collegeName = e.target.value.trim(); saveProgressToLocalStorage(); });
    const pctInput = document.getElementById("target-percentage");
    pctInput.addEventListener("input", (e) => { appState.targetPercentage = parseFloat(e.target.value) || 0; saveProgressToLocalStorage(); });

    document.querySelectorAll(".quick-pct").forEach(btn => {
        btn.addEventListener("click", () => {
            const val = btn.getAttribute("data-value");
            pctInput.value = val;
            appState.targetPercentage = parseFloat(val);
            highlightActivePercentageButton(val);
            saveProgressToLocalStorage();
        });
    });

    document.querySelectorAll('input[name="calc-mode"]').forEach(radio => {
        radio.addEventListener("change", (e) => { appState.calcMode = e.target.value; evaluateRenderCalendarView(); saveProgressToLocalStorage(); });
    });

    document.getElementById("start-date").addEventListener("change", (e) => { appState.startDate = e.target.value; validateDateSequencing(); evaluateRenderCalendarView(); saveProgressToLocalStorage(); });
    document.getElementById("end-date").addEventListener("change", (e) => { appState.endDate = e.target.value; validateDateSequencing(); evaluateRenderCalendarView(); saveProgressToLocalStorage(); });

    document.querySelectorAll(".working-day-chk").forEach(chk => {
        chk.addEventListener("change", () => {
            const val = parseInt(chk.value);
            const labelWrapper = document.getElementById(`lbl-working-${val}`);
            
            if (chk.checked) { 
                if (!appState.workingDays.includes(val)) appState.workingDays.push(val);
                if (labelWrapper) labelWrapper.classList.add("is-active");
            } else { 
                appState.workingDays = appState.workingDays.filter(d => d !== val);
                if (labelWrapper) labelWrapper.classList.remove("is-active");
            }
            evaluateRenderCalendarView(); 
            saveProgressToLocalStorage();
        });
    });

    document.getElementById("add-single-holiday-btn").addEventListener("click", addSingleHolidayItem);
    document.getElementById("add-range-holiday-btn").addEventListener("click", addRangeHolidayItem);
    document.getElementById("generate-btn").addEventListener("click", processAttendanceStrategyCalculations);
    document.getElementById("reset-btn").addEventListener("click", clearAllApplicationStateData);
    document.getElementById("export-pdf-btn").addEventListener("click", executeExportToPDFReport);
}

function highlightActivePercentageButton(val) {
    document.querySelectorAll(".quick-pct").forEach(b => {
        if (b.getAttribute("data-value") === val) b.classList.add("active"); else b.classList.remove("active");
    });
}

function switchHolidayTab(tabType) {
    document.getElementById("tab-single").classList.toggle("active", tabType === 'single');
    document.getElementById("tab-range").classList.toggle("active", tabType === 'range');
    document.getElementById("single-holiday-pane").classList.toggle("active", tabType === 'single');
    document.getElementById("range-holiday-pane").classList.toggle("active", tabType === 'range');
}

function validateDateSequencing() {
    const start = document.getElementById("start-date").value;
    const end = document.getElementById("end-date").value;
    const errorBanner = document.getElementById("error-banner");
    if (start && end && new Date(end) < new Date(start)) {
        errorBanner.innerText = "Error Configuration: End date cannot fall chronologically prior to the defined Start date.";
        errorBanner.classList.remove("hidden"); return false;
    }
    errorBanner.classList.add("hidden"); return true;
}

function addSingleHolidayItem() {
    const nameInput = document.getElementById("single-holiday-name");
    const dateInput = document.getElementById("single-holiday-date");
    if (!dateInput.value) { alert("Please define a valid holiday date."); return; }
    appState.holidays.push({ id: "hol_" + Date.now(), name: nameInput.value.trim() || "Single Day Holiday", type: "single", start: dateInput.value, end: dateInput.value });
    nameInput.value = ""; dateInput.value = ""; renderHolidayConfigurationList(); evaluateRenderCalendarView(); saveProgressToLocalStorage();
}

function addRangeHolidayItem() {
    const nameInput = document.getElementById("range-holiday-name");
    const startInput = document.getElementById("range-start-date");
    const endInput = document.getElementById("range-end-date");
    if (!startInput.value || !endInput.value) { alert("Range elements require dynamic boundary inputs."); return; }
    if (new Date(endInput.value) < new Date(startInput.value)) { alert("Boundary conflict logic exception."); return; }
    appState.holidays.push({ id: "hol_" + Date.now(), name: nameInput.value.trim() || "Holiday Range Break", type: "range", start: startInput.value, end: endInput.value });
    nameInput.value = ""; startInput.value = ""; endInput.value = ""; renderHolidayConfigurationList(); evaluateRenderCalendarView(); saveProgressToLocalStorage();
}

function deleteHolidayEntry(id) {
    appState.holidays = appState.holidays.filter(h => h.id !== id);
    renderHolidayConfigurationList(); evaluateRenderCalendarView(); saveProgressToLocalStorage();
}

function renderHolidayConfigurationList() {
    const container = document.getElementById("holiday-list"); container.innerHTML = "";
    if (appState.holidays.length === 0) { container.innerHTML = `<li class="holiday-item" style="color:var(--text-muted);">No manual excluded dates declared.</li>`; return; }
    appState.holidays.forEach(h => {
        const li = document.createElement("li"); li.className = "holiday-item";
        li.innerHTML = `<span><strong>${h.name}</strong>: ${h.type === 'single' ? h.start : h.start + ' to ' + h.end}</span><button class="delete-holiday-btn" onclick="deleteHolidayEntry('${h.id}')">Remove</button>`;
        container.appendChild(li);
    });
}

function checkIsHolidayDate(dateString) {
    const targetTime = new Date(dateString).getTime();
    return appState.holidays.some(h => targetTime >= new Date(h.start).getTime() && targetTime <= new Date(h.end).getTime());
}

function evaluateRenderCalendarView() {
    const renderArea = document.getElementById("calendar-render-area");
    const instruction = document.getElementById("calendar-instruction");
    if (!appState.startDate || !appState.endDate || !validateDateSequencing()) { renderArea.innerHTML = ""; instruction.classList.remove("hidden"); return; }
    instruction.classList.add("hidden"); renderArea.innerHTML = "";
    let monthlySegments = {}; let cursor = new Date(appState.startDate); let endObj = new Date(appState.endDate);
    while (cursor <= endObj) {
        const y = cursor.getFullYear(), m = cursor.getMonth(), k = `${y}-${m}`;
        if (!monthlySegments[k]) monthlySegments[k] = { year: y, month: m, days: [] };
        monthlySegments[k].days.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1);
    }
    const todayStr = formatDateToISOString(new Date());
    for (let mKey in monthlySegments) {
        const seg = monthlySegments[mKey], monthContainer = document.createElement("div"); monthContainer.className = "month-container";
        const titleEl = document.createElement("div"); titleEl.className = "month-title"; titleEl.innerText = `${new Date(seg.year, seg.month, 1).toLocaleString('default', { month: 'long' })} ${seg.year}`; monthContainer.appendChild(titleEl);
        const gridEl = document.createElement("div"); gridEl.className = "calendar-grid";
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(d => { const wh = document.createElement("div"); wh.className = "weekday-header"; wh.innerText = d; gridEl.appendChild(wh); });
        let startOffset = seg.days[0].getDay() === 0 ? 6 : seg.days[0].getDay() - 1;
        for (let i = 0; i < startOffset; i++) { const ec = document.createElement("div"); ec.className = "calendar-day empty"; gridEl.appendChild(ec); }
        seg.days.forEach(dayDate => {
            const cellStr = formatDateToISOString(dayDate), dayCell = document.createElement("div"); dayCell.className = "calendar-day"; dayCell.innerText = dayDate.getDate();
            if (cellStr === todayStr) dayCell.classList.add("today-marker");
            const isWorking = appState.workingDays.includes(dayDate.getDay()), isHoliday = checkIsHolidayDate(cellStr);
            if (isHoliday) dayCell.classList.add("holiday-day");
            else if (!isWorking) dayCell.classList.add("non-working");
            else {
                if (appState.calcMode === "future") dayCell.classList.add("future-sched");
                else {
                    if (cellStr <= todayStr) {
                        if (!appState.historyStates[cellStr]) appState.historyStates[cellStr] = "unmarked";
                        applyHistoryStateVisualClasses(dayCell, appState.historyStates[cellStr]);
                        dayCell.addEventListener("click", () => cycleHistoryStateToggle(cellStr, dayCell));
                    } else dayCell.classList.add("future-sched");
                }
            }
            gridEl.appendChild(dayCell);
        });
        monthContainer.appendChild(gridEl); renderArea.appendChild(monthContainer);
    }
}

function applyHistoryStateVisualClasses(el, st) {
    el.classList.remove("unmarked-past", "attended-past", "absent-past");
    if (st === "attended") el.classList.add("attended-past"); else if (st === "absent") el.classList.add("absent-past"); else el.classList.add("unmarked-past");
}

function cycleHistoryStateToggle(k, el) {
    const curr = appState.historyStates[k] || "unmarked";
    const nxt = curr === "unmarked" ? "attended" : (curr === "attended" ? "absent" : "unmarked");
    appState.historyStates[k] = nxt; applyHistoryStateVisualClasses(el, nxt); saveProgressToLocalStorage();
}

function processAttendanceStrategyCalculations() {
    const eb = document.getElementById("error-banner");
    if (!appState.studentName) { eb.innerText = "Validation Exception: Student Name field cannot be empty."; eb.classList.remove("hidden"); return; }
    if (!appState.targetPercentage || appState.targetPercentage <= 0 || appState.targetPercentage > 100) { eb.innerText = "Validation Exception: Enter target within 1% to 100%."; eb.classList.remove("hidden"); return; }
    if (!appState.startDate || !appState.endDate || !validateDateSequencing()) { eb.innerText = "Validation Exception: Define timeline metrics parameters."; eb.classList.remove("hidden"); return; }
    if (appState.workingDays.length === 0) { eb.innerText = "Validation Exception: Select working framework days."; eb.classList.remove("hidden"); return; }
    eb.classList.add("hidden");
    
    let tWork = 0, pCond = 0, pAtt = 0, pAbs = 0, pUnm = 0, fWork = 0;
    let futureDatesList = [];
    let cursor = new Date(appState.startDate), endObj = new Date(appState.endDate), todayStr = formatDateToISOString(new Date());
    
    while (cursor <= endObj) {
        const cStr = formatDateToISOString(cursor);
        if (appState.workingDays.includes(cursor.getDay()) && !checkIsHolidayDate(cStr)) {
            tWork++;
            if (appState.calcMode === "current") {
                if (cStr <= todayStr) {
                    pCond++; const h = appState.historyStates[cStr] || "unmarked";
                    if (h === "attended") pAtt++; else if (h === "absent") pAbs++; else pUnm++;
                } else {
                    fWork++;
                    futureDatesList.push(new Date(cursor));
                }
            } else {
                fWork++;
                futureDatesList.push(new Date(cursor));
            }
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    
    let cPct = pCond > 0 ? (pAtt / pCond) * 100 : 0;
    let totalBasis = appState.calcMode === "current" ? pCond + fWork : fWork;
    let minFut = Math.max(0, Math.ceil((appState.targetPercentage / 100) * totalBasis) - (appState.calcMode === "current" ? pAtt : 0));
    let maxAbs = Math.max(0, Math.floor(((1 - (appState.targetPercentage / 100)) * totalBasis) - (appState.calcMode === "current" ? pAbs : 0)));
    let proj = appState.calcMode === "current" ? ((pAtt + fWork) / totalBasis) * 100 : 100;

    document.getElementById("res-student").innerText = appState.studentName;
    document.getElementById("res-college").innerText = appState.collegeName || "Not Provided";
    document.getElementById("res-target").innerText = `${appState.targetPercentage}%`;
    document.getElementById("res-timeline").innerText = `${appState.startDate} to ${appState.endDate}`;
    document.getElementById("res-weekdays").innerText = appState.workingDays.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ");
    document.getElementById("res-holidays").innerText = appState.holidays.length;
    document.getElementById("res-effective").innerText = tWork;

    if (appState.calcMode === "current") {
        document.getElementById("res-current-section").classList.remove("hidden");
        document.getElementById("res-conducted").innerText = pCond; document.getElementById("res-attended").innerText = pAtt;
        document.getElementById("res-current-pct").innerText = `${cPct.toFixed(1)}%`;
        document.getElementById("res-current-pct").className = cPct >= appState.targetPercentage ? "val text-success" : "val text-danger";
    } else document.getElementById("res-current-section").classList.add("hidden");

    document.getElementById("res-remaining").innerText = fWork; document.getElementById("res-min-required").innerText = minFut;
    document.getElementById("res-max-absences").innerText = maxAbs; document.getElementById("res-projected").innerText = `${proj.toFixed(1)}%`;

    generateSkipOptimizerInsights(maxAbs, futureDatesList);
    generateHumanReadableInsightsEngine(cPct, minFut, maxAbs, fWork, totalBasis, pUnm);
    
    document.getElementById("results-panel").classList.remove("hidden");
    document.getElementById("results-panel").scrollIntoView({ behavior: 'smooth' });
}

function generateSkipOptimizerInsights(maxAbsences, futureDates) {
    const skipOut = document.getElementById("skip-optimizer-output");
    skipOut.innerHTML = "";
    let html = "";

    if (maxAbsences <= 0) {
        html = `<div class="rec-item danger"><strong>Optimization Suspended:</strong> You have 0 allowable absences remaining. Missing any scheduled session right now will drop you below your defined target threshold.</div>`;
        skipOut.innerHTML = html;
        return;
    }

    let tacticalSuggestions = [];
    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (let i = 0; i < futureDates.length; i++) {
        let current = futureDates[i];
        let currentDayIdx = current.getDay();
        
        let prevDay = new Date(current); prevDay.setDate(prevDay.getDate() - 1);
        let nextDay = new Date(current); nextDay.setDate(nextDay.getDate() + 1);

        let prevIsOff = !appState.workingDays.includes(prevDay.getDay()) || checkIsHolidayDate(formatDateToISOString(prevDay));
        let nextIsOff = !appState.workingDays.includes(nextDay.getDay()) || checkIsHolidayDate(formatDateToISOString(nextDay));

        if (prevIsOff && nextIsOff) {
            tacticalSuggestions.push({
                date: new Date(current),
                reason: `<strong>Sandwich Day Alert:</strong> ${current.toLocaleDateString('default', {month:'short', day:'numeric'})} (${weekdayNames[currentDayIdx]}) lies perfectly between two days off. Skipping this creates a 3-day continuous break.`,
                priority: 3
            });
            continue; 
        }

        if (currentDayIdx === 1) { 
            if (!appState.workingDays.includes(6) || !appState.workingDays.includes(0)) {
                tacticalSuggestions.push({
                    date: new Date(current),
                    reason: `<strong>Long Weekend Blueprint:</strong> Skipping Monday, ${current.toLocaleDateString('default', {month:'short', day:'numeric'})} chain-links into your weekend to provide an un-interrupted block of time off.`,
                    priority: 2
                });
                continue;
            }
        }
        if (currentDayIdx === 5) { 
            if (!appState.workingDays.includes(6) || !appState.workingDays.includes(0)) {
                tacticalSuggestions.push({
                    date: new Date(current),
                    reason: `<strong>Early Weekend Activation:</strong> Skipping Friday, ${current.toLocaleDateString('default', {month:'short', day:'numeric'})} extends your upcoming weekend backward for maximum recovery.`,
                    priority: 2
                });
                continue;
            }
        }
    }

    tacticalSuggestions.sort((a,b) => b.priority - a.priority);
    let allowedSuggestions = tacticalSuggestions.slice(0, Math.min(maxAbsences, 3));

    if (allowedSuggestions.length > 0) {
        html += `<div class="rec-item success" style="border-left-color: var(--accent-purple);"><strong>Optimization Analysis:</strong> You can safely afford to drop up to <strong>${maxAbsences}</strong> future class slots. Here are the highest efficiency slots to skip to get maximum physical rest:</div>`;
        allowedSuggestions.forEach(s => {
            html += `<div class="rec-item info" style="margin-left: 20px;">${s.reason}</div>`;
        });
    } else {
        let genericBestDay = futureDates[0];
        if (genericBestDay) {
            html += `<div class="rec-item warning"><strong>Standard Strategy:</strong> No geometric sandwich gaps found. If you need a break, the earliest low-impact date to use one of your <strong>${maxAbsences}</strong> safe absences is <strong>${genericBestDay.toLocaleDateString('default', {month:'long', day:'numeric'})} (${weekdayNames[genericBestDay.getDay()]})</strong>.</div>`;
        }
    }

    skipOut.innerHTML = html;
}

function generateHumanReadableInsightsEngine(cPct, minFut, maxAbs, fWork, totalBasis, pUnm) {
    const out = document.getElementById("recommendation-output"); out.innerHTML = ""; let html = "";
    if (appState.calcMode === "current") {
        html += `<div class="rec-item info">You currently have a recorded tracking level baseline of <strong>${cPct.toFixed(1)}%</strong> attendance over the historical timeline tracked.</div>`;
        if (pUnm > 0) html += `<div class="rec-item warning">Attention Required: There are <strong>${pUnm}</strong> historically active days in your tracker calendar that remain unmarked. Correct these entries for optimal mathematical precision.</div>`;
    }
    if (minFut > fWork) html += `<div class="rec-item danger"><strong>Critical Threshold Deficit Alert:</strong> Mathematically Impossible Outcome. To secure your defined goal requirement of ${appState.targetPercentage}%, you are calculated to need <strong>${minFut}</strong> attendances, but only <strong>${fWork}</strong> total sessions remain on the schedule timeline parameters.</div>`;
    else if (minFut === 0) html += `<div class="rec-item success"><strong>Strategic Objective Achieved:</strong> Your historical attendance balances are exceptionally healthy. Even if you encounter dynamic attendance tracking variability, your target thresholds are secure. You can safely sustain up to <strong>${maxAbs}</strong> future absences without dropping below your target.</div>`;
    else {
        html += `<div class="rec-item warning">To successfully reach your mandatory target of <strong>${appState.targetPercentage}%</strong>, you must satisfy a strict target requirement to attend at least <strong>${minFut}</strong> future scheduled classes.</div>`;
        html += maxAbs > 0 ? `<div class="rec-item success">Strategic Flexibility Factor: Under current operational boundaries, you retain a maximum buffer safety allowance to miss up to <strong>${maxAbs}</strong> classes without violating targets.</div>` : `<div class="rec-item danger">Zero Margin Policy Warning: You possess <strong>0</strong> allowable future absences. Perfect continuous attendance execution is now operationalized. Any further missed classes will push you below your target threshold.</div>`;
    }
    if (appState.holidays.filter(h => h.type === "range").length > 0) {
        const fr = appState.holidays.filter(h => h.type === "range")[0];
        html += `<div class="rec-item info"><strong>Strategic Academic Intermission Advisory:</strong> Because you declared an active holiday range break schedule matching <em>"${fr.name}"</em> from ${fr.start} to ${fr.end}, strictly optimize your schedule around these dates to avoid compound absences during instructional weeks.</div>`;
    }
    out.innerHTML = html;
}

function saveProgressToLocalStorage() { localStorage.setItem("attendance_navigator_state_2026", JSON.stringify(appState)); }
// Restore system states configurations logic loop properties on startup layouts
function loadProgressFromLocalStorage() {
    const raw = localStorage.getItem("attendance_navigator_state_2026"); if (!raw) return;
    try {
        const p = JSON.parse(raw); if (!p || typeof p !== "object") return; appState = { ...appState, ...p };
        document.getElementById("student-name").value = appState.studentName || ""; document.getElementById("college-name").value = appState.collegeName || "";
        document.getElementById("target-percentage").value = appState.targetPercentage || ""; highlightActivePercentageButton(appState.targetPercentage.toString());
        document.querySelectorAll('input[name="calc-mode"]').forEach(r => { if (r.value === appState.calcMode) r.checked = true; });
        document.getElementById("start-date").value = appState.startDate || ""; document.getElementById("end-date").value = appState.endDate || "";
        
        document.querySelectorAll(".working-day-chk").forEach(c => {
            const activeVal = parseInt(c.value);
            const isChecked = appState.workingDays.includes(activeVal);
            c.checked = isChecked;
            const labelWrapper = document.getElementById(`lbl-working-${activeVal}`);
            if (labelWrapper) labelWrapper.classList.toggle("is-active", isChecked);
        });
        renderHolidayConfigurationList();
    } catch (e) { console.error(e); }
}

function clearAllApplicationStateData() {
    if (confirm("Clear all data elements?")) {
        localStorage.removeItem("attendance_navigator_state_2026");
        appState = { studentName: "", collegeName: "", targetPercentage: 75, calcMode: "future", startDate: "", endDate: "", workingDays: [1, 2, 3, 4, 5], holidays: [], historyStates: {} };
        location.reload();
    }
}

function executeExportToPDFReport() {
    const targetElement = document.getElementById("report-content");
    const printClone = targetElement.cloneNode(true);
    printClone.classList.add("pdf-printing-active");
    
    const wrapper = document.createElement("div");
    wrapper.style.backgroundColor = "#000000";
    wrapper.style.padding = "20px";
    wrapper.appendChild(printClone);
    document.body.appendChild(wrapper);

    const optimizationOptions = {
        margin:       [12, 10, 12, 10],
        filename:     `Attendance_Navigator_Strategy_Report_${appState.studentName.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: "#000000", scrollY: 0, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css'] }
    };

    html2pdf().set(optimizationOptions).from(wrapper).toContainer().toCanvas().toImg().toPdf().save().then(() => {
        document.body.removeChild(wrapper);
    }).catch((err) => {
        console.error("PDF execution exception:", err);
        document.body.removeChild(wrapper);
    });
}

function formatDateToISOString(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }