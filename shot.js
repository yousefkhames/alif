const puppeteer=require('puppeteer-core');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--lang=ar']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto('http://localhost:8123/'); await new Promise(r=>setTimeout(r,500));
 await p.screenshot({path:'/tmp/s1.png'});
 await p.type('#kidName','ليلى'); await p.click('#saveKid'); await new Promise(r=>setTimeout(r,400));
 await p.screenshot({path:'/tmp/s2.png'});
 await p.goto('http://localhost:8123/#/learn'); await new Promise(r=>setTimeout(r,300)); await p.screenshot({path:'/tmp/s3.png'});
 await p.goto('http://localhost:8123/#/learn/1'); await new Promise(r=>setTimeout(r,300)); await p.screenshot({path:'/tmp/s4.png',fullPage:true});
 await p.goto('http://localhost:8123/#/g/letters'); await new Promise(r=>setTimeout(r,300)); await p.click('#startBtn'); await new Promise(r=>setTimeout(r,400)); await p.screenshot({path:'/tmp/s5.png'});
 console.log(errs);
 await b.close();
})();
