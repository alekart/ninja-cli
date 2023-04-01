const {chmodSync} = require('fs-chmod');

chmodSync('./dist/ninja-cli.js', '+x');
