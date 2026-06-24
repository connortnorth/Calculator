// 1. Select the button element from the DOM
const button = document.getElementById('actionBtn');

// 2. Add an event listener to handle the click event
button.addEventListener('click', () => {
    // Update button text dynamically
    button.textContent = 'Success!';

    // Toggle a CSS class for a visual state change
    button.classList.add('clicked');

    // Log interaction to the developer console
    console.log('Button was successfully clicked!');
});