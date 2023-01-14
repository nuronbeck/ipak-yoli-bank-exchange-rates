require('dotenv').config();
const puppeteer = require('puppeteer');
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));

app.get('/rates', async (req, res) => {
  let browser = null;

  if(!process.env.BANK_EXCHANGE_URL) {
    console.log(`Environment value doesn't exist!\n.env\n BANK_EXCHANGE_URL=${process.env.BANK_EXCHANGE_URL}\n`);
    process.exit();
  }

  try {
    browser = await puppeteer.launch();

    const page = await browser.newPage();
    await page.setViewport({ width: 768, height: 1080 });

    // Optimizing page opening
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      const excludedResources = [ 'stylesheet', 'font', 'image', 'media' ];

      if(excludedResources.includes(resourceType)){
        req.abort();
      }
      else {
        req.continue();
      }
    });

    await page.goto(process.env.BANK_EXCHANGE_URL);

    const result = await page.$$eval('article table tbody tr', rows => {
      const ACCEPTED_CURRENCIES = ["USD", /* "EUR", "GBP", "JPY" */];

      const parsedData = Array.from(rows, row => {
        const rowColumns = row.querySelectorAll('td');
        const [ column1, , column3, column4 ] = rowColumns;

        const currency = (column1?.childNodes[0]?.textContent || '').replace(/\s/g, '');
        const title = column1.querySelector("small")?.textContent || '';
        const buy = column3?.textContent || '';
        const sell = column4?.textContent || '';

        return { currency, title, buy, sell };
      });

      const filteredData = parsedData.filter((currencyInfo) => {
        const checkAccepted = ACCEPTED_CURRENCIES.includes(currencyInfo?.currency.toUpperCase())
        const checkNotATM = !(currencyInfo?.title?.indexOf("через банкоматы") !== -1)
        const checkNotSystemDBO = !(currencyInfo?.title?.indexOf("через систему ДБО") !== -1)

        return checkAccepted && checkNotATM && checkNotSystemDBO
      })

      return filteredData;
    });

    res.status(200).send(result[0]);
  }
  catch (error) {
    console.log(error?.message);
    res.status(400).send(error);
  }
  finally {
    if(browser){
      await browser.close();
    }
  }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})