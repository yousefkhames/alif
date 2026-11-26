/* Alif data: letters, number words, UI strings. Plain script, works in browser and Node. */
(function (root) {
  'use strict';

  // c: letter, ar/en: letter name, w: example word (starts with the letter), e: emoji, wen: English word
  // join: true if the letter connects to the next letter (has initial/medial forms)
  var LETTERS = [
    { c: 'ا', ar: 'ألف', en: 'Alif', w: 'أسد', e: '🦁', wen: 'lion', join: false },
    { c: 'ب', ar: 'باء', en: 'Baa', w: 'بطة', e: '🦆', wen: 'duck', join: true },
    { c: 'ت', ar: 'تاء', en: 'Taa', w: 'تفاحة', e: '🍎', wen: 'apple', join: true },
    { c: 'ث', ar: 'ثاء', en: 'Thaa', w: 'ثعلب', e: '🦊', wen: 'fox', join: true },
    { c: 'ج', ar: 'جيم', en: 'Jeem', w: 'جمل', e: '🐪', wen: 'camel', join: true },
    { c: 'ح', ar: 'حاء', en: 'Haa', w: 'حصان', e: '🐴', wen: 'horse', join: true },
    { c: 'خ', ar: 'خاء', en: 'Khaa', w: 'خروف', e: '🐑', wen: 'sheep', join: true },
    { c: 'د', ar: 'دال', en: 'Dal', w: 'دجاجة', e: '🐔', wen: 'hen', join: false },
    { c: 'ذ', ar: 'ذال', en: 'Dhal', w: 'ذرة', e: '🌽', wen: 'corn', join: false },
    { c: 'ر', ar: 'راء', en: 'Raa', w: 'رز', e: '🍚', wen: 'rice', join: false },
    { c: 'ز', ar: 'زاي', en: 'Zay', w: 'زرافة', e: '🦒', wen: 'giraffe', join: false },
    { c: 'س', ar: 'سين', en: 'Seen', w: 'سمكة', e: '🐟', wen: 'fish', join: true },
    { c: 'ش', ar: 'شين', en: 'Sheen', w: 'شمس', e: '☀️', wen: 'sun', join: true },
    { c: 'ص', ar: 'صاد', en: 'Sad', w: 'صاروخ', e: '🚀', wen: 'rocket', join: true },
    { c: 'ض', ar: 'ضاد', en: 'Dad', w: 'ضفدع', e: '🐸', wen: 'frog', join: true },
    { c: 'ط', ar: 'طاء', en: 'Taa (heavy)', w: 'طائرة', e: '✈️', wen: 'plane', join: true },
    { c: 'ظ', ar: 'ظاء', en: 'Dhaa (heavy)', w: 'ظرف', e: '✉️', wen: 'envelope', join: true },
    { c: 'ع', ar: 'عين', en: 'Ayn', w: 'عنب', e: '🍇', wen: 'grapes', join: true },
    { c: 'غ', ar: 'غين', en: 'Ghayn', w: 'غيمة', e: '☁️', wen: 'cloud', join: true },
    { c: 'ف', ar: 'فاء', en: 'Faa', w: 'فيل', e: '🐘', wen: 'elephant', join: true },
    { c: 'ق', ar: 'قاف', en: 'Qaf', w: 'قمر', e: '🌙', wen: 'moon', join: true },
    { c: 'ك', ar: 'كاف', en: 'Kaf', w: 'كتاب', e: '📖', wen: 'book', join: true },
    { c: 'ل', ar: 'لام', en: 'Lam', w: 'ليمون', e: '🍋', wen: 'lemon', join: true },
    { c: 'م', ar: 'ميم', en: 'Meem', w: 'موز', e: '🍌', wen: 'banana', join: true },
    { c: 'ن', ar: 'نون', en: 'Noon', w: 'نجمة', e: '⭐', wen: 'star', join: true },
    { c: 'ه', ar: 'هاء', en: 'Haa (light)', w: 'هدية', e: '🎁', wen: 'gift', join: true },
    { c: 'و', ar: 'واو', en: 'Waw', w: 'وردة', e: '🌹', wen: 'rose', join: false },
    { c: 'ي', ar: 'ياء', en: 'Yaa', w: 'يد', e: '✋', wen: 'hand', join: true }
  ];

  var NUM_WORDS = {
    ar: ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
      'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر', 'عشرون'],
    en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
      'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
  };

  // things to count
  var COUNTABLES = ['🍎', '⭐', '🐟', '🎈', '🍪', '🌸', '🚗', '🐥', '🍓', '⚽'];

  var AVATARS = ['🦁', '🐘', '🦊', '🐬', '🦉', '🐢', '🐰', '🦋'];

  var STR = {
    ar: {
      appName: 'ألف',
      tagline: 'حروف وأرقام وحساب للصغار، بدون إنترنت وبدون إعلانات',
      play: 'العب', home: 'الرئيسية', back: 'رجوع', next: 'التالي', again: 'العب مرة أخرى',
      learnLetters: 'تعلّم الحروف', learnNumbers: 'تعلّم الأرقام', learnNumbersD: 'من صفر إلى عشرين', letterHunt: 'صيد الحروف', counting: 'عدّ معي',
      sequence: 'أكمل الأرقام', math: 'حساب سريع', progress: 'نجومي', parents: 'ركن الأهل',
      learnLettersD: 'اضغط على الحرف لترى أشكاله', letterHuntD: 'ما الحرف الأول؟',
      countingD: 'كم عددها؟', sequenceD: 'ما الرقم الناقص؟', mathD: 'جمع وطرح وضرب',
      pickLetter: 'ما الحرف الأول من هذه الكلمة؟', pickPicture: 'أي صورة تبدأ بهذا الحرف؟',
      howMany: 'كم عدد الأشياء؟', missing: 'ما الرقم الناقص؟', solve: 'احسب الناتج',
      correct: ['أحسنت!', 'ممتاز!', 'رائع!', 'برافو!'], wrong: 'حاول مرة أخرى', itIs: 'الإجابة',
      question: 'سؤال', of: 'من', stars: 'نجوم', roundDone: 'انتهت الجولة', score: 'النتيجة',
      level: 'المستوى', level1: 'سهل', level2: 'متوسط', level3: 'صعب',
      add: 'جمع', sub: 'طرح', mul: 'ضرب', mix: 'مختلط',
      isolated: 'منفصل', initial: 'أول الكلمة', medial: 'وسط الكلمة', final: 'آخر الكلمة',
      listen: 'استمع', letterSound: 'صوت الحرف', sayName: 'اسم الحرف', exampleWord: 'مثال', learned: 'تعلمتُ هذا الحرف',
      noVoice: 'لم يجد جهازك صوتًا عربيًا. يمكنك تفعيله من إعدادات الجهاز.',
      language: 'اللغة', digits: 'شكل الأرقام', digitsAr: '٣ ٢ ١ (هندية)', digitsEn: '1 2 3 (غربية)',
      sound: 'أصوات اللعب', speech: 'نطق الحروف', on: 'تشغيل', off: 'إيقاف',
      whoPlays: 'من يلعب؟', addKid: 'إضافة طفل', kidName: 'اسم الطفل', save: 'حفظ', cancel: 'إلغاء',
      delete: 'حذف', deleteKid: 'حذف هذا الطفل', rename: 'تعديل',
      backup: 'نسخة احتياطية', export: 'تنزيل النسخة', import: 'استيراد نسخة', importOk: 'تم الاستيراد',
      importBad: 'الملف غير صالح', resetAll: 'مسح كل البيانات', holdReset: 'اضغط مطولًا للمسح',
      honest: 'البيانات محفوظة في هذا المتصفح فقط على هذا الجهاز. لا حسابات ولا خادم ولا تتبع.',
      letterMastery: 'إتقان الحروف', gameBest: 'أفضل نتيجة', totalStars: 'مجموع النجوم',
      played: 'جولات', keypadOk: 'تأكيد', clear: 'مسح', gate: 'ركن الأهل: احسب لتفتح',
      gateWrong: 'إجابة غير صحيحة', switchKid: 'تغيير الطفل', installHint: 'يعمل بدون إنترنت بعد أول زيارة',
      maxKids: 'الحد الأقصى ٦ أطفال', empty: 'لا يوجد أطفال بعد', letterOf: 'حرف',
      mastered: 'متقن', learning: 'يتعلم', newL: 'جديد', streak: 'سلسلة'
    },
    en: {
      appName: 'Alif',
      tagline: 'Arabic letters, numbers and sums for kids. Offline, no ads.',
      play: 'Play', home: 'Home', back: 'Back', next: 'Next', again: 'Play again',
      learnLetters: 'Learn letters', learnNumbers: 'Learn numbers', learnNumbersD: 'From zero to twenty', letterHunt: 'Letter hunt', counting: 'Count with me',
      sequence: 'Number gaps', math: 'Quick math', progress: 'My stars', parents: 'Grown-ups',
      learnLettersD: 'Tap a letter to see its shapes', letterHuntD: 'Which letter does it start with?',
      countingD: 'How many are there?', sequenceD: 'Which number is missing?', mathD: 'Add, subtract, multiply',
      pickLetter: 'Which letter does this word start with?', pickPicture: 'Which picture starts with this letter?',
      howMany: 'How many things are there?', missing: 'Which number is missing?', solve: 'Work it out',
      correct: ['Well done!', 'Great!', 'Brilliant!', 'Bravo!'], wrong: 'Try again', itIs: 'Answer',
      question: 'Question', of: 'of', stars: 'stars', roundDone: 'Round complete', score: 'Score',
      level: 'Level', level1: 'Easy', level2: 'Medium', level3: 'Hard',
      add: 'Add', sub: 'Subtract', mul: 'Multiply', mix: 'Mixed',
      isolated: 'Alone', initial: 'Start of word', medial: 'Middle of word', final: 'End of word',
      listen: 'Listen', letterSound: 'Letter sound', sayName: 'Letter name', exampleWord: 'Example', learned: 'I learned this letter',
      noVoice: 'Your device has no Arabic voice installed. You can add one in the device settings.',
      language: 'Language', digits: 'Digit style', digitsAr: '٣ ٢ ١ (Arabic-Indic)', digitsEn: '1 2 3 (Western)',
      sound: 'Game sounds', speech: 'Spoken letters', on: 'On', off: 'Off',
      whoPlays: 'Who is playing?', addKid: 'Add a child', kidName: 'Child name', save: 'Save', cancel: 'Cancel',
      delete: 'Delete', deleteKid: 'Delete this child', rename: 'Edit',
      backup: 'Backup', export: 'Download backup', import: 'Import backup', importOk: 'Imported',
      importBad: 'That file is not valid', resetAll: 'Erase all data', holdReset: 'Press and hold to erase',
      honest: 'Data is saved only in this browser on this device. No accounts, no server, no tracking.',
      letterMastery: 'Letter mastery', gameBest: 'Best score', totalStars: 'Total stars',
      played: 'rounds', keypadOk: 'OK', clear: 'Clear', gate: 'Grown-ups only: solve to open',
      gateWrong: 'Not quite', switchKid: 'Switch child', installHint: 'Works offline after the first visit',
      maxKids: 'Up to 6 children', empty: 'No children yet', letterOf: 'letter',
      mastered: 'Mastered', learning: 'Learning', newL: 'New', streak: 'Streak'
    }
  };

  var api = { LETTERS: LETTERS, NUM_WORDS: NUM_WORDS, COUNTABLES: COUNTABLES, AVATARS: AVATARS, STR: STR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AlifData = api;
})(typeof self !== 'undefined' ? self : this);
