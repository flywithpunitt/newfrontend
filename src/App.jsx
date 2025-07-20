import { useState, useRef } from 'react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import Chart from 'chart.js/auto'
import annotationPlugin from 'chartjs-plugin-annotation';
import { AuthProvider, useAuth } from './context/AuthContext'
import ProfileIcon from './components/auth/ProfileIcon'
import AdminDashboard from './components/dashboard/AdminDashboard'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import ProfilePage from './components/auth/ProfilePage'
import TradingViewModal from './components/auth/TradingViewModal'
import DataTable from './utils/table'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
)

function customSort(data, key = "open") {
  return [...data].sort((a, b) => {
    const aStr = a[key].toString();
    const bStr = b[key].toString();
    if (aStr.length !== bStr.length) {
      return aStr.length - bStr.length;
    }
    return parseFloat(aStr) - parseFloat(bStr);
  });
}

// Wrap the main app content with authentication check
const AppContent = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    scriptName: '',
    timeframe: '',
    startTime: '',
    endTime: ''
  });

  const symbols = ['Silver', 'Gold', 'Copper']
  const timeFrames = ['1m', '5m', '15m', '1h']

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [chartData, setChartData] = useState(null);
  
  // TradingView Modal State
  const [showTradingViewModal, setShowTradingViewModal] = useState(false);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [pendingChartData, setPendingChartData] = useState(null); // Store chart click data while getting credentials

  // Helper to extract script name and timeframe from file name
  function extractInfoFromFileName(fileName) {
    // Remove extension for parsing
    const base = fileName.replace(/\.(xlsx|csv)$/i, '');
    // Split by comma, then trim spaces
    const parts = base.split(',').map(p => p.trim());
    let scriptName = '';
    let timeframe = '';
    if (parts.length === 2) {
      // e.g., [CAPITALCOM_GOLD, 10]
      const scriptParts = parts[0].split('_');
      scriptName = scriptParts[scriptParts.length - 1].toUpperCase();
      timeframe = parts[1];
    } else {
      // fallback: try to get last word as script, last number as timeframe
      const fallbackParts = base.split(/[_ ,]+/);
      scriptName = fallbackParts.find(p => /[A-Za-z]+/.test(p) && p !== 'CAPITALCOM') || '';
      timeframe = fallbackParts.reverse().find(p => /^\d+$/.test(p)) || '';
      scriptName = scriptName.toUpperCase();
    }
    // Ensure timeframe is just the number
    timeframe = timeframe.replace(/[^\d]/g, '');
    return { scriptName, timeframe };
  }

  // Dummy data for charts and stats
  const chartDataDummy = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'High Values',
        data: [65, 59, 80, 81, 56, 55],
        borderColor: 'rgb(56,189,248)',
        backgroundColor: 'rgba(56,189,248,0.2)',
        tension: 0.1,
        fill: false
      },
      {
        label: 'Low Values',
        data: [28, 48, 40, 19, 86, 27],
        borderColor: 'rgb(99,102,241)',
        backgroundColor: 'rgba(99,102,241,0.2)',
        tension: 0.1,
        fill: false
      },
      {
        label: 'Volume',
        data: [45, 25, 60, 35, 70, 40],
        borderColor: 'rgb(59,130,246)',
        backgroundColor: 'rgba(59,130,246,0.2)',
        tension: 0.1,
        fill: false
      }
    ]
  }

  const barData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Monthly Volume',
        data: [120, 190, 300, 250, 220, 170],
        backgroundColor: 'rgba(56,189,248,0.7)',
        borderRadius: 8
      }
    ]
  }

  const doughnutData = {
    labels: ['Gold', 'Silver', 'Copper'],
    datasets: [
      {
        label: 'Symbol Distribution',
        data: [40, 35, 25],
        backgroundColor: [
          'rgba(56,189,248,0.8)',
          'rgba(99,102,241,0.8)',
          'rgba(59,130,246,0.8)'
        ],
        borderColor: [
          'rgba(56,189,248,1)',
          'rgba(99,102,241,1)',
          'rgba(59,130,246,1)'
        ],
        borderWidth: 2
      }
    ]
  }

  const areaData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Price Trend',
        data: [120, 130, 125, 140, 135, 150],
        fill: true,
        backgroundColor: 'rgba(56,189,248,0.2)',
        borderColor: 'rgba(56,189,248,1)',
        tension: 0.4
      }
    ]
  }

  // Helper to calculate 90th percentile + 20% padding for Y-axis scaling, excluding top 2 outliers
  function calculateMaxWithoutOutliers(dataArr) {
    if (!Array.isArray(dataArr) || dataArr.length < 2) return 1_000_000;
    const sorted = [...dataArr].sort((a, b) => a - b);
    // Remove the top 2 values as outliers
    const trimmed = sorted.slice(0, -2);
    const idx = Math.floor(0.90 * (trimmed.length - 1));
    return Math.ceil(trimmed[idx] * 1.2); // add 20% headroom
  }

  // Helper to decide if we should use a logarithmic y-axis
  function shouldUseLogScale(dataArr) {
    if (!Array.isArray(dataArr) || dataArr.length < 2) return false;
    const sorted = [...dataArr].sort((a, b) => a - b);
    const idx = Math.floor(0.90 * (sorted.length - 1));
    const p90 = sorted[idx];
    const max = sorted[sorted.length - 1];
    return max > 10 * p90;
  }

  function formatVolume(value) {
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return value;
  }

  // Check if user has TradingView credentials
  const checkCredentials = async () => {
    if (!user) return false;
    
    try {
      const response = await fetch('http://localhost:5000/api/profile/tradingview-credentials', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.hasCredentials;
      }
      return false;
    } catch (error) {
      console.error('Error checking credentials:', error);
      return false;
    }
  };

  // Save TradingView credentials
  const saveTradingViewCredentials = async (credentials) => {
    setCredentialsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/profile/tradingview-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error('Failed to save credentials');
      }

      setShowTradingViewModal(false);
      
      // Now proceed with the chart click that was pending
      if (pendingChartData) {
        await proceedWithTradingView(pendingChartData);
        setPendingChartData(null);
      }
    } catch (error) {
      throw error;
    } finally {
      setCredentialsLoading(false);
    }
  };

  // Proceed with TradingView after credentials are confirmed
  const proceedWithTradingView = async (chartClickData) => {
    try {
      console.log('📊 Sending trigger data to old backend:', chartClickData);

      // Include JWT token in the data so Python backend can fetch TradingView credentials
      const triggerData = {
        ...chartClickData,
        jwt_token: localStorage.getItem('token') // Add JWT token for credential retrieval
      };

      // Send to old Python backend with user's JWT for credential retrieval
      const response = await fetch('http://localhost:8000/trigger-tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`, // Send JWT so Python backend can get credentials
        },
        body: JSON.stringify(triggerData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ TradingView trigger successful:', result);
    } catch (error) {
      console.error('❌ TradingView trigger failed:', error);
    }
  };

  // Handle chart bar click
  const handleChartClick = async (chartTitle, dataIndex, dataset) => {
    // Check if user is logged in
    if (!user) {
      alert('Please login to use TradingView integration');
      return;
    }

    // Color mapping for chart titles
    const colorMap = {
      "Volume vs Open": "#000000",      // Black
      "Volume vs Close": "#FFA500",     // Light Orange
      "Volume vs High": "#FF0000",      // Red
      "Volume vs Low": "#00FF00"        // Green
    };

    try {
      // Extract real-time data from the clicked bar
      const price = dataset.labels[dataIndex]?.split(' ')[0]; // Get just the price without the index
      const volume = dataset.data[dataIndex];
      const timestamp = dataset.time[dataIndex];
      const source = 'click';

      // Validate all required data is present and valid
      if (!formData.scriptName || !formData.timeframe || !price || !timestamp || !volume || source !== 'click') {
        console.warn('❌ Invalid data, skipping trigger:', {
          symbol: formData.scriptName,
          timeframe: formData.timeframe,
          price,
          volume,
          timestamp,
          source
        });
        return;
      }

      // Build the payload with all required fields
      const chartClickData = {
        symbol: formData.scriptName,
        timeframe: formData.timeframe,
        price: price,
        volume: volume,
        timestamp: timestamp,
        source: source,
        trendline_color: colorMap[chartTitle],
        jwt_token: localStorage.getItem('token'),
        start_time: formData.startTime ? formData.startTime.replace('T', ' ') : '', // Replace T with space
        end_time: formData.endTime ? formData.endTime.replace('T', ' ') : ''        // Replace T with space
      };

      // Check if user has TradingView credentials
      const hasCredentials = await checkCredentials();
      
      if (!hasCredentials) {
        // Store the chart click data and show credentials modal
        setPendingChartData(chartClickData);
        setShowTradingViewModal(true);
      } else {
        // User has credentials, proceed directly
        await proceedWithTradingView(chartClickData);
      }
    } catch (error) {
      console.error('❌ Chart click handling failed:', error);
    }
  };

  // Chart options for all charts
  const getBarOptions = (title, yData) => {
    const useLog = shouldUseLogScale(yData);
    return {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const element = elements[0];
          const dataset = event.chart.data.datasets[element.datasetIndex];
          handleChartClick(title, element.index, {
            labels: event.chart.data.labels,
            data: dataset.data,
            time: dataset.time
          });
        }
      },
      plugins: {
        legend: { display: false },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: '#fff',
          borderColor: '#38bdf8',
          borderWidth: 1.5,
          titleColor: '#0f172a',
          bodyColor: '#0f172a',
          bodyFont: { family: 'Inter, sans-serif', size: 16 },
          titleFont: { family: 'Inter, sans-serif', size: 16, weight: 'bold' },
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: function(context) {
              const dataIndex = context.dataIndex;
              const dataset = context.dataset;
              const time = dataset.time?.[dataIndex] || '';
              return [
                `Volume: ${context.parsed.y.toLocaleString()}`,
                `Time: ${time}`
              ];
            }
          }
        },
      },
      animation: {
        duration: 1200,
        easing: 'easeOutQuart'
      },
      scales: {
        x: {
          ticks: {
            color: '#0f172a',
            font: { family: 'Inter, sans-serif', size: 14 },
            maxRotation: 30,
            minRotation: 20
          },
          grid: { color: '#e0e7ef' }
        },
        y: {
          type: useLog ? 'logarithmic' : 'linear',
          ticks: {
            color: '#0f172a',
            font: { family: 'Inter, sans-serif', size: 14 },
            callback: formatVolume
          },
          grid: { color: '#e0e7ef' },
          suggestedMax: useLog ? undefined : calculateMaxWithoutOutliers(yData)
        }
      },
      elements: {
        bar: {
          borderRadius: 12,
          backgroundColor: ctx => ctx.active ? 'rgba(34,211,238,0.9)' : undefined,
          hoverBackgroundColor: 'rgba(34,211,238,1)'
        }
      }
    };
  };

  // Dummy quick stats
  const stats = [
    { label: 'Total Trades', value: 1240, icon: '📈' },
    { label: 'Win Rate', value: '68%', icon: '🏆' },
    { label: 'Best Symbol', value: 'Gold', icon: '🥇' },
    { label: 'Avg. Volume', value: '2.3M', icon: '💹' }
  ]

  // Dummy recent activity
  const recent = [
    { time: '2024-06-16 10:30', symbol: 'Gold', action: 'Buy', result: '+$120' },
    { time: '2024-06-16 09:50', symbol: 'Silver', action: 'Sell', result: '-$30' },
    { time: '2024-06-16 09:10', symbol: 'Copper', action: 'Buy', result: '+$60' },
    { time: '2024-06-16 08:40', symbol: 'Gold', action: 'Sell', result: '+$80' },
    { time: '2024-06-16 08:00', symbol: 'Silver', action: 'Buy', result: '+$25' }
  ]

  // Utility to format Date as 'YYYY-MM-DD HH:MM' in local time (no T, no Z, no seconds)
  function formatDateLocal(date) {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setLoading(true);
    // Use the latest formData state
    const script = formData.scriptName || '';
    const timeframe = formData.timeframe || '';
    const start_time = formData.startTime ? formatDateLocal(new Date(formData.startTime)) : '';
    const end_time = formData.endTime ? formatDateLocal(new Date(formData.endTime)) : '';
    const formDataToSend = new FormData();
    formDataToSend.append('file', selectedFile);
    formDataToSend.append('script', script);
    formDataToSend.append('timeframe', timeframe);
    formDataToSend.append('start_time', start_time);
    formDataToSend.append('end_time', end_time);
    // Log all FormData values before fetch
    for (let pair of formDataToSend.entries()) {
      console.log(pair[0]+ ':', pair[1]);
    }
    try {
      const res = await fetch('https://trade-backend-88u2.onrender.com/upload-and-process', {
        method: 'POST',
        body: formDataToSend
      });
      const data = await res.json();
      if (
        data &&
        Array.isArray(data.volume_vs_open) &&
        Array.isArray(data.volume_vs_close) &&
        Array.isArray(data.volume_vs_high) &&
        Array.isArray(data.volume_vs_low)
      ) {
        setChartData({
          volume_vs_open: data.volume_vs_open,
          volume_vs_close: data.volume_vs_close,
          volume_vs_high: data.volume_vs_high,
          volume_vs_low: data.volume_vs_low
        });
      } else {
        setChartData(null);
      }
    } catch (err) {
      setChartData(null);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Regular user dashboard (for ALL users including admins on home page)
  return (
    <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
      <h1 className="text-3xl font-extrabold text-gray-800 mb-2 text-center">TradingView Uploader</h1>
      <p className="text-gray-500 text-center mb-4">Upload your TradingView CSV and generate charts with ease</p>
        <div className="flex flex-col items-center min-h-[60vh] justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full flex flex-col items-center gap-8">
           
            <div
              className={`w-full flex flex-col items-center justify-center border-2 border-dashed border-cyan-400/60 rounded-xl p-8 min-h-[180px] bg-gray-50 cursor-pointer transition-all duration-200 hover:bg-cyan-50 ${selectedFile ? 'border-cyan-400 bg-cyan-50' : ''}`}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.csv'))) {
                  setSelectedFile(file);
                  const info = extractInfoFromFileName(file.name);
                  setFormData({ ...formData, scriptName: info.scriptName, timeframe: info.timeframe });
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files[0];
                  if (file) {
                    setSelectedFile(file);
                    const info = extractInfoFromFileName(file.name);
                    setFormData({ ...formData, scriptName: info.scriptName, timeframe: info.timeframe });
                  }
                }}
              />
              <div className="flex flex-col items-center gap-2">
                <span className="text-lg font-semibold text-cyan-600">Drag & Drop CSV File</span>
                <span className="text-blue-500 text-base">or <span className="underline cursor-pointer text-cyan-500">Browse Files</span></span>
                {selectedFile && (
                  <span className="mt-2 text-cyan-700 text-base font-medium">{selectedFile.name}</span>
                )}
              </div>
            </div>
            <div className="w-full flex flex-col gap-4 mt-2">
              <div className="flex w-full gap-2">
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  className="flex-1 min-w-0 rounded-lg px-4 py-3 bg-gray-50 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 placeholder:text-gray-400 text-base"
                  placeholder="Start Time"
                />
                <input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  className="flex-1 min-w-0 rounded-lg px-4 py-3 bg-gray-50 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 placeholder:text-gray-400 text-base"
                  placeholder="End Time"
                />
              </div>
              <button
                type="button"
                className="mt-2 w-full py-3 rounded-lg bg-gray-900 text-white font-semibold text-lg shadow-md hover:bg-gray-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
                disabled={loading || !selectedFile}
                onClick={handleSubmit}
              >
                {loading ? 'Processing...' : 'Generate Chart'}
              </button>
            </div>
          </div>
          {/* End Upload Card */}

          {/* Render charts if chartData is available and valid */}
          {chartData && (
            <div className="w-full max-w-5xl flex flex-col gap-8 md:gap-12 mb-4 md:mb-8 mt-8 mx-auto">
              {/* Volume vs Open */}
              {chartData.volume_vs_open?.length > 0 && (
                <div className="flex flex-col md:flex-row gap-6 items-stretch">
                  {/* Chart */}
                  <div className="flex-1">
                    <div className="transition-transform duration-300 hover:scale-[1.03] bg-white/70 backdrop-blur-lg shadow-2xl border border-cyan-200/60 rounded-3xl p-8 flex flex-col items-center group relative before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-br before:from-cyan-100/40 before:to-blue-100/10 before:blur-xl before:opacity-70 before:pointer-events-none">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" /></svg>
                        <span className="text-2xl font-extrabold text-cyan-600 drop-shadow">Volume vs Open</span>
                      </div>
                      <div className="chart-scroll-x overflow-x-auto" style={{ height: '300px' }}>
                        <div style={{ width: `${Math.max(chartData.volume_vs_open.length * 18, 320)}px`, height: '300px', display: 'inline-block' }}>
                          <Bar
                            data={{
                              labels: customSort(chartData.volume_vs_open, 'open').map((item, i) => `${item.open} (${i})`),
                              datasets: [{
                                label: 'Volume vs Open',
                                data: customSort(chartData.volume_vs_open, 'open').map(item => Number(item.Volume)),
                                time: customSort(chartData.volume_vs_open, 'open').map(item => item.time),
                                backgroundColor: 'rgba(51, 102, 204, 0.7)', // modern blue
                                borderRadius: 8,
                                hoverBackgroundColor: 'rgba(51, 102, 204, 1)',
                                maxBarThickness: 18
                              }]
                            }}
                            options={getBarOptions('Volume vs Open', customSort(chartData.volume_vs_open, 'open').map(item => Number(item.Volume)))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Table */}
                  <div className="flex-1 max-w-xs flex items-center justify-center">
                    <DataTable data={customSort(chartData.volume_vs_open, 'open')} priceField="open" enhanced />
                  </div>
                </div>
              )}
              {/* Volume vs Close */}
              {chartData.volume_vs_close?.length > 0 && (
                <div className="flex flex-col md:flex-row gap-6 items-stretch">
                  {/* Chart */}
                  <div className="flex-1">
                    <div className="transition-transform duration-300 hover:scale-[1.03] bg-white/70 backdrop-blur-lg shadow-2xl border border-violet-200/60 rounded-3xl p-8 flex flex-col items-center group relative before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-br before:from-violet-100/40 before:to-blue-100/10 before:blur-xl before:opacity-70 before:pointer-events-none">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" /></svg>
                        <span className="text-2xl font-extrabold text-violet-600 drop-shadow">Volume vs Close</span>
                      </div>
                      <div className="chart-scroll-x overflow-x-auto" style={{ height: '300px' }}>
                        <div style={{ width: `${Math.max(chartData.volume_vs_close.length * 18, 320)}px`, height: '300px', display: 'inline-block' }}>
                          <Bar
                            data={{
                              labels: customSort(chartData.volume_vs_close, 'close').map((item, i) => `${item.close} (${i})`),
                              datasets: [{
                                label: 'Volume vs Close',
                                data: customSort(chartData.volume_vs_close, 'close').map(item => Number(item.Volume)),
                                time: customSort(chartData.volume_vs_close, 'close').map(item => item.time),
                                backgroundColor: 'rgba(99,102,241,0.7)',
                                borderRadius: 8,
                                hoverBackgroundColor: 'rgba(34,211,238,1)',
                                maxBarThickness: 18
                              }]
                            }}
                            options={getBarOptions('Volume vs Close', customSort(chartData.volume_vs_close, 'close').map(item => Number(item.Volume)))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Table */}
                  <div className="flex-1 max-w-xs flex items-center justify-center">
                    <DataTable data={customSort(chartData.volume_vs_close, 'close')} priceField="close" enhanced />
                  </div>
                </div>
              )}
              {/* Volume vs High */}
              {chartData.volume_vs_high?.length > 0 && (
                <div className="flex flex-col md:flex-row gap-6 items-stretch">
                  {/* Chart */}
                  <div className="flex-1">
                    <div className="transition-transform duration-300 hover:scale-[1.03] bg-white/70 backdrop-blur-lg shadow-2xl border border-blue-200/60 rounded-3xl p-8 flex flex-col items-center group relative before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-br before:from-blue-100/40 before:to-cyan-100/10 before:blur-xl before:opacity-70 before:pointer-events-none">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" /></svg>
                        <span className="text-2xl font-extrabold text-blue-600 drop-shadow">Volume vs High</span>
                      </div>
                      <div className="chart-scroll-x overflow-x-auto" style={{ height: '300px' }}>
                        <div style={{ width: `${Math.max(chartData.volume_vs_high.length * 18, 320)}px`, height: '300px', display: 'inline-block' }}>
                          <Bar
                            data={{
                              labels: customSort(chartData.volume_vs_high, 'high').map((item, i) => `${item.high} (${i})`),
                              datasets: [{
                                label: 'Volume vs High',
                                data: customSort(chartData.volume_vs_high, 'high').map(item => Number(item.Volume)),
                                time: customSort(chartData.volume_vs_high, 'high').map(item => item.time),
                                backgroundColor: 'rgba(59,130,246,0.7)',
                                borderRadius: 8,
                                hoverBackgroundColor: 'rgba(34,211,238,1)',
                                maxBarThickness: 18
                              }]
                            }}
                            options={getBarOptions('Volume vs High', customSort(chartData.volume_vs_high, 'high').map(item => Number(item.Volume)))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Table */}
                  <div className="flex-1 max-w-xs flex items-center justify-center">
                    <DataTable data={customSort(chartData.volume_vs_high, 'high')} priceField="high" enhanced />
                  </div>
                </div>
              )}
              {/* Volume vs Low */}
              {chartData.volume_vs_low?.length > 0 && (
                <div className="flex flex-col md:flex-row gap-6 items-stretch">
                  {/* Chart */}
                  <div className="flex-1">
                    <div className="transition-transform duration-300 hover:scale-[1.03] bg-white/70 backdrop-blur-lg shadow-2xl border border-cyan-200/60 rounded-3xl p-8 flex flex-col items-center group relative before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-br before:from-cyan-100/40 before:to-blue-100/10 before:blur-xl before:opacity-70 before:pointer-events-none">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" /></svg>
                        <span className="text-2xl font-extrabold text-cyan-600 drop-shadow">Volume vs Low</span>
                      </div>
                      <div className="chart-scroll-x overflow-x-auto" style={{ height: '300px' }}>
                        <div style={{ width: `${Math.max(chartData.volume_vs_low.length * 18, 320)}px`, height: '300px', display: 'inline-block' }}>
                          <Bar
                            data={{
                              labels: customSort(chartData.volume_vs_low, 'low').map((item, i) => `${item.low} (${i})`),
                              datasets: [{
                                label: 'Volume vs Low',
                                data: customSort(chartData.volume_vs_low, 'low').map(item => Number(item.Volume)),
                                time: customSort(chartData.volume_vs_low, 'low').map(item => item.time),
                                backgroundColor: 'rgba(59,130,246,0.7)',
                                borderRadius: 8,
                                hoverBackgroundColor: 'rgba(34,211,238,1)',
                                maxBarThickness: 18
                              }]
                            }}
                            options={getBarOptions('Volume vs Low', customSort(chartData.volume_vs_low, 'low').map(item => Number(item.Volume)))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Table */}
                  <div className="flex-1 max-w-xs flex items-center justify-center">
                    <DataTable data={customSort(chartData.volume_vs_low, 'low')} priceField="low" enhanced />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* TradingView Credentials Modal */}
      {showTradingViewModal && (
        <TradingViewModal
          onClose={() => {
            setShowTradingViewModal(false);
            setPendingChartData(null);
          }}
          onSubmit={saveTradingViewCredentials}
          loading={credentialsLoading}
        />
      )}
    </main>
  );
};

// Protected Route component
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
