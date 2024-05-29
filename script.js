document.addEventListener('DOMContentLoaded', function () {
  const pulseWidthSlider = document.getElementById('pulseWidth');
  const pulseFrequencySlider = document.getElementById('pulseFrequency');
  const durationSlider = document.getElementById('duration');
  const currentSlider = document.getElementById('current');
  const impedanceSlider = document.getElementById('impedance');
  const genderSelect = document.getElementById('gender');
  const ageInput = document.getElementById('age');
  const totalChargeLabel = document.getElementById('totalCharge');
  const pulseWidthValue = document.getElementById('pulseWidthValue');
  const pulseFrequencyValue = document.getElementById('pulseFrequencyValue');
  const durationValue = document.getElementById('durationValue');
  const currentValue = document.getElementById('currentValue');
  const impedanceValue = document.getElementById('impedanceValue');
  const voltageLabel = document.getElementById('voltage');
  const energyLabel = document.getElementById('energy');

  const ctx = document.getElementById('currentChart').getContext('2d');
  const voltageCtx = document.getElementById('voltageChart').getContext('2d');
  let currentChart;

  // Chart styling matching the page (Inter, muted grey axes, light grid)
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#757575';
  Chart.defaults.borderColor = '#e6e6e6';
  let voltageChart;

  function checkChargeRange(totalCharge, gender, age) {
    const ageInt = parseInt(age, 10);
    let minCharge, maxCharge;

    if (gender === 'female') {
      if (ageInt >= 18 && ageInt < 30) {
        minCharge = 180;
        maxCharge = 280;
      } else if (ageInt === 30) {
        minCharge = 280;
        maxCharge = 320;
      } else if (ageInt > 30 && ageInt < 40) {
        minCharge = 280;
        maxCharge = 320;
      } else if (ageInt === 40) {
        minCharge = 280;
        maxCharge = 380;
      } else if (ageInt > 40 && ageInt < 50) {
        minCharge = 320;
        maxCharge = 380;
      } else if (ageInt === 50) {
        minCharge = 320;
        maxCharge = 530;
      } else if (ageInt > 50 && ageInt < 60) {
        minCharge = 380;
        maxCharge = 530;
      } else if (ageInt === 60) {
        minCharge = 380;
        maxCharge = 650;
      } else if (ageInt > 60) {
        minCharge = 530;
        maxCharge = 650;
      }
    } else if (gender === 'male') {
      if (ageInt >= 18 && ageInt < 30) {
        minCharge = 190;
        maxCharge = 290;
      } else if (ageInt === 30) {
        minCharge = 290;
        maxCharge = 380;
      } else if (ageInt > 30 && ageInt < 40) {
        minCharge = 290;
        maxCharge = 380;
      } else if (ageInt === 40) {
        minCharge = 290;
        maxCharge = 420;
      } else if (ageInt > 40 && ageInt < 50) {
        minCharge = 380;
        maxCharge = 420;
      } else if (ageInt === 50) {
        minCharge = 380;
        maxCharge = 570;
      } else if (ageInt > 50 && ageInt < 60) {
        minCharge = 420;
        maxCharge = 570;
      } else if (ageInt === 60) {
        minCharge = 420;
        maxCharge = 1000;
      } else if (ageInt > 60) {
        minCharge = 570;
        maxCharge = 1000;
      }
    }

    if (minCharge !== undefined && maxCharge !== undefined) {
      return totalCharge >= minCharge && totalCharge <= maxCharge;
    }
    return false;
  }

  function updateTotalCharge() {
    const pulseWidth = parseFloat(pulseWidthSlider.value);
    const pulseFrequency = parseFloat(pulseFrequencySlider.value);
    const duration = parseFloat(durationSlider.value);
    const current = parseFloat(currentSlider.value);
    const totalCharge = ((pulseWidth * pulseFrequency * 2) / 1000) * duration * current;
    totalChargeLabel.textContent = totalCharge.toFixed(2);

    const impedance = parseFloat(impedanceSlider.value);
    const voltage = (current / 1000) * impedance;
    const energy = (totalCharge / 1000) * (current / 1000) * impedance;

    voltageLabel.textContent = voltage.toFixed(2);
    energyLabel.textContent = energy.toFixed(2);

    if (voltage < 50 || voltage > 400) {
      voltageLabel.style.color = 'var(--bad)';
    } else {
      voltageLabel.style.color = 'var(--ok)';
    }

    const gender = genderSelect.value;
    const age = ageInput.value;

    if (checkChargeRange(totalCharge, gender, age)) {
      totalChargeLabel.style.color = 'var(--ok)';
    } else {
      totalChargeLabel.style.color = 'var(--bad)';
    }
  }

  function updateGraph() {
    const pulseWidth = parseFloat(pulseWidthSlider.value);
    const pulseFrequency = parseFloat(pulseFrequencySlider.value) * 2;
    const current = parseFloat(currentSlider.value);
    const impedance = parseFloat(impedanceSlider.value);
    const voltage = (current / 1000) * impedance;
    const currentPulses = [];
    const voltagePulses = [];
    const labels = [];
    const duration = 25;
    const step = 0.1;
    const period = 1000 / pulseFrequency;

    for (let t = 0; t <= duration; t += step) {
      const timeInPeriod = (t + period) % period;
      const centeredPulseStart = (period - pulseWidth) / 2;
      const centeredPulseEnd = centeredPulseStart + pulseWidth;

      const inPulse = timeInPeriod >= centeredPulseStart && timeInPeriod < centeredPulseEnd;

      if (inPulse) {
        if (Math.floor(t / period) % 2 === 0) {
          currentPulses.push(current);
          voltagePulses.push(voltage);
        } else {
          currentPulses.push(-current);
          voltagePulses.push(-voltage);
        }
      } else {
        currentPulses.push(0);
        voltagePulses.push(0);
      }
      labels.push(t.toFixed(1));
    }

    if (currentChart) {
      currentChart.destroy();
    }

    if (voltageChart) {
      voltageChart.destroy();
    }

    currentChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: currentPulses,
          borderColor: '#0d99ff',
          borderWidth: 2,
          fill: false,
          stepped: true,
          pointRadius: 0
        }]
      },
      options: {
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            min: 0,
            max: duration,
            title: {
              display: true,
              text: getGraphLabels('current').x
            },
            ticks: {
              stepSize: 1,
              callback: function (value) {
                return value;
              }
            }
          },
          y: {
            min: -1000,
            max: 1000,
            title: {
              display: true,
              text: getGraphLabels('current').y
            },
            ticks: {
              stepSize: 100,
              callback: function (value) {
                return value;
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    voltageChart = new Chart(voltageCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: voltagePulses,
          borderColor: '#14ae5c',
          borderWidth: 2,
          fill: false,
          stepped: true,
          pointRadius: 0
        }]
      },
      options: {
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            min: 0,
            max: duration,
            title: {
              display: true,
              text: getGraphLabels('voltage').x
            },
            ticks: {
              stepSize: 1,
              callback: function (value) {
                return value;
              }
            }
          },
          y: {
            min: -500,
            max: 500,
            title: {
              display: true,
              text: getGraphLabels('voltage').y
            },
            ticks: {
              stepSize: 50,
              callback: function (value) {
                return value;
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          annotation: {
            annotations: {
              box1: {
                type: 'box',
                xMin: 0,
                xMax: duration,
                yMin: 400,
                yMax: 500,
                backgroundColor: 'rgba(242, 72, 34, 0.12)',
                borderColor: 'rgba(242, 72, 34, 0.35)',
                borderWidth: 1,
                borderDash: [5, 5]
              },
              box2: {
                type: 'box',
                xMin: 0,
                xMax: duration,
                yMin: -50,
                yMax: 50,
                backgroundColor: 'rgba(242, 72, 34, 0.12)',
                borderColor: 'rgba(242, 72, 34, 0.35)',
                borderWidth: 1,
                borderDash: [5, 5]
              },
              box3: {
                type: 'box',
                xMin: 0,
                xMax: duration,
                yMin: -400,
                yMax: -500,
                backgroundColor: 'rgba(242, 72, 34, 0.12)',
                borderColor: 'rgba(242, 72, 34, 0.35)',
                borderWidth: 1,
                borderDash: [5, 5]
              }
            }
          }
        }
      }
    });
  }

  function getGraphLabels(chartType) {
    const lang = localStorage.getItem('lang') || 'en';
    if (chartType === 'voltage') {
      return {
        x: window.translations.timeLabel || 'Time (ms)',
        y: window.translations.voltageLabel || 'Voltage (V)'
      };
    } else {
      return {
        x: window.translations.timeLabel || 'Time (ms)',
        y: window.translations.currentLabel || 'Current (mA)'
      };
    }
  }

  function loadTranslations(lang) {
    fetch(`localization-${lang}.json`)
      .then(response => response.json())
      .then(data => {
        window.translations = data;
        document.querySelectorAll('[data-i18n]').forEach(element => {
          const key = element.getAttribute('data-i18n');
          if (translations[key]) {
            if (element.tagName === 'INPUT' || element.tagName === 'SELECT') {
              element.placeholder = translations[key];
            } else {
              element.innerHTML = translations[key];
            }
          }
        });
        renderFormulas(true);
        updateGraph();
      })
      .catch(error => console.error('Error loading localization file:', error));
  }

  /* Formulas: one line on wide screens; on narrow (mobile) screens a version broken over several
   * lines (MathJax 3 has no automatic line breaking), scaled down further only if it still overflows */
  const NARROW_FORMULA_PX = 640;
  let formulaMode = null;
  function renderFormulas(force) {
    const t = window.translations || {};
    const narrow = document.getElementById('totalChargeFormula').clientWidth < NARROW_FORMULA_PX;
    const mode = narrow ? 'narrow' : 'wide';
    if (!force && mode === formulaMode) { fitFormulas(); return; }
    formulaMode = mode;
    [['totalChargeFormula', 'totalChargeFormula'], ['energyFormula', 'energyFormula']].forEach(([id, key]) => {
      const el = document.getElementById(id);
      el.style.fontSize = '';
      el.innerHTML = (narrow && t[key + 'Narrow']) || t[key] || el.innerHTML;
    });
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise().then(fitFormulas);
  }
  function fitFormulas() {
    document.querySelectorAll('.formula').forEach(el => {
      el.style.fontSize = '';
      const math = el.querySelector('mjx-container > mjx-math, mjx-container > svg');
      if (!math) return;
      const ratio = el.clientWidth / math.getBoundingClientRect().width;
      // scale down from the responsive CSS size (not from the parent), never below 60 % of it
      const base = parseFloat(getComputedStyle(el).fontSize);
      if (ratio < 1) el.style.fontSize = `${(base * Math.max(0.6, ratio * 0.98)).toFixed(2)}px`;
    });
  }
  // MathJax loads asynchronously and may typeset after the translations: fit once it has finished
  window.addEventListener('load', () => {
    if (window.MathJax && MathJax.startup && MathJax.startup.promise) MathJax.startup.promise.then(() => renderFormulas(true));
  });
  let formulaTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(formulaTimer);
    formulaTimer = setTimeout(() => renderFormulas(false), 150);
  });

  function setLanguage(lang) {
    localStorage.setItem('lang', lang);

    loadTranslations(lang);

    const englishFlag = document.getElementById('en');
    const swedishFlag = document.getElementById('sv');

    if (lang === 'sv') {
      englishFlag.style.display = 'inline';
      swedishFlag.style.display = 'none';
    } else if (lang === 'en') {
      englishFlag.style.display = 'none';
      swedishFlag.style.display = 'inline';
    }
  }

  pulseWidthSlider.addEventListener('input', function () {
    pulseWidthValue.textContent = this.value;
    updateTotalCharge();
    updateGraph();
  });

  pulseFrequencySlider.addEventListener('input', function () {
    pulseFrequencyValue.textContent = this.value;
    updateTotalCharge();
    updateGraph();
  });

  durationSlider.addEventListener('input', function () {
    const value = parseFloat(this.value);

    if (value < 4.0) {
      this.step = 0.25;
    } else {
      this.step = 0.5;
    }

    durationValue.textContent = this.value;
    updateTotalCharge();
    updateGraph();
  });

  currentSlider.addEventListener('input', function () {
    currentValue.textContent = this.value;
    updateTotalCharge();
    updateGraph();
  });

  impedanceSlider.addEventListener('input', function () {
    impedanceValue.textContent = this.value;
    updateTotalCharge();
    updateGraph();
  });

  genderSelect.addEventListener('input', function () {
    updateTotalCharge();
  });

  ageInput.addEventListener('input', function () {
    updateTotalCharge();
  });

  let lang = localStorage.getItem('lang');
  if (!lang) {
    if (navigator.language.startsWith('sv')) {
      lang = 'sv';
    } else {
      lang = 'en';
    }
  }
  window.translations = {};
  setLanguage(lang);

  document.getElementById('en').addEventListener('click', function () {
    setLanguage('en');
  });

  document.getElementById('sv').addEventListener('click', function () {
    setLanguage('sv');
  });

  updateTotalCharge();
  updateGraph();
});