// Line charts with Chart.js, loaded only when a chart is drawn (keeps page loads light).
// The script is pinned and checked with Subresource Integrity.
const CHART_JS = {
  src: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.js',
  integrity: 'sha384-tgbB5AKnszdcfwcZtTfuhR3Ko1XZdlDfsLtkxiiAZiVkkXCkFmp+FQFh+V/UTo54'
};

let loading = null;
function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CHART_JS.src;
      script.integrity = CHART_JS.integrity;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(window.Chart);
      script.onerror = () => {
        loading = null;
        reject(new Error('Could not load the chart library.'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

const AXES = {
  y: { grid: { color: '#f0f4fb' }, ticks: { font: { size: 11 }, precision: 0 } },
  x: { grid: { display: false }, ticks: { font: { size: 11 } } }
};

export const SERIES_STYLE = {
  navy: { borderColor: '#002D62', backgroundColor: 'rgba(0,45,98,0.12)', pointBackgroundColor: '#002D62' },
  blue: { borderColor: '#2f7cf6', backgroundColor: 'rgba(47,124,246,0.10)', pointBackgroundColor: '#2f7cf6' },
  signup: { borderColor: '#2057CE', backgroundColor: 'rgba(32,87,206,0.08)', pointBackgroundColor: '#002D62' }
};

// Draws (or updates) a line chart in a canvas. Returns the Chart instance.
//   series: [{ label, data, style: 'navy' | 'blue' | 'signup', fill }]
export async function lineChart(canvas, { labels, series, legend = true }) {
  const Chart = await loadChartJs();
  const datasets = series.map((s) => ({
    label: s.label,
    data: s.data,
    borderWidth: 2.5,
    pointRadius: 4,
    tension: 0.35,
    fill: !!s.fill,
    ...SERIES_STYLE[s.style || 'navy']
  }));
  const existing = Chart.getChart(canvas);
  if (existing) {
    existing.data.labels = labels;
    existing.data.datasets = datasets;
    existing.update();
    return existing;
  }
  return new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: legend, position: 'top' } },
      scales: AXES
    }
  });
}

// Month label in Manila time for a bucket start (ms)
export const monthLabel = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Manila' });
export const weekdayLabel = (ms) => new Date(ms).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Manila' });
