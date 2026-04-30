(function () {
  'use strict';

  const CONFIG = {
    csvUrl: 'Gebetszeiten.csv',
    iqamahOffsets: { dhuhr: 10, asr: 10, maghrib: 5, isha: 0 },
    fajrIqamahFixed: "05:15",
    updateInterval: 1000
  };

  let cachedPrayerTimes = [];
  const pad = (n) => String(n).padStart(2, '0');

  // Erkennt die Sprache aus der HTML-Datei
  const currentLang = document.documentElement.lang || 'bs';

  // Bosnisch: Wochentage und Monate manuell (Browser-Support für 'bs' ist unzuverlässig)
  const BS_DAYS = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
  const BS_MONTHS = [
    'januara', 'februara', 'marta', 'aprila', 'maja', 'juna',
    'jula', 'augusta', 'septembra', 'oktobra', 'novembra', 'decembra'
  ];

  // Hijri-Monatsnamen auf Bosnisch
  const BS_HIJRI_MONTHS = [
    'Muharrem', 'Safer', 'Rebi\'ul-evvel', 'Rebi\'ul-ahir',
    'Džumadel-ula', 'Džumadel-uhra', 'Redžeb', 'Ša\'ban',
    'Ramazan', 'Ševval', 'Zul-ka\'de', 'Zul-hidždže'
  ];

  // Locale-Map: Sprache → bevorzugte Locale-Kette
  const LOCALE_MAP = {
    'bs': ['bs-BA', 'hr-HR', 'sr-Latn', 'de-DE'],
    'de': ['de-DE'],
    'ar': ['ar-SA'],
    'tr': ['tr-TR']
  };

  // Hijri-Locale-Map
  const HIJRI_LOCALE_MAP = {
    'bs': null, // wird manuell übersetzt
    'de': 'de-DE-u-ca-islamic-umalqura',
    'ar': 'ar-SA-u-ca-islamic-umalqura',
    'tr': 'tr-TR-u-ca-islamic-umalqura'
  };

  function getLocales() {
    return LOCALE_MAP[currentLang] || [currentLang, 'de-DE'];
  }

  function parseTimeToDate(timeStr, baseDate = new Date()) {
    if (!timeStr) return null;
    const [hh, mm] = timeStr.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  async function loadVaktijaData() {
    try {
      const response = await fetch(CONFIG.csvUrl);
      if (!response.ok) throw new Error('CSV Fehler');
      const text = await response.text();
      const rows = text.replace(/\r/g, "").split('\n').filter(row => row.length > 10);
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const todayRow = rows.find(row => row.startsWith(todayKey));
      if (todayRow) {
        cachedPrayerTimes = todayRow.split(';');
        renderPrayerTimes(cachedPrayerTimes);
      }
    } catch (error) { console.error("Vaktija Error:", error); }
  }

  function renderPrayerTimes(cols) {
    const fields = {
      'time-fajr': cols[1], 'time-sunrise': cols[2], 'time-dhuhr': cols[3],
      'time-asr': cols[4], 'time-maghrib': cols[5], 'time-isha': cols[6], 'time-jumuah': cols[7]
    };
    for (const [id, val] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el && val) el.textContent = val.trim().substring(0, 5);
    }
    setIqamah('time-iqamah-fajr', CONFIG.fajrIqamahFixed);
    calcAndSetIqamah('time-iqamah-dhuhr', cols[3], CONFIG.iqamahOffsets.dhuhr);
    calcAndSetIqamah('time-iqamah-asr', cols[4], CONFIG.iqamahOffsets.asr);
    calcAndSetIqamah('time-maghrib-iqamah', cols[5], CONFIG.iqamahOffsets.maghrib);
    calcAndSetIqamah('time-iqamah-isha', cols[6], CONFIG.iqamahOffsets.isha);
  }

  function setIqamah(id, time) {
    const el = document.getElementById(id);
    if (el) el.textContent = time;
  }

  function calcAndSetIqamah(id, adhanStr, offsetMin) {
    const el = document.getElementById(id);
    if (!el || !adhanStr) return;
    const adhanDate = parseTimeToDate(adhanStr);
    if (adhanDate) {
      const iqDate = new Date(adhanDate.getTime() + offsetMin * 60000);
      el.textContent = `${pad(iqDate.getHours())}:${pad(iqDate.getMinutes())}`;
    }
  }

  // Bosnisch: Datum manuell formatieren (zuverlässig, browserunabhängig)
  function formatDateBosnian(now) {
    const dayName = BS_DAYS[now.getDay()];
    const day = now.getDate();
    const month = BS_MONTHS[now.getMonth()];
    const year = now.getFullYear();
    return {
      dayName: dayName,
      dateStr: `${day}. ${month} ${year}.`
    };
  }

  // Hijri-Datum für Bosnisch manuell übersetzen
  function formatHijriBosnian(now) {
    try {
      // Hole die Hijri-Zahlen via englischem Locale (zuverlässig)
      const hijriEn = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
        day: 'numeric', month: 'numeric', year: 'numeric'
      }).formatToParts(now);

      const dayPart   = hijriEn.find(p => p.type === 'day');
      const monthPart = hijriEn.find(p => p.type === 'month');
      const yearPart  = hijriEn.find(p => p.type === 'year');

      if (dayPart && monthPart && yearPart) {
        const monthIndex = parseInt(monthPart.value, 10) - 1;
        const monthName = BS_HIJRI_MONTHS[monthIndex] || monthPart.value;
        return `${dayPart.value}. ${monthName} ${yearPart.value}. h.`;
      }
    } catch (e) { /* ignorieren */ }
    return '';
  }

  function runEngine() {
    const now = new Date();

    // 1. Uhrzeit
    const clockEl = document.getElementById('current-time');
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString('de-DE', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }

    // 2. Datum & Wochentag
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
      let dayName, dateStr;

      if (currentLang === 'bs') {
        // Bosnisch: manuelle, browserunabhängige Formatierung
        const formatted = formatDateBosnian(now);
        dayName = formatted.dayName;
        dateStr = formatted.dateStr;
      } else {
        // Alle anderen Sprachen: native Intl-Formatierung
        const locales = getLocales();
        dayName = new Intl.DateTimeFormat(locales, { weekday: 'long' }).format(now);
        dateStr = new Intl.DateTimeFormat(locales, { day: '2-digit', month: 'long', year: 'numeric' }).format(now);
        dayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      }

      dateEl.innerHTML = `${dayName}<br><span style="font-size: 0.8em; opacity: 0.85;">${dateStr}</span>`;
    }

    // 3. Hijri Datum
    const hijriEl = document.getElementById('hijri-date');
    if (hijriEl) {
      if (currentLang === 'bs') {
        // Bosnisch: manuelle Übersetzung der Hijri-Monatsnamen
        hijriEl.textContent = formatHijriBosnian(now);
      } else {
        // Alle anderen Sprachen: native Intl-Formatierung
        const hijriLocale = HIJRI_LOCALE_MAP[currentLang];
        try {
          if (hijriLocale) {
            hijriEl.textContent = new Intl.DateTimeFormat(hijriLocale, {
              day: 'numeric', month: 'long', year: 'numeric'
            }).format(now);
          } else {
            throw new Error('Kein Hijri-Locale');
          }
        } catch (e) {
          try {
            hijriEl.textContent = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
              day: 'numeric', month: 'long', year: 'numeric'
            }).format(now);
          } catch (e2) {
            hijriEl.textContent = '';
          }
        }
      }
    }

    updateCountdown(now);
  }

  function updateCountdown(now) {
    if (cachedPrayerTimes.length < 7) return;
    const prayerIndices = [1, 3, 4, 5, 6];
    let nextPrayerDate = null;
    for (let idx of prayerIndices) {
      const pDate = parseTimeToDate(cachedPrayerTimes[idx], now);
      if (pDate && pDate > now) { nextPrayerDate = pDate; break; }
    }
    if (!nextPrayerDate) {
      nextPrayerDate = parseTimeToDate(cachedPrayerTimes[1], now);
      nextPrayerDate.setDate(nextPrayerDate.getDate() + 1);
    }
    const diffMs = nextPrayerDate - now;
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    const s = Math.floor((diffMs % 60000) / 1000);
    const timerEl = document.getElementById('countdown-timer');
    if (timerEl) { timerEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`; }
  }

  function init() {
    loadVaktijaData();
    runEngine();
    setInterval(runEngine, CONFIG.updateInterval);
    setInterval(loadVaktijaData, 30 * 60000);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();