export function prepareVolumeChart(data, priceField, label) {
    const labels = data.map((item, i) => `${item[priceField]} (${i})`);
    const volumes = data.map(item =>
      typeof item.Volume === 'string'
        ? Number(item.Volume.replace(/,/g, ''))
        : item.Volume
    );
    const times = data.map(item => item.time);
  
    return {
      labels,
      datasets: [{
        label,
        data: volumes,
        time: times,
        backgroundColor: 'rgba(59,130,246,0.7)',
        borderRadius: 12,
        hoverBackgroundColor: 'rgba(34,211,238,1)',
        maxBarThickness: 14
      }]
    };
  }
  