import { chromium } from 'playwright-core';
import fs from 'node:fs';
const paths=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=paths.find((p)=>fs.existsSync(p));
const browser=await chromium.launch({headless:false, executablePath, args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'en-US',userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'});
  await page.goto('https://www.beinsports.com/en-mena/tv-guide',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForTimeout(3500);
  const info=await page.evaluate(()=>Array.from(document.querySelectorAll('*')).map((el)=>({text:(el.textContent||'').trim(),tag:el.tagName,cls:typeof el.className==='string'?el.className:'',role:el.getAttribute('role'),aria:el.getAttribute('aria-selected'),parent:el.parentElement?.outerHTML?.slice(0,1500),grandparent:el.parentElement?.parentElement?.outerHTML?.slice(0,1800),html:el.outerHTML.slice(0,900)})).filter((x)=>['24','25','26','27','28','29','30','31','01'].includes(x.text)).slice(0,80));
  console.log(JSON.stringify(info,null,2));
} finally {await browser.close();}
