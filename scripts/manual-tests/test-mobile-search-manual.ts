/**
 * Скрипт для ручного тестирования мобильного поиска
 */

console.log('🧪 Инструкции для тестирования мобильного поиска:');
console.log('');
console.log('1. Откройте браузер и перейдите на http://localhost:3000/minsk');
console.log('2. Откройте DevTools (F12)');
console.log('3. Включите мобильный режим (Toggle device toolbar)');
console.log('4. Выберите iPhone или другое мобильное устройство');
console.log('5. Обновите страницу');
console.log('');
console.log('🔍 Что проверить:');
console.log('- Видна ли строка поиска в верхней части страницы?');
console.log('- Есть ли красная метка "NO filters" или "HAS filters"?');
console.log('- При клике на строку поиска открывается ли мобильный поиск?');
console.log('');
console.log('📱 Тестовые URL с фильтрами:');
console.log('- http://localhost:3000/minsk?age=0-1 (возраст 0-1 год)');
console.log('- http://localhost:3000/minsk?preset=TODAY (сегодня)');
console.log('- http://localhost:3000/minsk?metro=cmmj6x1s5000hws428w3qtxqy (метро)');
console.log('- http://localhost:3000/minsk?age=0-1,1-3&preset=TOMORROW (несколько фильтров)');
console.log('');
console.log('🎯 Ожидаемое поведение:');
console.log('- На странице без фильтров: "Начать поиск" + красная метка "NO filters"');
console.log('- На странице с фильтрами: название фильтров через • + красная метка "HAS filters"');
console.log('- Например: "0–1 год" или "Минск • Сегодня • 0–1 год"');
console.log('');
console.log('🐛 Если фильтры не отображаются:');
console.log('- Проверьте консоль браузера на наличие логов 🔍 MobileSearchEntry');
console.log('- Проверьте, что URL содержит параметры фильтров');
console.log('- Убедитесь, что вы в мобильном режиме');
console.log('');
console.log('✨ Готово! Начинайте тестирование.');

export {};