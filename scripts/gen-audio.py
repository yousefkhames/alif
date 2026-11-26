import asyncio, edge_tts, json, subprocess, os, re
VOICE='ar-SA-ZariyahNeural'
names=['أَلِف','بَاء','تَاء','ثَاء','جِيم','حَاء','خَاء','دَال','ذَال','رَاء','زَاي','سِين','شِين','صَاد','ضَاد','طَاء','ظَاء','عَيْن','غَيْن','فَاء','قَاف','كَاف','لَام','مِيم','نُون','هَاء','وَاو','يَاء']
words=['أَسَد','بَطَّة','تُفَّاحَة','ثَعْلَب','جَمَل','حِصَان','خَرُوف','دَجَاجَة','ذُرَة','رُزّ','زَرَافَة','سَمَكَة','شَمْس','صَارُوخ','ضِفْدَع','طَائِرَة','ظَرْف','عِنَب','غَيْمَة','فِيل','قَمَر','كِتَاب','لِيمُون','مَوْز','نَجْمَة','هَدِيَّة','وَرْدَة','يَد']
letters='ابتثجحخدذرزسشصضطظعغفقكلمنهوي'
sounds=['أَ']+[c+'َ' for c in letters[1:]]
nums=['صِفْر','وَاحِد','اثْنَان','ثَلَاثَة','أَرْبَعَة','خَمْسَة','سِتَّة','سَبْعَة','ثَمَانِيَة','تِسْعَة','عَشَرَة','أَحَدَ عَشَر','اثْنَا عَشَر','ثَلَاثَةَ عَشَر','أَرْبَعَةَ عَشَر','خَمْسَةَ عَشَر','سِتَّةَ عَشَر','سَبْعَةَ عَشَر','ثَمَانِيَةَ عَشَر','تِسْعَةَ عَشَر','عِشْرُون']
praise=['أَحْسَنْتِ','مُمْتَاز','رَائِع','بَرَافُو','حَاوِلْ مَرَّةً أُخْرَى']
jobs=[]
for i,t in enumerate(names): jobs.append(('n%02d'%i,t,'-20%'))
for i,t in enumerate(sounds): jobs.append(('s%02d'%i,t,'-30%'))
for i,t in enumerate(words): jobs.append(('w%02d'%i,t,'-15%'))
for i,t in enumerate(nums): jobs.append(('d%02d'%i,t,'-15%'))
for i,t in enumerate(praise): jobs.append(('p%02d'%i,t,'-5%'))
jobs[-5+0]=('p00','أَحْسَنْتَ','-5%')
async def one(k,t,r):
    out=f'/tmp/gen/raw/{k}.mp3'
    if os.path.exists(out): return
    for a in range(4):
        try:
            await edge_tts.Communicate(t,VOICE,rate=r).save(out); return
        except Exception as e:
            await asyncio.sleep(2)
    print('FAIL',k)
async def main():
    os.makedirs('/tmp/gen/raw',exist_ok=True)
    sem=asyncio.Semaphore(4)
    async def w(j):
        async with sem: await one(*j)
    await asyncio.gather(*[w(j) for j in jobs])
asyncio.run(main())
json.dump(jobs,open('/tmp/gen/jobs.json','w'),ensure_ascii=False)
