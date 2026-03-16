/**
 * Clear Event Wizard localStorage cache
 * Run this in browser console if you encounter hydration errors
 */

// Clear event wizard draft
localStorage.removeItem('event-wizard-draft');

console.log('✅ Event wizard cache cleared');
console.log('Please refresh the page');
