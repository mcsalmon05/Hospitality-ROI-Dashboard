const validator = require('html-validator');
const fs = require('fs');

(async () => {
    const options = {
        format: 'text',
        data: fs.readFileSync('public/index.html', 'utf8')
    };
    try {
        const result = await validator(options);
        console.log(result);
    } catch (error) {
        console.error(error);
    }
})();
