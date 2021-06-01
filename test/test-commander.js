const { Command } = require('commander');
const program = new Command();

program
    .allowUnknownOption()
    .option('-tt, --tokens <list>', 'tokens list json');


program.parse(process.argv);


const options = program.opts();

console.log(options);
