const display = document.getElementById('display');
const clearBtn = document.getElementById('clear-btn');
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
let shouldResetScreen = false;

// Toggles C to AC
function updateClearButton() {
    clearBtn.innerText = (display.value === '0' || display.value === 'Error') ? 'C' : 'AC';
}

// Hides canvas when typing new math
function hideGraph() {
    canvas.style.display = 'none';
}

// Add Number or Variable
function appendNumber(num) {
    if (display.value === '0' || display.value === 'Error' || shouldResetScreen) {
        display.value = '';
        shouldResetScreen = false;
    }
    if (num === '.' && display.value.includes('.') && !['+','-','*','/','**'].some(op => display.value.includes(op))) return;
    display.value += num;
    updateClearButton();
    hideGraph();
}

// Smart Delete function
function deleteChar() {
    if (display.value.length === 1 || display.value === 'Error') {
        display.value = '0';
    } else {
        if (display.value.endsWith('**')) {
            display.value = display.value.slice(0, -2);
        } else {
            display.value = display.value.slice(0, -1);
        }
    }
    updateClearButton();
    hideGraph();
}

// Smart Operator Appending (Handles negative numbers)
function appendOperator(operator) {
    let val = display.value;
    let lastChar = val.slice(-1);
    let secondLastChar = val.slice(-2, -1);
    const isOp = (c) => ['+', '-', '*', '/'].includes(c);

    if (isOp(lastChar) || val.endsWith('**')) {
        if (operator === '-') {
            // Allow appending negative sign after another operator (e.g. 5 * -)
            if (lastChar !== '-') display.value += operator;
        } else {
            // If replacing operators, check if we need to remove a negative sign too (e.g. 5 * - + -> 5 +)
            if (lastChar === '-' && (isOp(secondLastChar) || val.endsWith('**-'))) {
                display.value = val.endsWith('**-') ? val.slice(0, -3) + operator : val.slice(0, -2) + operator;
            } else {
                // Standard replace operator
                display.value = val.endsWith('**') ? val.slice(0, -2) + operator : val.slice(0, -1) + operator;
            }
        }
    } else {
        display.value += operator;
    }
    shouldResetScreen = false;
    updateClearButton();
    hideGraph();
}

// Scientific functions (Adaptive based on context)
function calcSci(func) {
    // If the user is writing an equation with 'x', just append the function name so it can be graphed
    if (display.value.includes('x') || shouldResetScreen) {
        if (display.value === '0' || shouldResetScreen) display.value = '';
        let map = { 'sin': 'sin(', 'cos': 'cos(', 'tan': 'tan(', 'sqrt': 'sqrt(', 'log': 'log(' };
        display.value += map[func];
        shouldResetScreen = false;
        updateClearButton();
        hideGraph();
        return;
    }

    // Otherwise, calculate immediately
    let val;
    try { val = eval(display.value); } catch (e) { val = parseFloat(display.value); }
    if (isNaN(val)) return;

    switch(func) {
        case 'sin': display.value = Math.sin(val); break;
        case 'cos': display.value = Math.cos(val); break;
        case 'tan': display.value = Math.tan(val); break;
        case 'sqrt': display.value = Math.sqrt(val); break;
        case 'log': display.value = Math.log10(val); break;
    }
    shouldResetScreen = true;
    updateClearButton();
}

// Clear display
function clearDisplay() {
    display.value = '0';
    updateClearButton();
    hideGraph();
}

// Calculate Result
function calculateResult() {
    if(display.value.includes('x')) return; // Don't calculate if it's an algebra equation

    // Auto-close open parentheses to prevent errors
    const openParen = (display.value.match(/\(/g) || []).length;
    const closeParen = (display.value.match(/\)/g) || []).length;
    display.value += ')'.repeat(Math.max(0, openParen - closeParen));

    try {
        display.value = eval(display.value);
        shouldResetScreen = true;
    } catch (error) {
        display.value = 'Error';
        shouldResetScreen = true;
    }
    updateClearButton();
}

// Graphing Engine
function plotGraph() {
    if (!display.value.includes('x')) return; // Ensure there is an equation to graph

    canvas.style.display = 'block'; // Show canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Cartesian Grid
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 100); ctx.lineTo(340, 100); // X-Axis
    ctx.moveTo(170, 0); ctx.lineTo(170, 200); // Y-Axis
    ctx.stroke();

    // Prepare mathematical expression
    let expr = display.value;
    expr = expr.replace(/(\d)x/g, '$1*x'); // Allows implicit multiplication like '2x'

    // Convert standard math strings to JavaScript Math equivalents
    let parsedExpr = expr
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(')
        .replace(/sqrt\(/g, 'Math.sqrt(')
        .replace(/log\(/g, 'Math.log10(')
        .replace(/π/g, 'Math.PI');

    // Auto-close parentheses for the graphing function
    const openParen = (parsedExpr.match(/\(/g) || []).length;
    const closeParen = (parsedExpr.match(/\)/g) || []).length;
    parsedExpr += ')'.repeat(Math.max(0, openParen - closeParen));

    ctx.strokeStyle = '#e74c3c'; // Line color (Red)
    ctx.lineWidth = 2;
    ctx.beginPath();

    let firstPoint = true;

    // Plot loop (Calculates y for every pixel of x)
    for(let px = 0; px <= 340; px++) {
        let x = (px - 170) / 17; // Scaled to show exactly X from -10 to 10
        try {
            let f = new Function('x', 'return ' + parsedExpr);
            let y = f(x);
            let py = 100 - (y * 17); // Invert Y axis for HTML canvas coordinates

            // Only draw continuous numbers to prevent crazy glitching lines
            if (isFinite(py)) {
                if (firstPoint) {
                    ctx.moveTo(px, py);
                    firstPoint = false;
                } else {
                    ctx.lineTo(px, py);
                }
            } else {
                firstPoint = true; // Break the line if it hits an asymptote
            }
        } catch(e) { } // Ignore errors from partial equations
    }
    ctx.stroke();
    shouldResetScreen = true;
}