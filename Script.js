const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
const container = document.getElementById('graph-container');
const eqList = document.getElementById('eq-list');
const promptInput = document.getElementById('ai-prompt');
const generateBtn = document.getElementById('generate-btn');
const statusText = document.getElementById('ai-status');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

const defaultColors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'];
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

function normalizeColor(c) {
    if (!c) return null;
    let colorStr = c.trim();
    if (/^[0-9A-Fa-f]{6}$/.test(colorStr) || /^[0-9A-Fa-f]{3}$/.test(colorStr)) {
        colorStr = '#' + colorStr;
    }
    const tempCtx = document.createElement('canvas').getContext('2d');
    tempCtx.fillStyle = colorStr;
    return tempCtx.fillStyle;
}

function addEquation(initialMath = '', specificColor = null) {
    const id = Date.now() + Math.random();
    let color = specificColor ? normalizeColor(specificColor) : defaultColors[equations.length % defaultColors.length];

    const row = document.createElement('div');
    row.className = 'equation-row';
    row.id = `row-${id}`;
    row.innerHTML = `
                <div class="color-picker-wrapper" id="color-wrap-${id}" style="background-color: ${color};">
                    <input type="color" class="color-picker" id="color-${id}" value="${color}">
                </div>
                <div class="math-input-container">
                    <input type="text" class="math-input" placeholder="e.g. x^2+y^2 <= 10 {x > 0}" value="${initialMath}">
                    <span class="eval-result" id="eval-${id}"></span>
                </div>
                <button class="delete-btn" onclick="deleteEquation(${id})" title="Delete equation">✕</button>
            `;

    const input = row.querySelector('.math-input');
    const colorPicker = row.querySelector('.color-picker');

    input.addEventListener('input', () => { handleRowEvaluation(id, input.value); draw(); });

    colorPicker.addEventListener('input', (event) => {
        const eq = equations.find(item => item.id === id);
        if (eq) {
            eq.color = event.target.value;
            document.getElementById(`color-wrap-${id}`).style.backgroundColor = event.target.value;
        }
        draw();
    });

    eqList.appendChild(row);
    equations.push({ id, element: input, color: color, type: 'graph' });

    handleRowEvaluation(id, initialMath);
    if (!specificColor) input.focus();
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
    const resultSpan = document.getElementById('eval-' + id);
    const eqIndex = equations.findIndex(eq => eq.id === id);
    if (eqIndex === -1 || !resultSpan) return;

    const cleanMathOnly = cleanText.replace(/\{[^}]+\}/g, '');

    if (!cleanMathOnly.includes('x') && !cleanMathOnly.includes('y') && cleanMathOnly.length > 0) {
        try {
            const parsedExpr = parseMathText(cleanMathOnly);
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

function textToLatex(text) {
    let latex = text.toLowerCase();
    function replaceWithBraces(str, funcName, prefix, suffix) {
        let res = str;
        let searchStr = funcName + '(';
        while (res.includes(searchStr)) {
            let start = res.indexOf(searchStr);
            let open = 0, end = -1;
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
                res = res.replace(searchStr, prefix); break;
            }
        }
        return res;
    }

    latex = replaceWithBraces(latex, 'sqrt', '\\sqrt{', '}');
    latex = replaceWithBraces(latex, 'abs', '\\left|', '\\right|');
    latex = replaceWithBraces(latex, '^', '^{', '}');

    const funcs = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'pi'];
    funcs.forEach(f => { latex = latex.replace(new RegExp('\\b' + f + '\\b', 'g'), '\\' + f); });

    latex = latex.replace(/>=/g, '\\ge ').replace(/<=/g, '\\le ');
    latex = latex.replace(/\*/g, '\\cdot ');
    latex = latex.replace(/\{/g, '\\left\\{').replace(/\}/g, '\\right\\}');

    return latex;
}

function getRGB(hex) {
    let rgb = [0, 0, 0];
    let hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (hexMatch) rgb = [parseInt(hexMatch[1], 16), parseInt(hexMatch[2], 16), parseInt(hexMatch[3], 16)];
    return rgb;
}

// --- EXPORT TO ACTUAL DESMOS ---
let actualDesmosCalc = null;
let isDesmosScriptLoaded = false;

function exportToDesmos() {
    const validEquations = equations
        .filter(eq => eq.type === 'graph' && eq.element.value.trim() !== '')
        .map(eq => ({
            latex: textToLatex(eq.element.value.trim()),
            color: eq.color
        }));

    if (validEquations.length === 0) {
        alert("Please add some valid equations to the graph first!");
        return;
    }

    if (sidebar.classList.contains('open')) toggleSidebar();

    // FIXED BUG: Changed from style.zindex to style.display so overlay opens correctly!
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
        actualDesmosCalc.setExpression({ id: 'graph-' + index, latex: eq.latex, color: eq.color });
    });
}

function closeActualDesmos() { document.getElementById('desmos-wrapper').style.display = 'none'; }

// --- FIXED AND ENHANCED AI GENERATION ---
async function generateAiShape() {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    generateBtn.disabled = true;
    generateBtn.innerText = "Thinking...";
    statusText.innerText = "Asking AI to calculate formulas...";
    statusText.style.color = "#8e44ad";

    try {
        const systemInstruction = `You are a mathematical graphing assistant. The user wants to draw: "${prompt}".
                CRITICAL RULE: You must return ONLY a raw valid JSON array of objects. Do not include markdown blocks or text conversation.
                Each object must have exactly two properties: 'equation' (string) and 'color' (a strict 7-character hex code starting with #).

                You must actively leverage general graphing capabilities when requested:
                1. Explicit curves: "y = x^2", "x = sin(y)"
                2. Implicit shapes/Circles/Conics: "x^2 + y^2 = 9"
                3. Shaded Regions / Inequalities: Use strict symbols like "x^2 + y^2 < 10", "y >= x^2", or "y < sin(x)".
                4. Domain Boundaries: Add conditional clipping bounds at the end using brackets like "y = x^2 {x < 2}" or "x^2 + y^2 <= 16 {x > 0}".
                If multiple conditions apply, chain brackets: "{x > 0}{y < 3}". Do not join expressions inside a single bracket like "{0 < x < 5}".

                Example output format:
                [{"equation": "x^2 + y^2 < 10", "color": "#2d70b3"}, {"equation": "y = x^2 {x < 2}", "color": "#c74440"}]`;

        const response = await puter.ai.chat([
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
        ]);

        // FIXED BUG: Safe unwrap engine dynamically intercepts any string or nested object layout Puter throws back
        let aiText = '';
        if (typeof response === 'string') {
            aiText = response;
        } else if (response && response.message && response.message.content) {
            aiText = response.message.content;
        } else if (response && response.text) {
            aiText = response.text;
        } else {
            aiText = JSON.stringify(response);
        }

        // Isolate JSON block arrays securely
        const arrayMatch = aiText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
            aiText = arrayMatch[0];
        } else {
            aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        const newEquations = JSON.parse(aiText);

        eqList.innerHTML = '';
        equations = [];
        newEquations.forEach(item => addEquation(item.equation, item.color));

        scale = 50; offsetX = canvas.width / 2; offsetY = canvas.height / 2;
        draw();

        statusText.innerText = "Success! Shape generated.";
        statusText.style.color = "#27ae60";

        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) toggleSidebar();

    } catch (error) {
        console.error(error);
        statusText.innerText = `AI Error: ${error.message || 'Check if internet connection is loose.'}`;
        statusText.style.color = "#e74c3c";
    } finally {
        generateBtn.disabled = false; generateBtn.innerText = "Generate";
    }
}

// --- GENERAL MATRIX RENDERING ENGINE ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines
    ctx.lineWidth = 1; ctx.strokeStyle = '#e0e0e0'; ctx.beginPath();
    let startX = (offsetX % scale) - scale;
    for (let x = startX; x < canvas.width; x += scale) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    let startY = (offsetY % scale) - scale;
    for (let y = startY; y < canvas.height; y += scale) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();

    // Draw Core Axes
    ctx.lineWidth = 2; ctx.strokeStyle = '#000000'; ctx.beginPath();
    if (offsetY >= 0 && offsetY <= canvas.height) { ctx.moveTo(0, offsetY); ctx.lineTo(canvas.width, offsetY); }
    if (offsetX >= 0 && offsetX <= canvas.width) { ctx.moveTo(offsetX, 0); ctx.lineTo(offsetX, canvas.height); }
    ctx.stroke();

    equations.forEach(eq => {
        if (eq.type !== 'graph') return;

        let rawExpr = eq.element.value.trim().replace(/\s+/g, '').toLowerCase();
        if (!rawExpr) return;

        // 1. EXTRACT TRAILING BOUNDARY CONDITIONS
        let coreExpr = rawExpr;
        let boundaryStrings = [];
        coreExpr = coreExpr.replace(/\{([^}]+)\}/g, (match, condition) => {
            boundaryStrings.push(condition);
            return '';
        });

        let parsedBoundaries = boundaryStrings.map(b => {
            let pb = parseMathText(b);
            return pb.replace(/(?<![<>])=(?!=)/g, '===');
        });

        let checkBoundaries;
        try {
            let jointCondition = parsedBoundaries.length > 0 ? parsedBoundaries.join(')&&(') : 'true';
            checkBoundaries = new Function('x', 'y', 'return (' + jointCondition + ')');
            checkBoundaries(0, 0);
        } catch (e) { return; }

        // 2. ISOLATE STRUCTURE OPERATORS
        let operatorMatch = coreExpr.match(/(>=|<=|>|<|=)/);
        let operator, lhs, rhs;

        if (operatorMatch) {
            operator = operatorMatch[0];
            let parts = coreExpr.split(operator);
            lhs = parts[0].trim();
            rhs = parts[1].trim();
        } else {
            operator = '='; lhs = 'y'; rhs = coreExpr;
        }

        let isInequality = operator !== '=';
        let isExplicitY = (lhs === 'y' && !rhs.includes('y'));
        let isExplicitX = (lhs === 'x' && !rhs.includes('x'));
        let isImplicit = !isExplicitY && !isExplicitX;

        // --- RENDERING STRATEGIES ---

        // CASE A: INEQUALITY REGION SHADING
        if (isInequality) {
            let parsedExpr = parseMathText(coreExpr);
            let fShader;
            try {
                fShader = new Function('x', 'y', 'return ' + parsedExpr);
                fShader(0, 0);
            } catch (e) { return; }

            let res = 0.5;
            let offW = Math.ceil(canvas.width * res);
            let offH = Math.ceil(canvas.height * res);

            let offCanvas = document.createElement('canvas');
            offCanvas.width = offW; offCanvas.height = offH;
            let offCtx = offCanvas.getContext('2d');
            let imgData = offCtx.createImageData(offW, offH);
            let data = imgData.data;

            let rgb = getRGB(eq.color);
            let index = 0;

            for (let py = 0; py < offH; py++) {
                let mathY = (offsetY - (py / res)) / scale;
                for (let px = 0; px < offW; px++) {
                    let mathX = ((px / res) - offsetX) / scale;
                    try {
                        if (checkBoundaries(mathX, mathY) && fShader(mathX, mathY)) {
                            data[index] = rgb[0];
                            data[index+1] = rgb[1];
                            data[index+2] = rgb[2];
                            data[index+3] = 60;
                        }
                    } catch(e) {}
                    index += 4;
                }
            }
            offCtx.putImageData(imgData, 0, 0);
            ctx.drawImage(offCanvas, 0, 0, offW, offH, 0, 0, canvas.width, canvas.height);
        }

        // CASE B: IMPLICIT EQUATION & INEQ BOUNDARIES (e.g. conics, conics boundary lines)
        if (isImplicit) {
            let fValue;
            try {
                fValue = new Function('x', 'y', 'return (' + parseMathText(lhs) + ') - (' + parseMathText(rhs) + ')');
                fValue(0,0);
            } catch(e) { return; }

            let res = 1.0;
            let offW = Math.ceil(canvas.width * res);
            let offH = Math.ceil(canvas.height * res);

            let offCanvas = document.createElement('canvas');
            offCanvas.width = offW; offCanvas.height = offH;
            let offCtx = offCanvas.getContext('2d');
            let imgData = offCtx.createImageData(offW, offH);
            let data = imgData.data;

            let rgb = getRGB(eq.color);

            let grid = [];
            for (let py = 0; py < offH; py++) {
                grid[py] = new Float32Array(offW);
                let mathY = (offsetY - (py / res)) / scale;
                for (let px = 0; px < offW; px++) {
                    let mathX = ((px / res) - offsetX) / scale;
                    if (checkBoundaries(mathX, mathY)) {
                        grid[py][px] = fValue(mathX, mathY);
                    } else {
                        grid[py][px] = NaN;
                    }
                }
            }

            for (let py = 0; py < offH - 1; py++) {
                for (let px = 0; px < offW - 1; px++) {
                    let v = grid[py][px];
                    if (isNaN(v)) continue;
                    let r = grid[py][px+1];
                    let b = grid[py+1][px];

                    let isZeroCrossing = false;
                    if (!isNaN(r) && v * r <= 0) isZeroCrossing = true;
                    if (!isNaN(b) && v * b <= 0) isZeroCrossing = true;

                    if (isZeroCrossing) {
                        let index = (py * offW + px) * 4;
                        data[index] = rgb[0];
                        data[index+1] = rgb[1];
                        data[index+2] = rgb[2];
                        data[index+3] = 255;
                    }
                }
            }
            offCtx.putImageData(imgData, 0, 0);
            ctx.drawImage(offCanvas, 0, 0, offW, offH, 0, 0, canvas.width, canvas.height);
        }

        // CASE C: EXPLICIT LOGIC LINE VECTORS
        if (!isImplicit) {
            let parsedBoundary = parseMathText(rhs);
            let fLine;
            let independentVar = isExplicitY ? 'x' : 'y';
            try {
                fLine = new Function(independentVar, 'return ' + parsedBoundary);
                fLine(0);
            } catch (e) { return; }

            ctx.beginPath();
            ctx.strokeStyle = eq.color;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([]);

            let firstPoint = true;

            if (isExplicitY) {
                for (let px = 0; px <= canvas.width; px++) {
                    let mathX = (px - offsetX) / scale;
                    try {
                        let mathY = fLine(mathX); let py = offsetY - (mathY * scale);

                        if (isFinite(py) && checkBoundaries(mathX, mathY)) {
                            if (firstPoint) { ctx.moveTo(px, py); firstPoint = false; }
                            else { ctx.lineTo(px, py); }
                        } else { firstPoint = true; }
                    } catch (e) { firstPoint = true; }
                }
            } else {
                for (let py = 0; py <= canvas.height; py++) {
                    let mathY = (offsetY - py) / scale;
                    try {
                        let mathX = fLine(mathY); let px = offsetX + (mathX * scale);

                        if (isFinite(px) && checkBoundaries(mathX, mathY)) {
                            if (firstPoint) { ctx.moveTo(px, py); firstPoint = false; }
                            else { ctx.lineTo(px, py); }
                        } else { firstPoint = true; }
                    } catch (e) { firstPoint = true; }
                }
            }
            ctx.stroke();
        }
    });
}

// --- INTERACTIVITY LOGIC ---
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
addEquation('x^2 + y^2 < 10', '#2d70b3');
addEquation('y = x^2 {x < 2}', '#c74440');