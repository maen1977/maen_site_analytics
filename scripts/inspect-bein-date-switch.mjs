import { chromium } from 'playwright-core';
import fs from 'node:fs';
const executablePath=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find((p)=>fs.existsSync(p));
const browser=await chromium.launch({headless:false,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'en-US',userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'});
 await page.goto('https://www.beinsports.com/en-mena/tv-guide',{waitUntil:'domcontentloaded',timeout:90000}); await page.waitForTimeout(3500);
 const tiles=()=>page.locator('div[tabindex="0"]').evaluateAll(els=>els.map((el)=>({text:(el.textContent||'').trim(),cls:el.className,box:(()=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()})).filter(x=>/^\w{3}\d{1,2}$/.test(x.text)));
 console.log('before',JSON.stringify(await tiles()));
 for(const day of ['27','28','29']){
   const tile=page.locator('div[tabindex="0"]').filter({has:page.locator('span').filter({hasText:new RegExp(`^${day}$`)})}).filter({hasText:new RegExp(`\b${day}$`)}).first();
   console.log('target',day,'count',await tile.count());
   if(await tile.count()) {await tile.click({force:true}); await page.waitForTimeout(1200); console.log('after',day,JSON.stringify(await tiles()));}
 }
} finally {await browser.close();}
