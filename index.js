const config = require('./config.js'),
    puppeteer = require('puppeteer'),
    fetch = require('node-fetch'),
    fs = require('fs');

const getData = () => {
    const xlsx = require('node-xlsx').default; //require inside function to get easy customize getData method
    const data = xlsx.parse(`${__dirname}/inputEmails.xlsx`); //get data from xlsx file
    //console.log(data[0].data[33][4])
    //console.log(data[0].data.splice(0,35))
    const formattedData = data[0].data;
    return formattedData
    /*return [
        ['LOLITWORKED@gmail.com', 'LOLITWORKED', 'LOLITWORKED', '1A.lsJwuNH1!/', '7387251783']
    ];*/ //for tests
}

const mainWrapper = async (data) => {
    for (let i = 0; i < data.length; i++) {
        result = fs.readFileSync('./.result', 'utf8')
        let currentCerdentails = data[i];
        if(result.indexOf(currentCerdentails[4])>-1)continue;
        try {
            console.log(currentCerdentails[4])
            await main(currentCerdentails);
        } catch (err) {
            if(err.message.indexOf("This email already registered")>-1){console.error(err.message);continue;}
            console.error(err);
            i--;
            continue;
        }
    }
}
const main = async (currentCerdentails) => {
    config.url = await fetch('https://www.bestbuy.com/identity/global/createAccount', { credentials: 'omit', follow: true }).then(function(response) {
        return response.url
    })
    console.info(config.url)
    let currentProxy = getNextProxy(config.proxyList);
    let currentProxyAdress = `${currentProxy.ipAddress}:${currentProxy.port}`;
    console.log(`currentProxyAdress: ${currentProxyAdress}`);

    let browser = await getNewPuppeteerBrowserInstance(currentProxyAdress);

    try {

        proxyIp = await getProxyIp(browser);
    } catch (err) {
        console.log(err);
        browser.close();
    }
    console.log(`checkIfIpIsUsed: ${checkIfIpIsUsedOrInvalid(proxyIp)}`);
    while (checkIfIpIsUsedOrInvalid(proxyIp)) {
        await browser.close();
        console.log(`while is running`);
        currentProxy = getNextProxy(config.proxyList);

        currentProxyAdress = `${currentProxy.ipAddress}:${currentProxy.port}`;
        browser = await getNewPuppeteerBrowserInstance(currentProxyAdress);
        try {
            proxyIp = await getProxyIp(browser);
        } catch (err) {
            console.log(err);
            continue;
        }
    }
    config.usedIps.push(proxyIp);
    console.log(`proxyIp: ${proxyIp}`);
    try {
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
                request.abort();
            } else {
                request.continue();
            }
        });
        page.setDefaultNavigationTimeout(25000);
        await page.goto(config.url, {waitUntil: "domcontentloaded"});
        /*await page.waitFor('.modal.fade.email-submission-modal.in .modal-header .close');
        console.log("waitedFor");

        await resolvePopups(page);*/
        currentCerdentails = transformData(currentCerdentails);
        currentCerdentails.ipRegistered = proxyIp;
        console.log(currentCerdentails);
        //await getRegistrationPage(page);
        await registerAccount(page, currentCerdentails);
        try {
            await page.waitForNavigation({ timeout: 30000, waitUntil: "domcontentloaded" });
            console.log('success');
            fs.appendFileSync('./.result', JSON.stringify(currentCerdentails) + ', ', 'utf8');
        }catch(err){
            currentCerdentails['ALREADY_REGISTERED_BUT_IP_NOT_SAVED'] = true;
            fs.appendFileSync('./.result', JSON.stringify(currentCerdentails) + ', ', 'utf8');
            throw new Error('This email already registered')
        }
    } catch (err) {
        await browser.close();
        throw new Error(err)
    }
    await browser.close();
}


const checkIfIpIsUsedOrInvalid = (ip) => {
    if (ip === 'HERE IS NO IP') {
        return true
    }
    for (i of config.usedIps) {
        if (i === ip) {
            return true
        }
    }
    return false;
}
const getProxyIp = async (browser) => {
    try {
        const page = await browser.newPage();
        await page.goto('https://api.ipify.org')
        const content = await page.content()
        const ip = await page.evaluate(() => {
            return document.getElementsByTagName('pre')[0].innerText
        })
        //console.log(ip)
        page.close();
        return ip
    } catch (err) {
        console.log(err)
        return "HERE IS NO IP";
    }
}
const transformData = (data) => {
    return {
        email: data[0],
        firstName: data[1],
        lastName: data[2],
        password: data[3],
        phone: data[4].replace(/-/g, '')
    }
}
const registerAccount = async (page, data) => {
    console.log('RegisterAccount')
    await page.type('#fld-firstName', data.firstName, {delay: 100})
    await page.type('#fld-lastName', data.lastName, {delay: 100})
    await page.type('#fld-e', data.email, {delay: 100})
    await page.type('#fld-p1', data.password, {delay: 100})
    await page.type('#fld-p2', data.password, {delay: 100})
    await page.type('#fld-phone', data.phone, {delay: 200})
    await page.click('.cia-form__submit-button.js-submit-button');
}

const getRegistrationPage = async (page) => {
    await page.click('#hf_accountMenuLink');
    await page.waitForSelector('.am-create-account__button.btn.btn-tertiary', { waitUntil: 25000 });
    await page.click('.am-create-account__button.btn.btn-tertiary')
    await page.waitForSelector('.cia-form__submit-button.js-submit-button', { waitUntil: 25000 });
}
const resolvePopups = async (page) => {
    if (await page.$('.modal.fade.email-submission-modal.in .modal-header .close') !== null) {
        console.log('resolvingPopups')
        await page.click('.modal.fade.email-submission-modal.in .modal-header .close')
        await page.waitFor(1000)
    }
}
const getNewPuppeteerBrowserInstance = async (proxyAdress) => {
    const browserOptions = {
        headless: true,
        ignoreHTTPSErrors: true,
        args: ['--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            //'--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            //'--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"',
            `--proxy-server=${proxyAdress}`
        ],
        defaultViewport: {
            width: 1280,
            height: 600,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            isLandscape: false
        }
    }
    const browser = await puppeteer.launch(browserOptions);
    return browser;
}
const getNextProxy = () => {
    config.lastProxyIndex += 1;
    console.log(config.lastProxyIndex + 1)
    if (config.lastProxyIndex === config.proxyList.length) {
        throw new Error("Proxy list ended!!!!")
    }
    return config.proxyList[config.lastProxyIndex];
}

mainWrapper(getData())