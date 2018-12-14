const xlsx = require('node-xlsx').default;
const fs = require('fs');
const res = fs.readFileSync('.result', 'utf8');
const table = JSON.parse(res)
table.unshift(['Email', 'First Name','Last Name','Password','Phone','IP']);
const buffer = xlsx.build([{name: "Accounts Credentials", data: table}]);
fs.writeFileSync('resultWithCerdentialsAndIPforEachAcc.xslx', buffer)