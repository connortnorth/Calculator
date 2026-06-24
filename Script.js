const display = document.getElementById('display');
let currentInput = '0';
let shouldResetScreen = false;

// Adds a number or decimal to the display
function appendNumber(number) {
    if (display.value === '0' || shouldResetScreen) {
        display.value = '';
        shouldResetScreen = false;
    }
    // Prevent multiple decimals
    if (number === '.' && display.value.includes('.')) return;

    display.value += number;
}

// Adds an operator to the display
function appendOperator(operator) {
    // Prevent adding multiple operators in a row
    const lastChar = display.value.slice(-1);
    if (['+', '-', '*', '/'].includes(lastChar)) {
        display.value = display.value.slice(0, -1) + operator;
        return;
    }
    display.value += operator;
    shouldResetScreen = false;
}

// Clears the calculator screen
function clearDisplay() {
    display.value = '0';
}

// Calculates the mathematical result
function calculateResult() {
    try {
        // Warning: eval() is used here for simplicity in a standalone calculator.
        // In a complex, production web app where users can type raw text,
        // it's safer to use a dedicated math parser to prevent code injection.
        display.value = eval(display.value);
        shouldResetScreen = true;
    } catch (error) {
        display.value = 'Error';
        shouldResetScreen = true;
    }
}