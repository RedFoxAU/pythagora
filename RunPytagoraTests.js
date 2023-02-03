const axios = require('axios');
const fs = require('fs');
const qs = require('querystring');
const _ = require('lodash');
const { logTestPassed, logTestFailed, logTestsFinished, logTestsStarting } = require('./src/utils/cmdPrint');
const { compareResponse } = require('./src/utils/common');

async function makeRequest(test) {
    try {
        let options = {
            method: test.method,
            url: test.url,
            headers: _.extend({'cache-control': 'no-cache', 'pytagora-req-id': test.id}, _.omit(test.headers, ['content-length', 'cache-control'])),
            maxRedirects: 0,
            cache: false,
            validateStatus: function (status) {
                return status >= 100 && status < 600;
            },
            transformResponse: (r) => r
        };
        if (test.method !== 'GET') {
            options.data = test.body;
        }
        const response = await axios(options);

        if(response.status >= 300 && response.status < 400) {
            response.data = {type: 'redirect', url: `${response.headers.location}`};
        }
        // TODO trebamo uspoređivati JSON fileove i ignorirati _id prilikom createa jer se on mijenja svaki put
        let testResult = compareResponse(response.data, test.responseData);

        testResult = global.Pytagora.request.id === test.id && global.Pytagora.request.errors.length ? false : testResult;
        // TODO add query
        (testResult ? logTestPassed : logTestFailed)(test.id, test.endpoint, test.method, test.body, undefined, response.data, test.responseData, global.Pytagora.request.errors);
        return testResult;
    } catch (error) {
        console.error(error);
    }
}

(async () => {
    const directory = './pytagora_data';
    const results = [];

    try {
        let files = fs.readdirSync(directory);
        files = files.filter(f => f[0] !== '.');
        logTestsStarting(files);
        for (let file of files) {
            let tests = JSON.parse(fs.readFileSync(`./pytagora_data/${file}`));
            for (let test of tests) {
                results.push(await makeRequest(test) || false);
            }
        }

        let passedCount = results.filter(r => r).length,
            failedCount = results.filter(r => !r).length;
            // linesExecuted = global.Pytagora.instrumenter.getCurrentlyExecutedLines(),
            // codeCoverage = global.Pytagora.instrumenter.getCurrentlyExecutedLines(false, true);
            logTestsFinished(passedCount, failedCount);//, linesExecuted, codeCoverage);
    } catch (err) {
        console.error("Error occured while running Pytagora tests: ", err);
    }

    process.exit(0);
})();
