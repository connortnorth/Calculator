const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
const container = document.getElementById('graph-container');
const eqList = document.getElementById('eq-list');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

const defaultColors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'];
let equations = [];
let scale = 50;
let offsetX = 0;
let offsetY = 0;
let actualDesmosCalc = null;
let isDesmosScriptLoaded = false;

// --- DARK MODE LOGIC ---
function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    if (actualDesmosCalc) {
        actualDesmosCalc.setGraphSettings({ invertedColors: isDarkMode });
    }
    draw();
}

// --- IMPORT / CLIPBOARD LOGIC ---
function openGeminiWithPrompt() {
    const userIdea = document.getElementById('user-idea').value.trim() || "something incredibly creative";

    let cleanIdea = userIdea.replace(/^(draw|make|create|graph|render|sketch)\s+(a|an|the)?\s*/i, '').trim();
    if (!cleanIdea) cleanIdea = userIdea;

    const constructedPrompt = `You are an elite mathematical artist, master draftsman, and Desmos geometry expert. Your task is to mathematically model and creatively render the structural form, key proportions, and distinguishing features of a: "${cleanIdea}".

Avoid relying on primitive geometric configurations (like plain rectangles, basic circles, or standard triangles). Instead, you are highly encouraged to leverage complex, advanced, high-level mathematical relations. Our custom rendering engine natively supports full multi-variable implicit formulas, conic sections (hyperbolas, rotated ellipses, parabolas), trigonometric structures, rational expressions, and polynomial equations. Feel free to use complex models like equations balancing variables on both sides (e.g., x^2 + xy = y^2 - cos(x)).

Respond ONLY with a valid JSON array of objects. Do not use markdown blocks, backticks, or any conversational text.

Each object in the array must have exactly three keys:
- "label": A brief descriptive string naming the exact part of the object being drawn (e.g., "left horn tip", "upper snout outline"). This is critical for structural planning.
- "equation": A string containing a valid math equation or inequality.
- "color": A specific hex color string that matches a cohesive, realistic color palette for the object.

CRITICAL DRAFTING & MATH INSTRUCTIONS:
1. THE ASSEMBLY PROCESS: Write between 15 to 40 equations ordered logically. Use organic curves, multi-variable lines, and dynamic mathematical structures to map intricate lines.
2. ADVANCED GEOMETRIC SHAPING & CLIPPING:
   - To make organic parts or custom shapes, overlap equations and use domain/range restrictions using curly brackets {} when necessary. Clipping bounds are entirely optional but highly recommended for styling distinct features.
   - You can use either single-condition brackets or standard mathematical compound inequality bounds inside the curly brackets.
     CORRECT COMPOUND BOUNDS: y = x^2 {0 <= x < 5} or y = -x + 3 {-2 < y <= 4}
     CORRECT CHAINED BOUNDS: y = x^2 {x > -2}{x < 2}
     ALSO CORRECT: y = x^2 (if no bounding restrictions are needed)
   - Never use logical JavaScript syntax (&&, ||, AND, OR, !). Use the standard mathematical compound layout or separate chained brackets for intersections.

3. SOLID SHADING & LAYERING:
   - Prioritize filled shapes using inequalities (<, >, <=, >=) to give the object physical substance.
   - Layer elements intentionally. Since equations render sequentially, place larger background fills first, then layer smaller detail inequalities on top of them.

4. COORDINATE MAPPING & SCALE:
   - Center the main focal point of the drawing at the origin (0,0).
   - Scale the entire composition beautifully to fit within a standard -10 to 10 grid view on both axes.

Example output format:
[
  {"label": "head background fill", "equation": "x^2+x*y+y^2<=16", "color": "#f1c40f"},
  {"label": "jaw profile curve", "equation": "x+y=2*y-7 {-3 < x < 5}", "color": "#e74c3c"}
]`;

    navigator.clipboard.writeText(constructedPrompt).then(() => {
        window.open('https://gemini.google.com', '_blank');
    }).catch(err => {
        console.error('Could not write prompt to clipboard: ', err);
        window.open('https://gemini.google.com', '_blank');
    });
}

async function readClipboardAndLoad() {
    try {
        const clipboardText = await navigator.clipboard.readText();
        const cleanCode = clipboardText.replace(/```json/g, '').replace(/```/g, '').trim();

        if (!cleanCode) {
            alert("Your clipboard seems to be empty. Copy the JSON structure returned from Gemini first!");
            return;
        }

        const newEquations = JSON.parse(cleanCode);

        // Clear current board
        while(equations.length > 0) {
            deleteEquation(equations[0].id);
        }

        // Inject new equations with color and custom labels preserved as text hints
        newEquations.forEach(item => {
            const mathStr = item.equation || item.math || "";
            const colorStr = item.color || null;
            const labelStr = item.label || "";
            if (mathStr) {
                addEquation(mathStr, colorStr, labelStr);
            }
        });

        // Reset viewport
        offsetX = canvas.width / 2;
        offsetY = canvas.height / 2;
        scale = 50;
        draw();

    } catch (err) {
        console.error(err);
        alert("Error reading clipboard or parsing data. Make sure you copied the full valid JSON block from Gemini, and that clipboard permissions are enabled.");
    }
}
// ---------------------------

function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

function resizeCanvas() {
    canvas.width = container.clientWidth || window.innerWidth;
    canvas.height = container.clientHeight || window.innerHeight;
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

function addEquation(initialMath = '', specificColor = null, labelText = '') {
    const id = Date.now() + Math.random();
    let color = specificColor ? normalizeColor(specificColor) : defaultColors[equations.length % defaultColors.length];

    const row = document.createElement('div');
    row.className = 'equation-row';
    row.id = `row-${id}`;
    row.innerHTML = `
                <div class="color-picker-wrapper" id="color-wrap-${id}" style="background-color: ${color};" title="${labelText || 'Color Picker'}">
                    <input type="color" class="color-picker" id="color-${id}" value="${color}">
                </div>
                <div class="math-input-container">
                    <input type="text" class="math-input" placeholder="e.g. y > x^2" value="${initialMath}" title="${labelText || 'Equation input'}">
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
    if (!specificColor && !initialMath) input.focus();
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
    let clean = expr.toLowerCase().replace(/\s+/g, '');

    // Handle compound mathematical inequalities seamlessly (e.g., -5<=x<2 or 0<y<=3)
    const compoundRegex = /^([^<>=]+)(<=|>=|<|>)([^<>=]+)(<=|>=|<|>)([^<>=]+)$/;
    const match = clean.match(compoundRegex);
    if (match) {
        return `(${parseMathText(match[1])} ${match[2]} ${parseMathText(match[3])}) && (${parseMathText(match[3])} ${match[4]} ${parseMathText(match[5])})`;
    }

    let parsed = clean
        .replace(/([xXyY])(?=[xXyY\(a-zA-Z])/g, '$1*') // Auto multiply variables side-by-side (e.g. xy -> x*y)
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

    // Convert domain curly braces to LaTeX format first
    latex = latex.replace(/\{/g, '\\left\\{').replace(/\}/g, '\\right\\}');

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

    return latex;
}

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
    const isDarkModeActive = document.body.classList.contains('dark-mode');

    if (!actualDesmosCalc) {
        actualDesmosCalc = Desmos.GraphingCalculator(elt, { expressions: true, settingsMenu: true });
    } else {
        actualDesmosCalc.setBlank();
    }

    actualDesmosCalc.setGraphSettings({ invertedColors: isDarkModeActive });

    eqs.forEach((eq, index) => {
        actualDesmosCalc.setExpression({ id: 'graph-' + index, latex: eq.latex, color: eq.color });
    });
}

function closeActualDesmos() { document.getElementById('desmos-wrapper').style.display = 'none'; }

// --- RENDER LOOP WITH DYNAMIC AXES ---
function draw() {
    if (!canvas.width || !canvas.height) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isDarkMode = document.body.classList.contains('dark-mode');

    const minPixelsBetweenLines = 70;
    const rawMathStep = minPixelsBetweenLines / scale;

    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMathStep)));
    const residual = rawMathStep / magnitude;
    let stepMultiplier = 1;
    if (residual > 5) stepMultiplier = 10;
    else if (residual > 2) stepMultiplier = 5;
    else if (residual > 1) stepMultiplier = 2;

    const mathStep = stepMultiplier * magnitude;
    const pixelStep = mathStep * scale;

    ctx.font = '12px "Courier New", Courier, monospace';
    ctx.fillStyle = isDarkMode ? '#95a5a6' : '#7f8c8d';

    ctx.lineWidth = 1;
    ctx.strokeStyle = isDarkMode ? '#2c2c2c' : '#e0e0e0';
    ctx.beginPath();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';

    let firstMathX = Math.floor((-offsetX) / pixelStep) * mathStep;
    for (let mathX = firstMathX; (offsetX + mathX * scale) < canvas.width; mathX += mathStep) {
        let px = offsetX + mathX * scale;
        ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height);

        if (Math.abs(mathX) > 1e-10) {
            let textY = Math.max(5, Math.min(canvas.height - 20, offsetY + 5));
            let label = parseFloat(mathX.toPrecision(12)).toString();
            ctx.fillText(label, px, textY);
        }
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';

    let firstMathY = Math.floor((offsetY - canvas.height) / pixelStep) * mathStep;
    for (let mathY = firstMathY; (offsetY - mathY * scale) > 0; mathY += mathStep) {
        let py = offsetY - mathY * scale;
        ctx.moveTo(0, py); ctx.lineTo(canvas.width, py);

        if (Math.abs(mathY) > 1e-10) {
            let textX = Math.max(25, Math.min(canvas.width - 5, offsetX - 5));
            let label = parseFloat(mathY.toPrecision(12)).toString();
            ctx.fillText(label, textX, py);
        }
    }
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = isDarkMode ? '#e0e0e0' : '#2c3e50';
    ctx.beginPath();
    if (offsetY >= 0 && offsetY <= canvas.height) { ctx.moveTo(0, offsetY); ctx.lineTo(canvas.width, offsetY); }
    if (offsetX >= 0 && offsetX <= canvas.width) { ctx.moveTo(offsetX, 0); ctx.lineTo(offsetX, canvas.height); }
    ctx.stroke();

    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    let originX = Math.max(15, Math.min(canvas.width - 5, offsetX - 5));
    let originY = Math.max(5, Math.min(canvas.height - 15, offsetY + 5));
    ctx.fillText("0", originX, originY);

    equations.forEach(eq => {
        if (eq.type !== 'graph') return;
        let rawExpr = eq.element.value.trim().replace(/\s+/g, '').toLowerCase();
        if (!rawExpr) return;

        // Extract Desmos-style {} boundaries
        let conditions = [];
        let baseExpr = rawExpr.replace(/\{([^}]+)\}/g, function(match, p1) {
            conditions.push(p1);
            return '';
        });

        let operatorMatch = baseExpr.match(/(>=|<=|>|<|=)/);
        let operator, lhs, rhs;

        if (operatorMatch) {
            operator = operatorMatch[0];
            let parts = baseExpr.split(operator);
            lhs = parts[0].trim();
            rhs = parts[1].trim();
        } else {
            operator = '='; lhs = 'y'; rhs = baseExpr;
        }

        let isInequality = operator !== '=';
        let isExplicitY = lhs === 'y';
        let isExplicitX = lhs === 'x';
        let isImplicitEquality = operator === '=' && !isExplicitY && !isExplicitX;

        if (isInequality || isImplicitEquality) {
            let compiledConditions = [];
            let fShader, fLHS, fRHS;
            try {
                if (isInequality) {
                    let parsedExpr = parseMathText(baseExpr);
                    fShader = new Function('x', 'y', 'return ' + parsedExpr);
                    fShader(0, 0);
                } else {
                    fLHS = new Function('x', 'y', 'return ' + parseMathText(lhs));
                    fRHS = new Function('x', 'y', 'return ' + parseMathText(rhs));
                    fLHS(0, 0); fRHS(0, 0);
                }
                for (let c of conditions) {
                    compiledConditions.push(new Function('x', 'y', 'return ' + parseMathText(c)));
                }
            } catch (e) { return; }

            // Use high sampling density for complex explicit/implicit lines
            let res = isImplicitEquality ? 1.0 : 0.5;
            let offW = Math.ceil(canvas.width * res);
            let offH = Math.ceil(canvas.height * res);

            let offCanvas = document.createElement('canvas');
            offCanvas.width = offW; offCanvas.height = offH;
            let offCtx = offCanvas.getContext('2d');
            let imgData = offCtx.createImageData(offW, offH);
            let data = imgData.data;

            let rgb = [0,0,0];
            let hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(eq.color);
            if (hexMatch) rgb = [parseInt(hexMatch[1], 16), parseInt(hexMatch[2], 16), parseInt(hexMatch[3], 16)];

            let index = 0;
            for (let py = 0; py < offH; py++) {
                let mathY = (offsetY - (py / res)) / scale;
                let mathYNext = (offsetY - ((py + 1) / res)) / scale;
                for (let px = 0; px < offW; px++) {
                    let mathX = ((px / res) - offsetX) / scale;
                    let mathXNext = (((px + 1) / res) - offsetX) / scale;
                    try {
                        let isValid = true;
                        for (let cond of compiledConditions) {
                            if (!cond(mathX, mathY)) { isValid = false; break; }
                        }

                        if (isValid) {
                            if (isInequality) {
                                if (fShader(mathX, mathY)) {
                                    data[index] = rgb[0]; data[index+1] = rgb[1]; data[index+2] = rgb[2]; data[index+3] = 60;
                                }
                            } else {
                                // Grid crossing sign change check for general equations
                                let v = fLHS(mathX, mathY) - fRHS(mathX, mathY);
                                let vX = fLHS(mathXNext, mathY) - fRHS(mathXNext, mathY);
                                let vY = fLHS(mathX, mathYNext) - fRHS(mathX, mathYNext);

                                if ((v * vX <= 0 && Math.abs(v - vX) < 10) ||
                                    (v * vY <= 0 && Math.abs(v - vY) < 10) ||
                                    Math.abs(v) < 0.005) {
                                    data[index] = rgb[0]; data[index+1] = rgb[1]; data[index+2] = rgb[2]; data[index+3] = 255;
                                }
                            }
                        }
                    } catch(e) {}
                    index += 4;
                }
            }
            offCtx.putImageData(imgData, 0, 0);
            ctx.drawImage(offCanvas, 0, 0, offW, offH, 0, 0, canvas.width, canvas.height);
        }

        if (isExplicitY || isExplicitX) {
            let parsedBoundary = parseMathText(rhs);
            let fLine;
            let compiledConditions = [];
            let independentVar = isExplicitY ? 'x' : 'y';

            try {
                fLine = new Function(independentVar, 'return ' + parsedBoundary);
                fLine(0);
                for (let c of conditions) {
                    compiledConditions.push(new Function('x', 'y', 'return ' + parseMathText(c)));
                }
            } catch (e) { return; }

            ctx.beginPath();
            ctx.strokeStyle = eq.color;
            ctx.lineWidth = 2.5;

            if (operator === '<' || operator === '>') ctx.setLineDash([5, 5]);
            else ctx.setLineDash([]);

            let firstPoint = true;

            if (isExplicitY) {
                for (let px = 0; px <= canvas.width; px++) {
                    let mathX = (px - offsetX) / scale;
                    try {
                        let mathY = fLine(mathX);

                        let isValid = true;
                        for (let cond of compiledConditions) {
                            if (!cond(mathX, mathY)) { isValid = false; break; }
                        }
                        if (!isValid) { firstPoint = true; continue; }

                        let py = offsetY - (mathY * scale);
                        if (isFinite(py)) {
                            if (firstPoint) { ctx.moveTo(px, py); firstPoint = false; } else { ctx.lineTo(px, py); }
                        } else { firstPoint = true; }
                    } catch (e) { firstPoint = true; }
                }
            } else {
                for (let py = 0; py <= canvas.height; py++) {
                    let mathY = (offsetY - py) / scale;
                    try {
                        let mathX = fLine(mathY);

                        let isValid = true;
                        for (let cond of compiledConditions) {
                            if (!cond(mathX, mathY)) { isValid = false; break; }
                        }
                        if (!isValid) { firstPoint = true; continue; }

                        let px = offsetX + (mathX * scale);
                        if (isFinite(px)) {
                            if (firstPoint) { ctx.moveTo(px, py); firstPoint = false; } else { ctx.lineTo(px, py); }
                        } else { firstPoint = true; }
                    } catch (e) { firstPoint = true; }
                }
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });
}

// --- SAFER MOBILE TOUCH EVENTS ---
let isDragging = false;
let lastMouseX, lastMouseY;
let lastPinchDist = null;

function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

canvas.addEventListener('mousedown', (e) => { isDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY; });

canvas.addEventListener('touchstart', (e) => {
    if (e.cancelable) e.preventDefault();

    if (e.touches.length === 1) {
        isDragging = true; lastMouseX = e.touches[0].clientX; lastMouseY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        lastPinchDist = getPinchDistance(e.touches);
    }
});

window.addEventListener('mouseup', () => { isDragging = false; });
window.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) lastPinchDist = null;
    if (e.touches.length === 0) isDragging = false;
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    offsetX += e.clientX - lastMouseX; offsetY += e.clientY - lastMouseY;
    lastMouseX = e.clientX; lastMouseY = e.clientY; draw();
});

canvas.addEventListener('touchmove', (e) => {
    if (e.cancelable) e.preventDefault();

    if (e.touches.length === 1 && isDragging) {
        offsetX += e.touches[0].clientX - lastMouseX; offsetY += e.touches[0].clientY - lastMouseY;
        lastMouseX = e.touches[0].clientX; lastMouseY = e.touches[0].clientY; draw();
    } else if (e.touches.length === 2 && lastPinchDist) {
        const newPinchDist = getPinchDistance(e.touches);
        const zoomFactor = newPinchDist / lastPinchDist;
        scale *= zoomFactor;

        const pinchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const pinchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = pinchX - canvasRect.left;
        const mouseY = pinchY - canvasRect.top;

        offsetX = mouseX - (mouseX - offsetX) * zoomFactor;
        offsetY = mouseY - (mouseY - offsetY) * zoomFactor;

        lastPinchDist = newPinchDist;
        draw();
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9; scale *= zoomFactor;
    const mouseX = e.clientX - canvas.getBoundingClientRect().left; const mouseY = e.clientY - canvas.getBoundingClientRect().top;
    offsetX = mouseX - (mouseX - offsetX) * zoomFactor; offsetY = mouseY - (mouseY - offsetY) * zoomFactor; draw();
});

window.onload = () => {
    resizeCanvas();
    addEquation('x^2 + y^2 <= 25', '#3498db', 'Base circle outline');
    addEquation('y > x^2 - 4', '#e74c3c', 'Lower boundary curve');

    const userIdeaBox = document.getElementById('user-idea');
    userIdeaBox.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            openGeminiWithPrompt();
        }
    });
};