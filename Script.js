const display = document.getElementById('display');
const clearBtn = document.getElementById('clear-btn');
let shouldResetScreen = false;

// Updates the Clear button text dynamically
function updateClearButton() {
    if (display.value === '0' || display.value === 'Error') {
        clearBtn.innerText = 'C';
    } else {
        clearBtn.innerText = 'AC';
    }
}

// Adds a number or decimal to the display
function appendNumber(number) {
    if (display.value === '0' || shouldResetScreen) {
        display.value = '';
        shouldResetScreen = false;
    }
    if (number === '.' && display.value.includes('.')) return;

    display.value += number;
    updateClearButton();
}

// Adds an operator to the display
function appendOperator(operator) {
    const lastChar = display.value.slice(-1);
    // Prevent stacking operators
    if (['+', '-', '*', '/', '*'].includes(lastChar)) {
        display.value = display.value.slice(0, -1) + operator;
        return;
    }
    display.value += operator;
    shouldResetScreen = false;
    updateClearButton();
}

// Handles advanced scientific functions immediately
function calcSci(func) {
    // Evaluate current expression first if needed
    let val;
    try {
        val = eval(display.value);
    } catch (e) {
        val = parseFloat(display.value);
    }

    if (isNaN(val)) return;

    switch(func) {
        case 'sin': display.value = Math.sin(val); break; // Note: calculates in radians
        case 'cos': display.value = Math.cos(val); break;
        case 'tan': display.value = Math.tan(val); break;
        case 'sqrt': display.value = Math.sqrt(val); break;
        case 'log': display.value = Math.log10(val); break;
    }
    shouldResetScreen = true;
    updateClearButton();
}

// Clears the calculator screen
function clearDisplay() {
    display.value = '0';
    updateClearButton();
}

// Calculates the mathematical result
function calculateResult() {
    try {
        display.value = eval(display.value);
        shouldResetScreen = true;
    } catch (error) {
        display.value = 'Error';
        shouldResetScreen = true;
    }
    updateClearButton();
}