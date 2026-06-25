const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
const container = document.getElementById('graph-container');
const eqList = document.getElementById('eq-list');

const colors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'];
let equations = [];

let scale = 50;
let offsetX = 0;
let offsetY = 0;

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
    const id = Date.now();
    const color = colors[equations.length % colors.length];

    const row = document.createElement('div');
    row.className = 'equation-row';
    row.innerHTML = `
                <div class="color-dot" style="background-color: ${color};"></div>
                <input type="text" class="math-input" placeholder="e.g. x^2 or sin(x)" value="${initialMath}">
            `;

    const input = row.querySelector('.math-input');
    input.addEventListener('input', draw);

    eqList.appendChild(row);
    equations.push({ id, element: input, color });

    input.focus();
    draw();
}

// FIXED AND UPGRADED MATH PARSER
function parseMathText(expr) {
    let parsed = expr.toLowerCase()
        .replace(/\s+/g, '') // Remove all spaces
        .replace(/(\d)([xX\(a-zA-Z])/g, '$1*$2') // Implicit multiplication: 2x -> 2*x
        .replace(/([xX\)])(\d)/g, '$1*$2') // Implicit multiplication: x2 -> x*2
        .replace(/\^/g, '**') // Exponents
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

function generateAiShape() {
    const prompt = document.getElementById('ai-prompt').value.toLowerCase();
    if (!prompt) return;

    eqList.innerHTML = '';
    equations = [];

    if (prompt.includes('circle')) {
        addEquation('sqrt(25 - x^2)');
        addEquation('-sqrt(25 - x^2)');
    } else if (prompt.includes('heart')) {
        addEquation('sqrt(1-(abs(x)-1)^2)');
        addEquation('acos(1-abs(x))-π');
    } else if (prompt.includes('star')) {
        addEquation('((abs(x)+abs(x))/2) + 2*abs(sin(x*π/2)) - 3');
    } else if (prompt.includes('spiral')) {
        addEquation('x * sin(5*x)');
    } else {
        alert("I'm still learning! Try 'circle', 'heart', or 'star'.");
        addEquation('x^2');
    }

    scale = 50;
    offsetX = canvas.width / 2;
    offsetY = canvas.height / 2;
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e0e0e0';
    ctx.beginPath();
    let startX = (offsetX % scale) - scale;
    for (let x = startX; x < canvas.width; x += scale) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    let startY = (offsetY % scale) - scale;
    for (let y = startY; y < canvas.height; y += scale) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Draw Axes
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    if (offsetY >= 0 && offsetY <= canvas.height) {
        ctx.moveTo(0, offsetY); ctx.lineTo(canvas.width, offsetY);
    }
    if (offsetX >= 0 && offsetX <= canvas.width) {
        ctx.moveTo(offsetX, 0); ctx.lineTo(offsetX, canvas.height);
    }
    ctx.stroke();

    // Draw Equations (Optimized)
    equations.forEach(eq => {
        const expr = eq.element.value;
        if (!expr || !expr.includes('x')) return;

        const parsedExpr = parseMathText(expr);

        let f;
        try {
            // Create the function ONCE per equation, instead of inside the loop
            f = new Function('x', 'return ' + parsedExpr);
            f(0); // Test it to make sure it doesn't crash on invalid syntax
        } catch (e) {
            return; // Skip drawing this line until the user fixes the syntax
        }

        ctx.beginPath();
        ctx.strokeStyle = eq.color;
        ctx.lineWidth = 2.5;

        let firstPoint = true;

        for (let px = 0; px <= canvas.width; px++) {
            let mathX = (px - offsetX) / scale;
            try {
                let mathY = f(mathX);
                let py = offsetY - (mathY * scale);

                // isFinite prevents asymptotes (like tan) or undefined domains (like square root of negatives) from drawing crazy lines
                if (isFinite(py)) {
                    if (firstPoint) {
                        ctx.moveTo(px, py);
                        firstPoint = false;
                    } else {
                        ctx.lineTo(px, py);
                    }
                } else {
                    firstPoint = true;
                }
            } catch (e) {
                firstPoint = true;
            }
        }
        ctx.stroke();
    });
}

// Interactivity: Pan and Zoom
let isDragging = false;
let lastMouseX, lastMouseY;

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

window.addEventListener('mouseup', () => { isDragging = false; });

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    offsetX += e.clientX - lastMouseX;
    offsetY += e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    draw();
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    scale *= zoomFactor;

    const mouseX = e.clientX - canvas.getBoundingClientRect().left;
    const mouseY = e.clientY - canvas.getBoundingClientRect().top;
    offsetX = mouseX - (mouseX - offsetX) * zoomFactor;
    offsetY = mouseY - (mouseY - offsetY) * zoomFactor;

    draw();
});

resizeCanvas();
addEquation('x^2');