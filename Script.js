const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
const container = document.getElementById('graph-container');
const eqList = document.getElementById('eq-list');
const promptInput = document.getElementById('ai-prompt');
const generateBtn = document.getElementById('generate-btn');
const statusText = document.getElementById('ai-status');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

const colors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'];
let equations = [];
let scale = 50;
let offsetX = 0;
let offsetY = 0;

function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

promptInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); generateAiShape(); }
});

function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    if (offsetX === 0 && offsetY === 0) {
        offsetX = canvas.width / 2;
        offsetY = canvas.height / 2;
    }
    draw();
}
window.addEventListener('resize', resizeCanvas);

function addEquation(initialMath = '') {
    const id = Date.now() + Math.random();
    const color = colors[equations.length % colors.length];

    const row = document.createElement('div');
    row.className = 'equation-row';
    row.id = `row-${id}`;
    row.innerHTML = `
                <div class="color-dot" style="background-color: ${color};"></div>
                <div class="math-input-container">
                    <input type="text" class="math-input" placeholder="e.g. y = x^2, x = y^2, or 5*5" value="${initialMath}">
                    <span class="eval-result" id="eval-${id}"></span>
                </div>
                <button class="delete-btn" onclick="deleteEquation(${id})" title="Delete equation">✕</button>
            `;

    const input = row.querySelector('.math-input');
    input.addEventListener('input', () => { handleRowEvaluation(id, input.value); draw(); });

    eqList.appendChild(row);
    equations.push({ id, element: input, color, type: 'graph' });

    handleRowEvaluation(id, initialMath);
    input.focus();
    draw();
}

function deleteEquation(id) {
    equations = equations.filter(eq => eq.id !== id);
    const row = document.getElementById(`row-${id}`);
    if (row) row.remove();
    draw();
}

function handleRowEvaluation(id, text) {
    const cleanText = text.replace(/\s+/g, '').toLowerCase();
    const resultSpan = document.getElementById(`eval-${id}`);
    const eqIndex = equations.findIndex(eq => eq.id === id);

    if (eqIndex === -1) return;

    if (!cleanText.includes('x') && !cleanText.includes('y') && cleanText.length > 0) {
        try {
            const parsedExpr = parseMathText(cleanText);
            const evalFunc = new Function('return ' + parsedExpr);
            const val = evalFunc();
            if (typeof val === 'number' && !isNaN(val)) {
                resultSpan.innerText = `= ${Math.round(val * 10000) / 10000}`;
                equations[eqIndex].type = 'eval';
                return;
            }
        } catch(e) {}
    }

    resultSpan.innerText = '';
    equations[eqIndex].type = 'graph';
}

function parseMathText(expr) {
    let parsed = expr.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/(\d)([xXyY\(a-zA-Z])/g, '$1*$2')
        .replace(/([xXyY\)])(\d)/g, '$1*$2')
        .replace(/\^/g, '**')
        .replace(/pi|π/g, 'Math.PI')
        .replace(/\be\b/g, 'Math.E')
        .replace(/\babs\b/g, 'Math.abs')
        .replace(/\bacos\b/g, 'Math.acos')
        .replace(/\basin\b/g, 'Math.asin')
        .replace(/\batan\b/g, 'Math.atan')
        .replace(/\bsin\b/g, 'Math.sin')
        .replace(/\bcos\b/g, 'Math.cos')
        .replace(/\btan\b/g, 'Math.tan')
        .replace(/\bsqrt\b/g, 'Math.sqrt')
        .replace(/\blog\b/g, 'Math.log10')
        .replace(/\bln\b/g, 'Math.log');
    return parsed;
}

// --- NEW: THE LATEX TRANSLATOR ---
// Converts standard raw math text into Desmos-approved LaTeX
function textToLatex(text) {
    let latex = text.toLowerCase();

    // Helper function to handle wrapping components (like sqrt(x) -> \sqrt{x})
    function replaceWithBraces(str, funcName, prefix, suffix) {
        let res = str;
        let searchStr = funcName + '(';
        while (res.includes(searchStr)) {
            let start = res.indexOf(searchStr);
            let open = 0;
            let end = -1;
            // Count parentheses to find the closing bracket
            for (let i = start + funcName.length; i < res.length; i++) {
                if (res[i] === '(') open++;
                if (res[i] === ')') {
                    open--;
                    if (open === 0) { end = i; break; }
                }
            }
            if (end !== -1) {
                res = res.substring(0, start) + prefix + res.substring(start + searchStr.length, end) + suffix + res.substring(end + 1);
            } else {
                res = res.replace(searchStr, prefix); // Fallback to break loop
                break;
            }
        }
        return res;
    }

    // Convert nested structures
    latex = replaceWithBraces(latex, 'sqrt', '\\sqrt{', '}');
    latex = replaceWithBraces(latex, 'abs', '\\left|', '\\right|');
    latex = replaceWithBraces(latex, '^', '^{', '}');

    // Prepend a backslash to all mathematical functions so Desmos registers them properly
    const funcs = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'pi'];
    funcs.forEach(f => {
        latex = latex.replace(new RegExp('\\b' + f + '\\b', 'g'), '\\' + f);
    });

    // Replace standard asterisks with the LaTeX multiplication dot
    latex = latex.replace(/\*/g, '\\cdot ');

    return latex;
}

// --- EXPORT TO ACTUAL DESMOS ---
let actualDesmosCalc = null;
let isDesmosScriptLoaded = false;

function exportToDesmos() {
    const validEquations = equations
        .filter(eq => eq.type === 'graph' && eq.element.value.trim() !== '')
        .map(eq => textToLatex(eq.element.value.trim())); // <-- Translation Magic Happens Here!

    if (validEquations.length === 0) {
        alert("Please add some valid equations to the graph first!");
        return;
    }

    if (sidebar.classList.contains('open')) toggleSidebar();
    document.getElementById('desmos-wrapper').style.display = 'block';

    if (!isDesmosScriptLoaded) {
        const script = document.createElement('script');
        script.src = "https://www.desmos.com/api/v1.8/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";
        script.onload = () => {
            isDesmosScriptLoaded = true;
            initActualDesmos(validEquations);
        };
        document.head.appendChild(script);
    } else {
        initActualDesmos(validEquations);
    }
}

function initActualDesmos(eqs) {
    const elt = document.getElementById('actual-desmos-engine');
    if (!actualDesmosCalc) {
        actualDesmosCalc = Desmos.GraphingCalculator(elt, { expressions: true, settingsMenu: true });
    } else {
        actualDesmosCalc.setBlank();
    }
    eqs.forEach((eq, index) => {
        actualDesmosCalc.setExpression({ id: 'graph-' + index, latex: eq });
    });
}

function closeActualDesmos() {
    document.getElementById('desmos-wrapper').style.display = 'none';
}

// --- REAL AI GENERATION LOGIC ---
async function generateAiShape() {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    generateBtn.disabled = true;
    generateBtn.innerText = "Thinking...";
    statusText.innerText = "Asking AI to calculate formulas...";
    statusText.style.color = "#8e44ad";

    try {
        const systemInstruction = `You are a mathematical graphing assistant. The user wants to draw: "${prompt}". 
                You must return ONLY a raw JSON array of strings containing mathematical formulas.
                You are allowed to use standard functional formats like "x^2", "y = sin(x)", or "x = y^2" depending on the shape orientation.
                Do not include markdown code blocks. Just the raw array.
                Only use standard arithmetic and these functions: sin, cos, tan, sqrt, abs, acos, asin, atan, log, ln, e, pi. 
                Example output format: ["y = sqrt(25-x^2)", "y = -sqrt(25-x^2)"] or ["x = y^2"]`;

        const response = await puter.ai.chat([
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
        ], { model: "google/gemini-3.5-flash" });

        let aiText = response.message.content;
        aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();

        const newEquations = JSON.parse(aiText);

        eqList.innerHTML = '';
        equations = [];
        newEquations.forEach(eq => addEquation(eq));

        scale = 50; offsetX = canvas.width / 2; offsetY = canvas.height / 2;
        draw();

        statusText.innerText = "Success! Shape generated.";
        statusText.style.color = "#27ae60";

        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            toggleSidebar();
        }

    } catch (error) {
        statusText.innerText = "AI Error: Could not generate shape. Try rephrasing.";
        statusText.style.color = "#e74c3c";
    } finally {
        generateBtn.disabled = false; generateBtn.innerText = "Generate";
    }
}

// --- RENDER LOOP ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.lineWidth = 1; ctx.strokeStyle = '#e0e0e0'; ctx.beginPath();
    let startX = (offsetX % scale) - scale;
    for (let x = startX; x < canvas.width; x += scale) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    let startY = (offsetY % scale) - scale;
    for (let y = startY; y < canvas.height; y += scale) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();

    // Axes
    ctx.lineWidth = 2; ctx.strokeStyle = '#000000'; ctx.beginPath();
    if (offsetY >= 0 && offsetY <= canvas.height) { ctx.moveTo(0, offsetY); ctx.lineTo(canvas.width, offsetY); }
    if (offsetX >= 0 && offsetX <= canvas.width) { ctx.moveTo(offsetX, 0); ctx.lineTo(offsetX, canvas.height); }
    ctx.stroke();

    // Equations
    equations.forEach(eq => {
        if (eq.type !== 'graph') return;

        let rawExpr = eq.element.value.trim().replace(/\s+/g, '').toLowerCase();
        if (!rawExpr) return;

        let mode = 'y_of_x';
        let mathFormula = rawExpr;

        if (rawExpr.startsWith('y=')) { mathFormula = rawExpr.substring(2); }
        else if (rawExpr.startsWith('x=')) { mode = 'x_of_y'; mathFormula = rawExpr.substring(2); }
        else if (rawExpr.includes('=')) { return; }

        const parsedExpr = parseMathText(mathFormula);

        let f;
        try {
            const independentVar = (mode === 'x_of_y') ? 'y' : 'x';
            f = new Function(independentVar, 'return ' + parsedExpr);
            f(0);
        } catch (e) { return; }

        ctx.beginPath(); ctx.strokeStyle = eq.color; ctx.lineWidth = 2.5;
        let firstPoint = true;

        if (mode === 'y_of_x') {
            for (let px = 0; px <= canvas.width; px++) {
                let mathX = (px - offsetX) / scale;
                try {
                    let mathY = f(mathX); let py = offsetY - (mathY * scale);
                    if (isFinite(py)) {
                        if (firstPoint) { ctx.moveTo(px, py); firstPoint = false; } else { ctx.lineTo(px, py); }
                    } else { firstPoint = true; }
                } catch (e) { firstPoint = true; }
            }
        } else if (mode === 'x_of_y') {
            for (let py = 0; py <= canvas.height; py++) {
                let mathY = (offsetY - py) / scale;
                try {
                    let mathX = f(mathY); let px = offsetX + (mathX * scale);
                    if (isFinite(px)) {
                        if (firstPoint) { ctx.moveTo(px, py); firstPoint = false; } else { ctx.lineTo(px, py); }
                    } else { firstPoint = true; }
                } catch (e) { firstPoint = true; }
            }
        }
        ctx.stroke();
    });
}

// --- INTERACTIVITY ---
let isDragging = false; let lastMouseX, lastMouseY;
canvas.addEventListener('mousedown', (e) => { isDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY; });
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) { isDragging = true; lastMouseX = e.touches[0].clientX; lastMouseY = e.touches[0].clientY; }
});
window.addEventListener('mouseup', () => { isDragging = false; });
window.addEventListener('touchend', () => { isDragging = false; });

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    offsetX += e.clientX - lastMouseX; offsetY += e.clientY - lastMouseY;
    lastMouseX = e.clientX; lastMouseY = e.clientY; draw();
});

canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    offsetX += e.touches[0].clientX - lastMouseX; offsetY += e.touches[0].clientY - lastMouseY;
    lastMouseX = e.touches[0].clientX; lastMouseY = e.touches[0].clientY; draw();
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9; scale *= zoomFactor;
    const mouseX = e.clientX - canvas.getBoundingClientRect().left; const mouseY = e.clientY - canvas.getBoundingClientRect().top;
    offsetX = mouseX - (mouseX - offsetX) * zoomFactor; offsetY = mouseY - (mouseY - offsetY) * zoomFactor; draw();
});

resizeCanvas();
addEquation('sqrt(25 - x^2)');
addEquation('-sqrt(25 - x^2)');